const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const dbAdapter = require('./lib/dbAdapter');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// keep simple JSON-backed DB in data.json
// delegate to adapter (sql.js WASM when available, else JSON file)
async function initDbAdapter() {
  try {
    await dbAdapter.init();
    console.log('dbAdapter initialized, sql.js available:', dbAdapter.available());
  } catch (e) {
    console.log('dbAdapter init failed, falling back to JSON file');
  }
}

function readData() { return dbAdapter.readData(); }
function writeData(data) { return dbAdapter.writeData(data); }

function createRecord(name, note) {
  const db = readData();
  const id = (db.records.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
  const rec = { id, name, note: note || '', createdAt: new Date().toISOString() };
  db.records.push(rec);
  writeData(db);
  return rec;
}

function listRecords() { return readData().records; }

function getRecord(id) { return readData().records.find(r => r.id === id); }

function updateRecord(id, patch) {
  const db = readData();
  const idx = db.records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  if (patch.name !== undefined) db.records[idx].name = patch.name;
  if (patch.note !== undefined) db.records[idx].note = patch.note;
  db.records[idx].updatedAt = new Date().toISOString();
  writeData(db);
  return db.records[idx];
}

function deleteRecord(id) {
  const db = readData();
  const idx = db.records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const removed = db.records.splice(idx, 1)[0];
  writeData(db);
  return removed;
}

function sendJson(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

// simple password hashing using pbkdf2
function hashPassword(password) {
  const salt = crypto.randomBytes(12).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derived] = stored.split('$');
  if (!salt || !derived) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(derived, 'hex'));
}

// simple signed token: base64(payload).hexsig
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';
function signToken(payloadObj, expiresInSec = 60*60*24) {
  const exp = Math.floor(Date.now()/1000) + expiresInSec;
  const payload = Object.assign({}, payloadObj, { exp });
  const payloadB = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB).digest('hex');
  return `${payloadB}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payloadB, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB).digest('hex');
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(payloadB, 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
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
const sseClients = {}; // map room -> [res]

function broadcastEvent(room, event, data, senderId = null) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  const clients = sseClients[room] || [];
  clients.forEach(entry => {
    try {
      // entry: { res, userId }
      const sres = entry.res;
      const recipientId = entry.userId;
      // if senderId provided, respect blocks: don't deliver if recipient blocked sender or sender blocked recipient
      if (senderId && recipientId) {
        const db = readData();
        const blockedByRecipient = db.blocks.find(b => b.byUserId === recipientId && b.blockedUserId === senderId);
        const blockedBySender = db.blocks.find(b => b.byUserId === senderId && b.blockedUserId === recipientId);
        if (blockedByRecipient || blockedBySender) return; // skip
      }
      sres.write(payload);
    } catch (e) {}
  });
}

function getUserFromAuth(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload || !payload.userId) return null;
  const db = readData();
  const sess = db.sessions.find(s => s.token === token || s.access === token);
  if (!sess) return null;
  const user = db.users.find(u => u.id === payload.userId) || null;
  return user;
}

// Simple multipart/form-data parser for file uploads
function parseMultipartData(req, callback) {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(.+)/);
  if (!match) return callback(new Error('No boundary found'));
  
  const boundary = '--' + match[1];
  let data = Buffer.alloc(0);
  
  req.on('data', chunk => {
    data = Buffer.concat([data, chunk]);
    // Limit to 10MB
    if (data.length > 10 * 1024 * 1024) {
      req.connection.destroy();
      callback(new Error('File too large'));
    }
  });
  
  req.on('end', () => {
    try {
      const parts = [];
      const dataStr = data.toString('binary');
      const sections = dataStr.split(boundary);
      
      for (let i = 1; i < sections.length - 1; i++) {
        const section = sections[i];
        const headerEnd = section.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        
        const headers = section.substring(0, headerEnd);
        const content = section.substring(headerEnd + 4, section.length - 2);
        
        // Parse Content-Disposition header
        const nameMatch = headers.match(/name="([^"]+)"/);
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        
        if (filenameMatch) {
          // This is a file
          parts.push({
            fieldname: nameMatch ? nameMatch[1] : 'file',
            filename: filenameMatch[1],
            data: Buffer.from(content, 'binary')
          });
        }
      }
      
      callback(null, parts);
    } catch (e) {
      callback(e);
    }
  });
  
  req.on('error', callback);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    // normalize path and extract id if present
    const urlParts = req.url.split('?')[0].split('/'); // ['', 'api', 'records', '123', 'media']
    const [_, api, resource, maybeId, subResource] = urlParts;

    // resource can be records, users, posts, chat, live

    // GET /api/records
    // GET /api/records
    if (req.method === 'GET' && resource === 'records' && !maybeId) {
      const db = readData();
      sendJson(res, db.records);
      return;
    }

    // GET /api/records/:id
    if (req.method === 'GET' && resource === 'records' && maybeId && !subResource) {
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

    // ===== media endpoints for records =====
    // POST /api/records/:id/media - upload media file for a memorial
    if (req.method === 'POST' && resource === 'records' && maybeId && subResource === 'media') {
      const recordId = Number(maybeId);
      if (!Number.isFinite(recordId) || recordId <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      
      const db = readData();
      const record = db.records.find(r => r.id === recordId);
      if (!record) return sendJson(res, { error: 'record not found' }, 404);
      
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return sendJson(res, { error: 'content-type must be multipart/form-data' }, 415);
      }
      
      parseMultipartData(req, (err, files) => {
        if (err) {
          return sendJson(res, { error: err.message }, 400);
        }
        
        if (!files || files.length === 0) {
          return sendJson(res, { error: 'no file uploaded' }, 400);
        }
        
        const file = files[0];
        const fileExt = path.extname(file.filename);
        const fileId = crypto.randomBytes(16).toString('hex');
        const fileName = `${fileId}${fileExt}`;
        const filePath = path.join(UPLOADS_DIR, fileName);
        
        try {
          fs.writeFileSync(filePath, file.data);
          
          // Store media reference in database
          if (!db.media) db.media = [];
          const mediaId = (db.media.reduce((m, med) => Math.max(m, med.id || 0), 0) || 0) + 1;
          const media = {
            id: mediaId,
            recordId: recordId,
            filename: file.filename,
            storedFilename: fileName,
            size: file.data.length,
            mimetype: contentType.split(';')[0],
            createdAt: new Date().toISOString()
          };
          
          db.media.push(media);
          writeData(db);
          
          return sendJson(res, { id: media.id, filename: media.filename, size: media.size }, 201);
        } catch (e) {
          return sendJson(res, { error: 'failed to save file' }, 500);
        }
      });
      return;
    }

    // GET /api/records/:id/media - get media files for a memorial
    if (req.method === 'GET' && resource === 'records' && maybeId && subResource === 'media') {
      const recordId = Number(maybeId);
      if (!Number.isFinite(recordId) || recordId <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      
      const db = readData();
      const record = db.records.find(r => r.id === recordId);
      if (!record) return sendJson(res, { error: 'record not found' }, 404);
      
      const media = (db.media || []).filter(m => m.recordId === recordId);
      return sendJson(res, media);
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
          const existing = db.users.find(u => u.username === obj.username);
          if (existing) return sendJson(res, { error: 'username taken' }, 409);
          const now = new Date().toISOString();
          const hashed = hashPassword(obj.password);
          const id = (db.users.reduce((m, u) => Math.max(m, u.id || 0), 0) || 0) + 1;
          // allow creating public or private accounts (default public)
          const isPrivate = !!obj.private;
          const user = { id, username: obj.username, password: hashed, createdAt: now, private: isPrivate };
          db.users.push(user);
          writeData(db);
          return sendJson(res, { id: user.id, username: user.username, createdAt: now }, 201);
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
          const user = db.users.find(u => u.username === obj.username);
          if (!user || !verifyPassword(obj.password, user.password)) return sendJson(res, { error: 'invalid credentials' }, 401);
          const access = signToken({ userId: user.id }, 60*15); // 15m
          const refresh = crypto.randomBytes(24).toString('hex');
          db.sessions.push({ token: refresh, access, userId: user.id, createdAt: new Date().toISOString() });
          writeData(db);
          // tests expect { token: ... } for Authorization header
          return sendJson(res, { token: access });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // GET /api/users/:id - get user profile
    if (resource === 'users' && req.method === 'GET' && maybeId && maybeId !== 'login') {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      const db = readData();
      const user = db.users.find(u => u.id === id);
      if (!user) return sendJson(res, { error: 'user not found' }, 404);
      // Return public user info (exclude password and sensitive fields)
      const publicUser = {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
        private: user.private || false,
        suspended: user.suspended || false
      };
      return sendJson(res, publicUser);
    }

    // POST /api/users/reset-password - reset password (requires authentication)
    if (resource === 'users' && req.method === 'POST' && maybeId === 'reset-password') {
      const authUser = getUserFromAuth(req);
      if (!authUser) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.oldPassword || !obj.newPassword) return sendJson(res, { error: 'oldPassword and newPassword required' }, 400);
          const db = readData();
          const user = db.users.find(u => u.id === authUser.id);
          if (!user || !verifyPassword(obj.oldPassword, user.password)) return sendJson(res, { error: 'invalid old password' }, 401);
          // Update password
          user.password = hashPassword(obj.newPassword);
          writeData(db);
          return sendJson(res, { success: true, message: 'password updated' });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // ===== posts endpoints =====
    if (resource === 'posts' && req.method === 'GET' && !maybeId) {
      const db = readData();
      const authUser = getUserFromAuth(req);
      // filter out posts from private users unless requester is the owner
      const visible = (db.posts || []).filter(p => {
        const owner = db.users.find(u => u.id === p.userId);
        if (!owner) return true;
        // enforce blocks: if owner blocked requester or requester blocked owner, hide
        if (authUser && authUser.id) {
          const blockedByOwner = db.blocks.find(b => b.byUserId === owner.id && b.blockedUserId === authUser.id);
          const blockedByRequester = db.blocks.find(b => b.byUserId === authUser.id && b.blockedUserId === owner.id);
          if (blockedByOwner || blockedByRequester) return false;
        }
        if (!owner.private) return true;
        if (authUser && authUser.id === owner.id) return true;
        // allow followers to see private posts
        if (authUser) {
          const isFollower = db.followers.find(f => f.userId === owner.id && f.followerId === authUser.id);
          if (isFollower) return true;
        }
        return false;
      });
      return sendJson(res, visible);
    }

    // POST /api/users/:id/block  (or POST /api/users/block with { targetId })
    if (resource === 'users' && req.method === 'POST' && maybeId === 'block') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const targetId = Number(obj.targetId);
          if (!targetId) return sendJson(res, { error: 'targetId required' }, 400);
          const db = readData();
          const exists = db.users.find(u => u.id === targetId);
          if (!exists) return sendJson(res, { error: 'target not found' }, 404);
          const already = db.blocks.find(b => b.byUserId === user.id && b.blockedUserId === targetId);
          if (already) return sendJson(res, { blocked: true });
          db.blocks.push({ byUserId: user.id, blockedUserId: targetId, createdAt: new Date().toISOString() });
          writeData(db);
          return sendJson(res, { blocked: true });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // POST /api/users/unblock
    if (resource === 'users' && req.method === 'POST' && maybeId === 'unblock') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const targetId = Number(obj.targetId);
          if (!targetId) return sendJson(res, { error: 'targetId required' }, 400);
          const db = readData();
          const idx = db.blocks.findIndex(b => b.byUserId === user.id && b.blockedUserId === targetId);
          if (idx === -1) return sendJson(res, { blocked: false });
          db.blocks.splice(idx, 1);
          writeData(db);
          return sendJson(res, { blocked: false });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // POST /api/report
    if (resource === 'report' && req.method === 'POST') {
      const reporter = getUserFromAuth(req);
      if (!reporter) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const targetId = Number(obj.targetUserId);
          const categories = Array.isArray(obj.categories) ? obj.categories.slice(0,10) : [];
          const detail = (obj.detail || '').slice(0,2000);
          if (!targetId || categories.length === 0) return sendJson(res, { error: 'targetUserId and categories required' }, 400);
          // allowed categories: harassment, bullying, sexism, racism, derogatory, hate
          const allowed = ['harassment','bullying','sexism','racism','derogatory','hate'];
          const bad = categories.filter(c => !allowed.includes(c));
          if (bad.length) return sendJson(res, { error: 'invalid category', invalid: bad }, 400);
          const db = readData();
          const id = (db.reports.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
          const report = { id, reporterId: reporter.id, targetUserId: targetId, categories, detail, createdAt: new Date().toISOString() };
          db.reports.push(report);
          writeData(db);
          return sendJson(res, { reported: true, id }, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // follow: request/approve/deny
    if (resource === 'follow' && req.method === 'POST' && maybeId === 'request') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const targetId = Number(obj.targetId);
          if (!targetId) return sendJson(res, { error: 'targetId required' }, 400);
          const db = readData();
          const target = db.users.find(u => u.id === targetId);
          if (!target) return sendJson(res, { error: 'target not found' }, 404);
          if (!target.private) {
            db.followers.push({ userId: targetId, followerId: user.id });
            writeData(db);
            return sendJson(res, { followed: true }, 200);
          }
          const id = (db.followRequests.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
          const reqObj = { id, from: user.id, to: targetId, createdAt: new Date().toISOString() };
          db.followRequests.push(reqObj);
          writeData(db);
          return sendJson(res, { requested: true, requestId: id }, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    if (resource === 'follow' && req.method === 'POST' && maybeId === 'approve') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const requestId = Number(obj.requestId);
          if (!requestId) return sendJson(res, { error: 'requestId required' }, 400);
          const db = readData();
          const idx = db.followRequests.findIndex(r => r.id === requestId && r.to === user.id);
          if (idx === -1) return sendJson(res, { error: 'request not found' }, 404);
          const fr = db.followRequests.splice(idx, 1)[0];
          db.followers.push({ userId: fr.to, followerId: fr.from });
          writeData(db);
          return sendJson(res, { approved: true });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    if (resource === 'follow' && req.method === 'POST' && maybeId === 'deny') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const requestId = Number(obj.requestId);
          if (!requestId) return sendJson(res, { error: 'requestId required' }, 400);
          const db = readData();
          const idx = db.followRequests.findIndex(r => r.id === requestId && r.to === user.id);
          if (idx === -1) return sendJson(res, { error: 'request not found' }, 404);
          db.followRequests.splice(idx, 1);
          writeData(db);
          return sendJson(res, { denied: true });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // admin report actions
    if (resource === 'admin' && req.method === 'GET' && maybeId === 'reports') {
      // allow admin access either via admin token (user.admin) or adminSecret query param
      const db = readData();
      const url = new URL(req.url, `http://${req.headers.host}`);
      const secret = url.searchParams.get('adminSecret') || '';
      let isAdmin = false;
      // check Authorization
      const auth = req.headers['authorization'] || '';
      if (auth.startsWith('Bearer ')) {
        const payload = verifyToken(auth.slice(7));
        if (payload && payload.userId) {
          const u = db.users.find(x => x.id === payload.userId);
          if (u && u.admin) isAdmin = true;
        }
      }
      if (!isAdmin) isAdmin = secret === (process.env.ADMIN_SECRET || 'admin-secret');
      if (!isAdmin) return sendJson(res, { error: 'forbidden' }, 403);
      return sendJson(res, db.reports || []);
    }

    // POST /api/admin/promote { targetUserId } - promote a user to admin
    if (resource === 'admin' && req.method === 'POST' && maybeId === 'promote') {
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const secret = obj.adminSecret || '';
          const db = readData();
          let isAdmin = false;
          const auth = req.headers['authorization'] || '';
          if (auth.startsWith('Bearer ')) {
            const payload = verifyToken(auth.slice(7));
            if (payload && payload.userId) {
              const u = db.users.find(x => x.id === payload.userId);
              if (u && u.admin) isAdmin = true;
            }
          }
          if (!isAdmin && secret !== (process.env.ADMIN_SECRET || 'admin-secret')) return sendJson(res, { error: 'forbidden' }, 403);
          const targetId = Number(obj.targetUserId);
          if (!targetId) return sendJson(res, { error: 'targetUserId required' }, 400);
          const target = db.users.find(u => u.id === targetId);
          if (!target) return sendJson(res, { error: 'target not found' }, 404);
          target.admin = true;
          writeData(db);
          return sendJson(res, { promoted: targetId });
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    if (resource === 'admin' && req.method === 'POST' && maybeId === 'reports') {
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const secret = obj.adminSecret || '';
          // check admin token first
          const db = readData();
          let isAdmin = false;
          const auth = req.headers['authorization'] || '';
          if (auth.startsWith('Bearer ')) {
            const payload = verifyToken(auth.slice(7));
            if (payload && payload.userId) {
              const u = db.users.find(x => x.id === payload.userId);
              if (u && u.admin) isAdmin = true;
            }
          }
          if (!isAdmin && secret !== (process.env.ADMIN_SECRET || 'admin-secret')) return sendJson(res, { error: 'forbidden' }, 403);
          const action = obj.action;
          const reportId = Number(obj.reportId);
          const reportIdx = db.reports.findIndex(r => r.id === reportId);
          if (reportIdx === -1) return sendJson(res, { error: 'report not found' }, 404);
          const report = db.reports[reportIdx];
          if (action === 'suspend') {
            const target = db.users.find(u => u.id === report.targetUserId);
            if (target) target.suspended = true;
            writeData(db);
            return sendJson(res, { suspended: report.targetUserId });
          }
          if (action === 'resolve') {
            db.reports.splice(reportIdx, 1);
            writeData(db);
            return sendJson(res, { resolved: reportId });
          }
          return sendJson(res, { error: 'unknown action' }, 400);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    if (resource === 'posts' && req.method === 'POST' && !maybeId) {
      // authenticated
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      if (user.suspended) return sendJson(res, { error: 'suspended' }, 403);
      if ((req.headers['content-type'] || '').indexOf('application/json') !== 0) return sendJson(res, { error: 'content-type must be application/json' }, 415);
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.title && !obj.body) return sendJson(res, { error: 'title or body required' }, 400);
          const tags = Array.isArray(obj.tags) ? obj.tags.slice(0,10) : [];
          const mentions = Array.isArray(obj.mentions) ? obj.mentions.slice(0,10) : [];
          const now = new Date().toISOString();
          const db = readData();
          const id = (db.posts.reduce((m, p) => Math.max(m, p.id || 0), 0) || 0) + 1;
          const post = { id, userId: user.id, title: obj.title || '', body: obj.body || '', videoUrl: obj.videoUrl || '', tags, mentions, createdAt: now };
          db.posts.push(post);
          writeData(db);
          return sendJson(res, post, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // ===== chat endpoints (SSE + send) =====
    if (resource === 'chat' && req.method === 'GET' && maybeId === 'stream') {
      // SSE with optional room query param
      const url = new URL(req.url, `http://${req.headers.host}`);
      const room = url.searchParams.get('room') || 'global';
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('\n');
          sseClients[room] = sseClients[room] || [];
          // try to identify the connecting user from Authorization header
          let connUserId = null;
          try {
            const auth = req.headers['authorization'] || '';
            if (auth.startsWith('Bearer ')) {
              const payload = verifyToken(auth.slice(7));
              if (payload && payload.userId) connUserId = payload.userId;
            }
          } catch (e) {}
          const entry = { res, userId: connUserId };
          sseClients[room].push(entry);
          req.on('close', () => { const i = sseClients[room].indexOf(entry); if (i !== -1) sseClients[room].splice(i, 1); });
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
          const url = new URL(req.url, `http://${req.headers.host}`);
          const room = url.searchParams.get('room') || 'global';
    // identify sender if Authorization provided
    const sender = getUserFromAuth(req);
    if (sender && sender.suspended) return sendJson(res, { error: 'suspended' }, 403);
    const now = new Date().toISOString();
    const db = readData();
    const id = (db.chat.reduce((m, c) => Math.max(m, c.id || 0), 0) || 0) + 1;
    const msg = { id, user: obj.user, senderId: sender ? sender.id : null, message: obj.message, room, createdAt: now };
      db.chat.push(msg);
      writeData(db);
      broadcastEvent(room, 'message', msg, msg.senderId);
          return sendJson(res, msg, 201);
        } catch (e) { return sendJson(res, { error: 'invalid json' }, 400); }
      });
      return;
    }

    // ===== live endpoints =====
    if (resource === 'live' && req.method === 'POST' && maybeId === 'start') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      const streamKey = crypto.randomBytes(12).toString('hex');
      const now = new Date().toISOString();
      const db = readData();
      db.live = db.live || {};
      db.live[user.id] = { userId: user.id, streamKey, startedAt: now };
      writeData(db);
      return sendJson(res, { streamKey });
    }

    if (resource === 'live' && req.method === 'POST' && maybeId === 'stop') {
      const user = getUserFromAuth(req);
      if (!user) return sendJson(res, { error: 'unauthorized' }, 401);
      const db = readData();
      const info = db.live && db.live[user.id];
      if (db.live) delete db.live[user.id];
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
// initialize adapter asynchronously (won't block server start)
initDbAdapter().then(() => {
  console.log('dbAdapter ready (post-start):', dbAdapter.available());
}).catch((e) => {
  console.log('dbAdapter init failed (post-start):', e && e.message);
});

module.exports = server;
