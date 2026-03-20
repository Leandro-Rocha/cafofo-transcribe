const express = require('express');
const path = require('path');
const { transcribe } = require('./transcribe');
const autotranscribe = require('./autotranscribe');
const senders = require('./senders');
const { getConfig, setConfig, getGroqApiKey } = require('./config');

const app = express();
app.use(express.json({ limit: '25mb' }));

const ZAP_URL = process.env.ZAP_URL;
const SELF_URL = process.env.SELF_URL;
const PORT = process.env.PORT || 3020;

// ── Helpers ──

async function sendToInbox(label, text) {
  const inboxJid = getConfig('inbox_jid');
  if (!inboxJid) { console.error('[transcribe] inbox_jid não configurado'); return; }
  if (!ZAP_URL) { console.error('[transcribe] ZAP_URL não configurado'); return; }
  if (label) {
    await fetch(`${ZAP_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId: inboxJid, text: `*${label}:*` }),
    });
  }
  await fetch(`${ZAP_URL}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId: inboxJid, text }),
  });
}

// ── Webhook receiver ──

app.post('/webhook', async (req, res) => {
  res.json({ ok: true }); // respond immediately, process async

  const event = req.body;
  const { type, sender, senderJid, groupId, isMySender, isSelfChat, forwarded, originalSender } = event;

  // Track all known senders (from non-own messages)
  if (senderJid && sender && !isMySender) {
    senders.trackSeen(senderJid, sender);
  }

  if (type !== 'audio' || !event.audioBase64) return;

  let shouldTranscribe = false;
  let label = null;

  if (isSelfChat) {
    // Áudio enviado para si mesmo (Mensagens Salvas)
    shouldTranscribe = true;
    label = forwarded && originalSender ? originalSender : null;
  } else if (isMySender && autotranscribe.isEnabled(groupId)) {
    // Áudio próprio ou encaminhado em grupo habilitado
    shouldTranscribe = true;
    label = forwarded && originalSender ? originalSender : null;
  } else if (senderJid && senders.isMonitored(senderJid)) {
    // Remetente monitorado
    shouldTranscribe = true;
    label = sender;
  }

  if (!shouldTranscribe) return;

  const buffer = Buffer.from(event.audioBase64, 'base64');
  const text = await transcribe(buffer, event.mimetype).catch((err) => {
    console.error('[transcribe] erro:', err.message);
    return null;
  });

  if (text) await sendToInbox(label, text);
});

// ── Groups (proxied from cafofo-zap) ──

app.get('/groups', async (req, res) => {
  if (!ZAP_URL) return res.status(503).json({ error: 'ZAP_URL não configurado' });
  try {
    const groups = await fetch(`${ZAP_URL}/groups`).then((r) => r.json());
    res.json(groups);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// ── Autotranscribe ──

app.get('/autotranscribe', (req, res) => res.json(autotranscribe.list()));

app.post('/autotranscribe/:groupId', (req, res) => {
  autotranscribe.enable(decodeURIComponent(req.params.groupId));
  res.json({ ok: true });
});

app.delete('/autotranscribe/:groupId', (req, res) => {
  autotranscribe.disable(decodeURIComponent(req.params.groupId));
  res.json({ ok: true });
});

// ── Senders ──

app.get('/senders', (_, res) => res.json(senders.listKnown()));

app.post('/senders', (req, res) => {
  const { jid, name } = req.body;
  if (!jid) return res.status(400).json({ error: 'jid obrigatório' });
  senders.add(jid, name);
  res.status(201).json({ ok: true });
});

app.delete('/senders/:jid', (req, res) => {
  senders.remove(decodeURIComponent(req.params.jid));
  res.status(204).end();
});

// ── Config ──

app.get('/config/inbox', (_, res) => res.json({ jid: getConfig('inbox_jid') }));
app.post('/config/inbox', (req, res) => {
  setConfig('inbox_jid', req.body.jid || null);
  res.json({ ok: true });
});

app.get('/config/groq-key', (_, res) => res.json({ set: !!getGroqApiKey() }));
app.post('/config/groq-key', (req, res) => {
  setConfig('groq_api_key', req.body.key || null);
  res.json({ ok: true });
});

// ── Health ──

app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── Startup: registra webhook no cafofo-zap ──

async function registerWebhook() {
  if (!ZAP_URL || !SELF_URL) {
    console.error('[transcribe] ZAP_URL e SELF_URL são obrigatórios para registrar webhook');
    return;
  }

  const webhookUrl = `${SELF_URL}/webhook`;

  try {
    // Remove registros antigos para esta URL (idempotência)
    const existing = await fetch(`${ZAP_URL}/webhooks`).then((r) => r.json());
    for (const w of existing.filter((w) => w.url === webhookUrl)) {
      await fetch(`${ZAP_URL}/webhooks/${w.id}`, { method: 'DELETE' });
    }

    // Registra ouvindo text (para trackSeen) e audio (para transcrição)
    await fetch(`${ZAP_URL}/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, events: ['text', 'audio'] }),
    });

    console.log('[transcribe] webhook registrado em', webhookUrl);
  } catch (err) {
    console.error('[transcribe] falha ao registrar webhook:', err.message, '— tentando em 10s');
    setTimeout(registerWebhook, 10000);
  }
}

app.listen(PORT, () => {
  console.log(`[transcribe] API na porta ${PORT}`);
  registerWebhook();
});
