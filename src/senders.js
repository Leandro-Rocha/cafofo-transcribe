const db = require('./db');

function isMonitored(jid) {
  if (!jid) return false;
  return !!db.prepare('SELECT 1 FROM transcribe_senders WHERE jid = ?').get(jid);
}

function add(jid, name) {
  db.prepare('INSERT OR REPLACE INTO transcribe_senders (jid, name) VALUES (?, ?)').run(jid, name || jid);
}

function remove(jid) {
  db.prepare('DELETE FROM transcribe_senders WHERE jid = ?').run(jid);
}

function listKnown() {
  return db.prepare(`
    SELECT k.jid, k.name, CASE WHEN t.jid IS NOT NULL THEN 1 ELSE 0 END AS monitored
    FROM known_senders k
    LEFT JOIN transcribe_senders t ON t.jid = k.jid
    ORDER BY k.name
  `).all();
}

function trackSeen(jid, name) {
  if (!jid || !name) return;
  db.prepare('INSERT INTO known_senders (jid, name) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET name=excluded.name, last_seen=CURRENT_TIMESTAMP').run(jid, name);
}

module.exports = { isMonitored, add, remove, listKnown, trackSeen };
