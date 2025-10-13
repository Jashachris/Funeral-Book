const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function readData() {
  try {
    const s = fs.readFileSync(DATA_FILE, 'utf8');
    const obj = JSON.parse(s || '{}');
    // ensure collections
    obj.records = obj.records || [];
    obj.users = obj.users || [];
    obj.posts = obj.posts || [];
    obj.chat = obj.chat || [];
    obj.sessions = obj.sessions || [];
    obj.live = obj.live || {};
    return obj;
  } catch (e) {
    return { records: [], users: [], posts: [], chat: [], sessions: [], live: {} };
  }
}

function writeData(data) {
  // atomic write: write to temp file then rename
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DATA_FILE);
}

function sendJson(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function serveStatic(req, res) {
  let p = req.url.split('?')[0];
  if (p === '/' ) p = '/index.html';
  const file = path.join(PUBLIC_DIR, decodeURIComponent(p));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    const map = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': map[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// SSE clients for chat
const sseClients = [];

function broadcastEvent(event, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(sres => {
    try { sres.write(payload); } catch (e) {}
  });
}

function getUserFromAuth(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const db = readData();
  const sess = db.sessions.find(s => s.token === token);
  if (!sess) return null;
  const user = db.users.find(u => u.id === sess.userId);
  return user || null;
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    // normalize path and extract id if present
    const [_, api, resource, maybeId] = req.url.split('/'); // ['', 'api', 'records', '123']

    // resource can be records, users, posts, chat, live

    // GET /api/records
    // GET /api/records
    if (req.method === 'GET' && resource === 'records' && !maybeId) {
      const db = readData();
      sendJson(res, db.records);
      return;
    }

    // GET /api/records/:id
    if (req.method === 'GET' && resource === 'records' && maybeId) {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      const db = readData();
      const rec = db.records.find(r => r.id === id);
      if (!rec) return sendJson(res, { error: 'not found' }, 404);
      return sendJson(res, rec);
    }

    // POST /api/records
    // POST /api/records
    if (req.method === 'POST' && resource === 'records' && !maybeId) {
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      let length = 0;
      req.on('data', chunk => {
        length += chunk.length;
        if (length > 1_000_000) { res.writeHead(413); res.end('Payload too large'); req.connection.destroy(); return; }
        body += chunk;
      });
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.name) return sendJson(res, { error: 'name required' }, 400);
          const db = readData();
          const id = (db.records.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
          const rec = { id, name: obj.name, note: obj.note || '', createdAt: new Date().toISOString() };
          db.records.push(rec);
          writeData(db);
          sendJson(res, rec, 201);
        } catch (e) {
          sendJson(res, { error: 'invalid json' }, 400);
        }
      });
      return;
    }

    // PUT /api/records/:id
    if (req.method === 'PUT' && resource === 'records' && maybeId) {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      let length = 0;
      req.on('data', chunk => {
        length += chunk.length;
        if (length > 1_000_000) { res.writeHead(413); res.end('Payload too large'); req.connection.destroy(); return; }
        body += chunk;
      });
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const db = readData();
          const idx = db.records.findIndex(r => r.id === id);
          if (idx === -1) return sendJson(res, { error: 'not found' }, 404);
          if (obj.name !== undefined) db.records[idx].name = obj.name;
          if (obj.note !== undefined) db.records[idx].note = obj.note;
          db.records[idx].updatedAt = new Date().toISOString();
          writeData(db);
          return sendJson(res, db.records[idx]);
        } catch (e) {
          return sendJson(res, { error: 'invalid json' }, 400);
        }
      });
      return;
    }

    // DELETE /api/records/:id
    if (req.method === 'DELETE' && resource === 'records' && maybeId) {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      const db = readData();
      const idx = db.records.findIndex(r => r.id === id);
      if (idx === -1) return sendJson(res, { error: 'not found' }, 404);
      const removed = db.records.splice(idx, 1)[0];
      writeData(db);
      return sendJson(res, removed);
    }

    // ===== users endpoints =====
    if (resource === 'users' && req.method === 'POST' && !maybeId) {
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.username || !obj.password) return sendJson(res, { error: 'username and password required' }, 400);
          const db = readData();
          if (db.users.find(u => u.username === obj.username)) return sendJson(res, { error: 'username taken' }, 409);
          const id = (db.users.reduce((m, u) => Math.max(m, u.id || 0), 0) || 0) + 1;
          const user = { id, username: obj.username, password: obj.password, createdAt: new Date().toISOString() };
          db.users.push(user);
          writeData(db);
          return sendJson(res, { id: user.id, username: user.username, createdAt: user.createdAt }, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // login
    if (resource === 'users' && req.method === 'POST' && maybeId === 'login') {
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const db = readData();
          const user = db.users.find(u => u.username === obj.username && u.password === obj.password);
          if (!user) return sendJson(res, { error: 'invalid credentials' }, 401);
          const token = require('crypto').randomBytes(16).toString('hex');
          db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
          writeData(db);
          return sendJson(res, { token });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // ===== posts endpoints =====
    if (resource === 'posts' && req.method === 'GET' && !maybeId) {
      const db = readData();
      return sendJson(res, db.posts);
    }

    if (resource === 'posts' && req.method === 'POST' && !maybeId) {
      // authenticated
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.title && !obj.body) return sendJson(res, { error: 'title or body required' }, 400);
          const db = readData();
          const id = (db.posts.reduce((m, p) => Math.max(m, p.id || 0), 0) || 0) + 1;
          const post = { id, userId: user.id, title: obj.title || '', body: obj.body || '', videoUrl: obj.videoUrl || '', createdAt: new Date().toISOString() };
          db.posts.push(post);
          writeData(db);
          return sendJson(res, post, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // ===== chat endpoints (SSE + send) =====
    if (resource === 'chat' && req.method === 'GET' && maybeId === 'stream') {
      // SSE
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('\n');
      sseClients.push(res);
      req.on('close', () => {
        const i = sseClients.indexOf(res); if (i !== -1) sseClients.splice(i, 1);
      });
      return;
    }

    if (resource === 'chat' && req.method === 'POST' && maybeId === 'send') {
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.user || !obj.message) return sendJson(res, { error: 'user and message required' }, 400);
          const db = readData();
          const msg = { id: (db.chat.reduce((m, x) => Math.max(m, x.id || 0), 0) || 0) + 1, user: obj.user, message: obj.message, createdAt: new Date().toISOString() };
          db.chat.push(msg);
          writeData(db);
          broadcastEvent('message', msg);
          return sendJson(res, msg, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // ===== live endpoints =====
    if (resource === 'live' && req.method === 'POST' && maybeId === 'start') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      const db = readData();
      const streamKey = require('crypto').randomBytes(12).toString('hex');
      db.live[user.id] = { streamKey, startedAt: new Date().toISOString() };
      writeData(db);
      return sendJson(res, { streamKey });
    }

    if (resource === 'live' && req.method === 'POST' && maybeId === 'stop') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      const db = readData();
      const info = db.live[user.id] || null;
      delete db.live[user.id];
      writeData(db);
      return sendJson(res, { stopped: !!info });
    }

    res.writeHead(405); res.end('Method not allowed');
    return;
  }

  serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

module.exports = server;
