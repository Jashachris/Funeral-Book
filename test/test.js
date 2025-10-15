const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = require('../server');
const base = 'http://localhost:3000';
const dataFile = path.join(__dirname, '..', 'data.json');
const sqliteFile = path.join(__dirname, '..', 'data.sqlite');

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
  // reset data.json for compatibility
  fs.writeFileSync(dataFile, JSON.stringify({ records: [], users: [], posts: [], chat: [], sessions: [], live: {}, blocks: [], reports: [], followRequests: [], followers: [], memorials: [], media: [] }));
  // also remove sqlite file if it exists to ensure clean state
  if (fs.existsSync(sqliteFile)) fs.unlinkSync(sqliteFile);

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

  // create a private user alice
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ username: 'alice', password: 'pw', private: true }));
  assert.strictEqual(r.statusCode, 201, 'register alice should return 201');
  const alice = JSON.parse(r.body);

  // bob requests to follow alice
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/follow/request', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ targetId: alice.id }));
  assert.ok(r.statusCode === 201 || r.statusCode === 200, 'follow request should return 201 or 200');
  const fr = JSON.parse(r.body);
  let requestId = fr.requestId || null;
  if (!requestId && fr.requested) {
    // find request id from data file
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const reqObj = data.followRequests.find(f => f.from === 1 && f.to === alice.id);
    requestId = reqObj && reqObj.id;
  }

  // login as alice
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/users/login', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ username: 'alice', password: 'pw' }));
  assert.strictEqual(r.statusCode, 200, 'alice login should return 200');
  const aliceToken = JSON.parse(r.body).token;

  // alice approves follow request
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/follow/approve', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${aliceToken}` } }, JSON.stringify({ requestId }));
  assert.strictEqual(r.statusCode, 200, 'approve should return 200');

  // bob can now see alice private posts (create one as alice then fetch as bob)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/posts', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${aliceToken}` } }, JSON.stringify({ title: 'Private note', body: 'Only followers' }));
  assert.strictEqual(r.statusCode, 201, 'alice create private post should return 201');
  const priv = JSON.parse(r.body);

  // bob fetch posts (auth)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/posts', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.statusCode, 200, 'GET posts should return 200');
  const posts = JSON.parse(r.body);
  const found = posts.find(p => p.id === priv.id);
  assert.ok(found, 'bob should see alice private post after approve');

  // bob reports alice
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/report', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ targetUserId: alice.id, categories: ['harassment'], detail: 'abusive' }));
  assert.strictEqual(r.statusCode, 201, 'report should return 201');
  const report = JSON.parse(r.body);

  // admin suspends alice
  // first, promote bob to admin using adminSecret
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/admin/promote', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ adminSecret: 'admin-secret', targetUserId: 1 }));
  assert.strictEqual(r.statusCode, 200, 'promote should return 200');

  r = await req({ hostname: 'localhost', port: 3000, path: '/api/admin/reports', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ action: 'suspend', reportId: report.id }));
  assert.strictEqual(r.statusCode, 200, 'admin suspend should return 200');

  // alice now cannot create posts
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/posts', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${aliceToken}` } }, JSON.stringify({ title: 'Nope', body: 'suspended' }));
  assert.strictEqual(r.statusCode, 403, 'suspended user cannot post');

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

  // ===== test memorials and media =====
  // create a memorial
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ name: 'John Doe Memorial', note: 'In loving memory' }));
  assert.strictEqual(r.statusCode, 201, 'create memorial should return 201');
  const memorial = JSON.parse(r.body);
  assert.strictEqual(memorial.name, 'John Doe Memorial');
  assert.ok(memorial.id, 'memorial should have an id');

  // get memorial without media
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET memorial should return 200');
  let memorialData = JSON.parse(r.body);
  assert.strictEqual(memorialData.name, 'John Doe Memorial');
  assert.ok(Array.isArray(memorialData.media), 'memorial should have media array');
  assert.strictEqual(memorialData.media.length, 0, 'memorial should have no media initially');

  // upload media metadata
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}/media`, method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ url: 'https://example.com/photo.jpg', type: 'image', thumbnailUrl: 'https://example.com/thumb.jpg', size: 1024000, external: false }));
  assert.strictEqual(r.statusCode, 201, 'upload media metadata should return 201');
  const media1 = JSON.parse(r.body);
  assert.strictEqual(media1.url, 'https://example.com/photo.jpg');
  assert.strictEqual(media1.type, 'image');
  assert.strictEqual(media1.memorialId, memorial.id);
  assert.strictEqual(media1.userId, 1);
  assert.ok(media1.id, 'media should have an id');

  // upload another media
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}/media`, method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ url: 'https://example.com/video.mp4', type: 'video', size: 5120000, external: true }));
  assert.strictEqual(r.statusCode, 201, 'upload second media metadata should return 201');
  const media2 = JSON.parse(r.body);
  assert.strictEqual(media2.type, 'video');
  assert.strictEqual(media2.external, true);

  // get memorial with media
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET memorial with media should return 200');
  memorialData = JSON.parse(r.body);
  assert.ok(Array.isArray(memorialData.media), 'memorial should have media array');
  assert.strictEqual(memorialData.media.length, 2, 'memorial should have 2 media items');
  assert.ok(memorialData.media.find(m => m.type === 'image'), 'should find image media');
  assert.ok(memorialData.media.find(m => m.type === 'video'), 'should find video media');

  // test media without authentication should fail
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}/media`, method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ url: 'https://example.com/test.jpg', type: 'image' }));
  assert.strictEqual(r.statusCode, 401, 'upload media without auth should return 401');

  console.log('All tests passed');
  server.close();
})();

