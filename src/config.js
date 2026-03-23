const db = require('./db');

const get = db.prepare('SELECT value FROM config WHERE key = ?');
const set = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
const del = db.prepare('DELETE FROM config WHERE key = ?');

function getConfig(key) {
  return get.get(key)?.value ?? null;
}

function setConfig(key, value) {
  if (value) set.run(key, value);
  else del.run(key);
}

module.exports = { getConfig, setConfig };
