const { getGroqApiKey } = require('./config');

async function transcribe(buffer, mimetype) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('Groq API key não configurada');

  const ext = (mimetype || '').includes('ogg') ? 'ogg' : 'mp4';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimetype || 'audio/ogg' }), `audio.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'pt');
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body}`);
  }
  return (await res.text()).trim();
}

module.exports = { transcribe };
