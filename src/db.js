const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/cafofo-transcribe.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS autotranscribe (
    group_id TEXT PRIMARY KEY
  );
  CREATE TABLE IF NOT EXISTS transcribe_senders (
    jid TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS known_senders (
    jid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

module.exports = db;
