const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'funeral-book.db');

function init() {
  const exists = fs.existsSync(DB_FILE);
  const db = new Database(DB_FILE);
  if (!exists) {
    db.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, createdAt TEXT);
      CREATE TABLE sessions (id INTEGER PRIMARY KEY, token TEXT UNIQUE, userId INTEGER, createdAt TEXT);
      CREATE TABLE records (id INTEGER PRIMARY KEY, name TEXT, note TEXT, createdAt TEXT, updatedAt TEXT);
      CREATE TABLE posts (id INTEGER PRIMARY KEY, userId INTEGER, title TEXT, body TEXT, videoUrl TEXT, tags TEXT, mentions TEXT, createdAt TEXT);
      CREATE TABLE chat (id INTEGER PRIMARY KEY, user TEXT, message TEXT, room TEXT, createdAt TEXT);
      CREATE TABLE live (userId INTEGER PRIMARY KEY, streamKey TEXT, startedAt TEXT);
    `);
  }
  return db;
}

module.exports = { init, DB_FILE };
