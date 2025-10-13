const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = require('../server');
const base = 'http://localhost:3000';
const dataFile = path.join(__dirname, '..', 'data.json');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let s=''; res.on('data', c=>s+=c); res.on('end', ()=> resolve({ statusCode: res.statusCode, body: s }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

(async ()=>{
  // reset data
  fs.writeFileSync(dataFile, JSON.stringify({ records: [], users: [], posts: [], chat: [], sessions: [], live: {} }));

  // register user
  let r = await req({ hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ username: 'bob', password: 'secret' }));
  assert.strictEqual(r.statusCode, 201, 'register should return 201');
  const bob = JSON.parse(r.body);

  // login
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/users/login', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ username: 'bob', password: 'secret' }));
  assert.strictEqual(r.statusCode, 200, 'login should return 200');
  const token = JSON.parse(r.body).token;

  // POST a record
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/records', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ name: 'Alice', note: 'Beloved' }));
  assert.strictEqual(r.statusCode, 201, 'POST record should return 201');
  const created = JSON.parse(r.body);
  assert.strictEqual(created.name, 'Alice');

  // GET records
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/records', method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET should return 200');
  const arr = JSON.parse(r.body);
  assert.ok(Array.isArray(arr) && arr.length === 1, 'one record should exist');

  // GET by id
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/records/${created.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET /:id should return 200');
  const one = JSON.parse(r.body);
  assert.strictEqual(one.name, 'Alice');

  // PUT update
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/records/${created.id}`, method: 'PUT', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ note: 'Updated note' }));
  assert.strictEqual(r.statusCode, 200, 'PUT should return 200');
  const updated = JSON.parse(r.body);
  assert.strictEqual(updated.note, 'Updated note');

  // DELETE
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/records/${created.id}`, method: 'DELETE' });
  assert.strictEqual(r.statusCode, 200, 'DELETE should return 200');

  // GET after delete
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/records', method: 'GET' });
  const arr2 = JSON.parse(r.body);
  assert.ok(Array.isArray(arr2) && arr2.length === 0, 'no records should remain');

  // create a post (authenticated)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/posts', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ title: 'Hello', body: 'Test post', videoUrl: 'https://example.com/video.mp4' }));
  assert.strictEqual(r.statusCode, 201, 'create post should return 201');
  const post = JSON.parse(r.body);
  assert.strictEqual(post.title, 'Hello');

  // send chat message
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/chat/send', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ user: 'bob', message: 'hi all' }));
  assert.strictEqual(r.statusCode, 201, 'chat send should return 201');

  // start live
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/live/start', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({}));
  assert.strictEqual(r.statusCode, 200, 'live start should return 200');
  const sk = JSON.parse(r.body).streamKey;
  assert.ok(sk && typeof sk === 'string');

  // stop live
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/live/stop', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({}));
  assert.strictEqual(r.statusCode, 200, 'live stop should return 200');

  console.log('All tests passed');
  server.close();
})();

