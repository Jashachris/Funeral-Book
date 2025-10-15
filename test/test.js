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
  // reset data.json for compatibility
  fs.writeFileSync(dataFile, JSON.stringify({ records: [], users: [], posts: [], chat: [], sessions: [], live: {}, blocks: [], reports: [], followRequests: [], followers: [], media: [] }));

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

  // test memorial media endpoints
  // create a memorial (using records endpoint)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/records', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ name: 'Test Memorial', note: 'For media testing' }));
  assert.strictEqual(r.statusCode, 201, 'create memorial should return 201');
  const memorial = JSON.parse(r.body);

  // add external media URL to memorial
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}/media`, method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ url: 'https://example.com/photo.jpg', type: 'photo' }));
  assert.strictEqual(r.statusCode, 201, 'add external media should return 201');
  const media = JSON.parse(r.body);
  assert.strictEqual(media.memorialId, memorial.id, 'media should be linked to memorial');
  assert.strictEqual(media.url, 'https://example.com/photo.jpg', 'media url should match');
  assert.strictEqual(media.type, 'photo', 'media type should match');
  assert.strictEqual(media.external, true, 'media should be marked as external');

  // get memorial and verify media is included
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET memorial should return 200');
  const memorialWithMedia = JSON.parse(r.body);
  assert.ok(Array.isArray(memorialWithMedia.media), 'memorial should have media array');
  assert.strictEqual(memorialWithMedia.media.length, 1, 'memorial should have 1 media item');
  assert.strictEqual(memorialWithMedia.media[0].url, 'https://example.com/photo.jpg', 'media url should be included');

  // test invalid URL rejection
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial.id}/media`, method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ url: 'not-a-valid-url' }));
  assert.strictEqual(r.statusCode, 400, 'invalid url format should return 400');

  // test non-existent memorial
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials/99999/media', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ url: 'https://example.com/test.jpg' }));
  assert.strictEqual(r.statusCode, 404, 'non-existent memorial should return 404');

  console.log('All tests passed');
  server.close();
})();

