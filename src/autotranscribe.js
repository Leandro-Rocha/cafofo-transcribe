const db = require('./db');

function list() {
  return db.prepare('SELECT group_id FROM autotranscribe').all().map((r) => r.group_id);
}

function isEnabled(groupId) {
  return !!db.prepare('SELECT 1 FROM autotranscribe WHERE group_id = ?').get(groupId);
}

function enable(groupId) {
  db.prepare('INSERT OR IGNORE INTO autotranscribe (group_id) VALUES (?)').run(groupId);
}

function disable(groupId) {
  db.prepare('DELETE FROM autotranscribe WHERE group_id = ?').run(groupId);
}

module.exports = { list, isEnabled, enable, disable };
