'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const crypto = require('node:crypto');
const { hashPassword } = require('./crypto');

const DB_PATH = path.join(__dirname, '..', 'bioannot.db');
const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password   TEXT NOT NULL,
    role       TEXT NOT NULL DEFAULT 'annotator'
               CHECK(role IN ('annotator','reviewer','admin')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL
               CHECK(type IN ('peak','interval','bbox','polygon')),
    label      TEXT,
    color      TEXT,
    status     TEXT CHECK(status IN ('approved','rejected') OR status IS NULL),
    data       TEXT NOT NULL DEFAULT '{}',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL,
    action    TEXT NOT NULL,
    target_id TEXT,
    detail    TEXT,
    ts        INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`);

const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (count === 0) {
  const ins = db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)');
  const seeds = [
    { name:'Dr. Sharma', email:'sharma@medlab.in', password:'admin123',  role:'admin'     },
    { name:'Riya Patel',  email:'riya@medlab.in',   password:'annotate1', role:'annotator' },
    { name:'Arun Nair',   email:'arun@medlab.in',   password:'review99',  role:'reviewer'  },
  ];
  for (const s of seeds) ins.run(crypto.randomUUID(), s.name, s.email, hashPassword(s.password), s.role);
  console.log('  ✓ Default users seeded');
}

module.exports = db;
