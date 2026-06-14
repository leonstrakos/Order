const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "order.db"));


try {
  db.exec(`ALTER TABLE reports ADD COLUMN duration TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE reports ADD COLUMN weather TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE reports ADD COLUMN timeOfDay TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE reports ADD COLUMN effects TEXT`);
} catch {}

try {
  db.exec(`ALTER TABLE reports ADD COLUMN alternativeExplanations TEXT`);
} catch {}





db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chosen_name TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'seeker',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );



CREATE TABLE IF NOT EXISTS reports (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  category TEXT,

  title TEXT,

  author TEXT,
  email TEXT,

  age TEXT,
  sex TEXT,

  eventDate TEXT,
  location TEXT,

  witnesses TEXT,
  duration TEXT,

  weather TEXT,
  timeOfDay TEXT,
  effects TEXT,

  report TEXT,

  alternativeExplanations TEXT,

  additionalNotes TEXT,

  files TEXT,

  status TEXT DEFAULT 'Pending',

  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP

);

`);

module.exports = db;