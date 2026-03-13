const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "order.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chosen_name TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'seeker',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;