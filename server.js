const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function readData() {
  try {
    const s = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(s || '[]');
  } catch (e) {
    return [];
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
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

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    // normalize path and extract id if present
    const [_, api, resource, maybeId] = req.url.split('/'); // ['', 'api', 'records', '123']

    if (resource !== 'records') {
      res.writeHead(404); res.end('API not found');
      return;
    }

    // GET /api/records
    if (req.method === 'GET' && !maybeId) {
      const data = readData();
      sendJson(res, data);
      return;
    }

    // GET /api/records/:id
    if (req.method === 'GET' && maybeId) {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      const data = readData();
      const rec = data.find(r => r.id === id);
      if (!rec) return sendJson(res, { error: 'not found' }, 404);
      return sendJson(res, rec);
    }

    // POST /api/records
    if (req.method === 'POST' && !maybeId) {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          if (!obj.name) return sendJson(res, { error: 'name required' }, 400);
          const data = readData();
          const id = (data.reduce((m, r) => Math.max(m, r.id || 0), 0) || 0) + 1;
          const rec = { id, name: obj.name, note: obj.note || '', createdAt: new Date().toISOString() };
          data.push(rec);
          writeData(data);
          sendJson(res, rec, 201);
        } catch (e) {
          sendJson(res, { error: 'invalid json' }, 400);
        }
      });
      return;
    }

    // PUT /api/records/:id
    if (req.method === 'PUT' && maybeId) {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const data = readData();
          const idx = data.findIndex(r => r.id === id);
          if (idx === -1) return sendJson(res, { error: 'not found' }, 404);
          if (obj.name !== undefined) data[idx].name = obj.name;
          if (obj.note !== undefined) data[idx].note = obj.note;
          data[idx].updatedAt = new Date().toISOString();
          writeData(data);
          return sendJson(res, data[idx]);
        } catch (e) {
          return sendJson(res, { error: 'invalid json' }, 400);
        }
      });
      return;
    }

    // DELETE /api/records/:id
    if (req.method === 'DELETE' && maybeId) {
      const id = Number(maybeId);
      if (!Number.isFinite(id) || id <= 0) return sendJson(res, { error: 'invalid id' }, 400);
      const data = readData();
      const idx = data.findIndex(r => r.id === id);
      if (idx === -1) return sendJson(res, { error: 'not found' }, 404);
      const removed = data.splice(idx, 1)[0];
      writeData(data);
      return sendJson(res, removed);
    }

    res.writeHead(405); res.end('Method not allowed');
    return;
  }

  serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));

module.exports = server;
