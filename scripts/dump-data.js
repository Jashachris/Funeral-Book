const fs = require('fs');
const path = require('path');

async function trySqlite() {
  try {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    const SQLITE_FILE = path.join(__dirname, '..', 'data.sqlite');
    if (!fs.existsSync(SQLITE_FILE)) return null;
    const buf = fs.readFileSync(SQLITE_FILE);
    const db = new SQL.Database(new Uint8Array(buf));
    const res = db.exec("SELECT v FROM store WHERE k='data'");
    if (res && res[0] && res[0].values && res[0].values[0]) {
      const blob = res[0].values[0][0];
      const s = typeof blob === 'string' ? blob : Buffer.from(blob).toString('utf8');
      return JSON.parse(s || '{}');
    }
    return null;
  } catch (e) {
    return null;
  }
}

function tryJson() {
  try {
    const f = path.join(__dirname, '..', 'data.json');
    if (!fs.existsSync(f)) return null;
    const s = fs.readFileSync(f, 'utf8');
    return JSON.parse(s || '{}');
  } catch (e) { return null; }
}

(async () => {
  const sdata = await trySqlite();
  const data = sdata || tryJson() || {};
  data.records = data.records || [];
  data.users = data.users || [];
  data.posts = data.posts || [];
  data.sessions = data.sessions || [];
  data.blocks = data.blocks || [];
  data.reports = data.reports || [];
  console.log(JSON.stringify({ users: data.users.map(u => ({ id: u.id, username: u.username, admin: u.admin || false, suspended: u.suspended || false })) , counts: { users: data.users.length, posts: data.posts.length } }, null, 2));
})();
