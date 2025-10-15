const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const SQLITE_FILE = path.join(__dirname, '..', 'data.sqlite');

let SQL = null;
let db = null;
let useSql = false;

// Try to load sql.js (WASM sqlite). If not available, the adapter will fall back to JSON file.
function tryLoadSqlJs() {
  try {
    // require may return initSqlJs function
    const initSqlJs = require('sql.js');
    return initSqlJs;
  } catch (e) {
    return null;
  }
}

async function init() {
  const initSqlJs = tryLoadSqlJs();
  if (!initSqlJs) {
    useSql = false;
    return false;
  }
  try {
    const SQLLib = await initSqlJs();
    SQL = SQLLib;
    if (fs.existsSync(SQLITE_FILE)) {
      const buf = fs.readFileSync(SQLITE_FILE);
      db = new SQL.Database(new Uint8Array(buf));
    } else {
      db = new SQL.Database();
      db.run("CREATE TABLE IF NOT EXISTS store (k TEXT PRIMARY KEY, v BLOB);");
      // if a data.json exists, migrate it into the sqlite store
      if (fs.existsSync(DATA_FILE)) {
        try {
          const s = fs.readFileSync(DATA_FILE, 'utf8');
          const obj = JSON.parse(s || '{}');
          const jsonStr = JSON.stringify(obj);
          db.run("INSERT OR REPLACE INTO store (k,v) VALUES ('data', json(?))", [jsonStr]);
        } catch (e) {
          // on parse error insert empty
          db.run("INSERT OR REPLACE INTO store (k,v) VALUES ('data', json('{}'))");
        }
      } else {
        db.run("INSERT OR REPLACE INTO store (k,v) VALUES ('data', json('{}'))");
      }
      persistToFile();
    }
    useSql = true;
    return true;
  } catch (e) {
    useSql = false;
    return false;
  }
}

function persistToFile() {
  if (!useSql || !db) return;
  try {
    const arr = db.export();
    const buf = Buffer.from(arr);
    fs.writeFileSync(SQLITE_FILE, buf);
  } catch (e) {}
}

function readData() {
  if (useSql && db) {
    try {
      const stmt = db.exec("SELECT v FROM store WHERE k='data'");
      if (stmt && stmt[0] && stmt[0].values && stmt[0].values[0]) {
        const blob = stmt[0].values[0][0];
        const s = typeof blob === 'string' ? blob : Buffer.from(blob).toString('utf8');
        const obj = JSON.parse(s || '{}');
        obj.records = obj.records || [];
        obj.users = obj.users || [];
        obj.posts = obj.posts || [];
        obj.chat = obj.chat || [];
        obj.sessions = obj.sessions || [];
        obj.live = obj.live || {};
        obj.blocks = obj.blocks || [];
        obj.reports = obj.reports || [];
        obj.followRequests = obj.followRequests || [];
        obj.followers = obj.followers || [];
        obj.memorials = obj.memorials || [];
        obj.media = obj.media || [];
        return obj;
      }
    } catch (e) {
      // fallthrough to JSON file
    }
  }
  try {
    const s = fs.readFileSync(DATA_FILE, 'utf8');
    const obj = JSON.parse(s || '{}');
    obj.records = obj.records || [];
    obj.users = obj.users || [];
    obj.posts = obj.posts || [];
    obj.chat = obj.chat || [];
    obj.sessions = obj.sessions || [];
    obj.live = obj.live || {};
    obj.blocks = obj.blocks || [];
    obj.reports = obj.reports || [];
    obj.followRequests = obj.followRequests || [];
    obj.followers = obj.followers || [];
    obj.memorials = obj.memorials || [];
    obj.media = obj.media || [];
    return obj;
  } catch (e) {
    return { records: [], users: [], posts: [], chat: [], sessions: [], live: {}, blocks: [], reports: [], followRequests: [], followers: [], memorials: [], media: [] };
  }
}

function writeData(data) {
  if (useSql && db) {
    try {
      const s = JSON.stringify(data);
      // store JSON blob in store table
      const safe = s.replace(/'/g, "''");
      db.run("INSERT OR REPLACE INTO store (k,v) VALUES ('data', json(?))", [s]);
      persistToFile();
      return;
    } catch (e) {
      // fallthrough to JSON file
    }
  }
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

module.exports = { init, readData, writeData, available: () => useSql };
