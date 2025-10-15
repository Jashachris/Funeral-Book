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
  fs.writeFileSync(dataFile, JSON.stringify({ records: [], users: [], posts: [], chat: [], sessions: [], live: {}, blocks: [], reports: [], followRequests: [], followers: [], memorials: [] }));

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

  // ===== memorials endpoints tests =====
  // create a new user charlie for private memorial tests (alice is suspended)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ username: 'charlie', password: 'secret123' }));
  assert.strictEqual(r.statusCode, 201, 'register charlie should return 201');
  const charlie = JSON.parse(r.body);

  r = await req({ hostname: 'localhost', port: 3000, path: '/api/users/login', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ username: 'charlie', password: 'secret123' }));
  assert.strictEqual(r.statusCode, 200, 'charlie login should return 200');
  const charlieToken = JSON.parse(r.body).token;

  // POST create memorial (authenticated as bob)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ title: 'In Memory of John Doe', description: 'Beloved father', dateOfBirth: '1950-01-15', dateOfDeath: '2024-06-20', privacy: 'public', tags: ['family', 'father'] }));
  assert.strictEqual(r.statusCode, 201, 'create memorial should return 201');
  const memorial1 = JSON.parse(r.body);
  assert.strictEqual(memorial1.title, 'In Memory of John Doe');
  assert.strictEqual(memorial1.ownerId, bob.id);
  assert.strictEqual(memorial1.privacy, 'public');
  assert.ok(Array.isArray(memorial1.tags));
  assert.ok(memorial1.createdAt);

  // POST create memorial without auth should fail
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ title: 'Test' }));
  assert.strictEqual(r.statusCode, 401, 'create memorial without auth should return 401');

  // POST create memorial without title should fail
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ description: 'No title' }));
  assert.strictEqual(r.statusCode, 400, 'create memorial without title should return 400');

  // POST create private memorial (as charlie)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'POST', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${charlieToken}` } }, JSON.stringify({ title: 'Private Memorial', description: 'Private family only', privacy: 'private', tags: ['private'] }));
  assert.strictEqual(r.statusCode, 201, 'create private memorial should return 201');
  const privateMem = JSON.parse(r.body);
  assert.strictEqual(privateMem.privacy, 'private');
  assert.strictEqual(privateMem.ownerId, charlie.id);

  // GET /api/memorials (list - as bob)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.statusCode, 200, 'GET memorials should return 200');
  const memorials = JSON.parse(r.body);
  assert.ok(Array.isArray(memorials));
  // bob should see his own public memorial but not charlie's private one
  const bobMem = memorials.find(m => m.id === memorial1.id);
  assert.ok(bobMem, 'bob should see his own memorial');
  const charliePrivMem = memorials.find(m => m.id === privateMem.id);
  assert.ok(!charliePrivMem, 'bob should not see charlie private memorial');

  // GET /api/memorials (list - no auth)
  r = await req({ hostname: 'localhost', port: 3000, path: '/api/memorials', method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET memorials without auth should return 200');
  const publicMemorials = JSON.parse(r.body);
  assert.ok(Array.isArray(publicMemorials));
  // should only see public memorials
  const pubMem = publicMemorials.find(m => m.id === memorial1.id);
  assert.ok(pubMem, 'unauthenticated should see public memorial');
  const privMemInList = publicMemorials.find(m => m.id === privateMem.id);
  assert.ok(!privMemInList, 'unauthenticated should not see private memorial');

  // GET /api/memorials/:id (single memorial - public)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 200, 'GET public memorial by id should return 200');
  const fetchedMem = JSON.parse(r.body);
  assert.strictEqual(fetchedMem.id, memorial1.id);

  // GET /api/memorials/:id (private memorial as owner - charlie)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${privateMem.id}`, method: 'GET', headers: { Authorization: `Bearer ${charlieToken}` } });
  assert.strictEqual(r.statusCode, 200, 'GET private memorial as owner should return 200');

  // GET /api/memorials/:id (private memorial as non-owner - bob)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${privateMem.id}`, method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.statusCode, 403, 'GET private memorial as non-owner should return 403');

  // GET /api/memorials/:id (private memorial without auth)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${privateMem.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 403, 'GET private memorial without auth should return 403');

  // PUT /api/memorials/:id (update as owner)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` } }, JSON.stringify({ description: 'Updated description', tags: ['updated'] }));
  assert.strictEqual(r.statusCode, 200, 'PUT memorial as owner should return 200');
  const updatedMem = JSON.parse(r.body);
  assert.strictEqual(updatedMem.description, 'Updated description');
  assert.strictEqual(updatedMem.tags[0], 'updated');
  assert.ok(updatedMem.updatedAt);

  // PUT /api/memorials/:id (update as non-owner should fail)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: `Bearer ${charlieToken}` } }, JSON.stringify({ description: 'Hacked' }));
  assert.strictEqual(r.statusCode, 403, 'PUT memorial as non-owner should return 403');

  // PUT /api/memorials/:id (update without auth should fail)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'PUT', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ description: 'Hacked' }));
  assert.strictEqual(r.statusCode, 401, 'PUT memorial without auth should return 401');

  // DELETE /api/memorials/:id (delete as non-owner should fail)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'DELETE', headers: { Authorization: `Bearer ${charlieToken}` } });
  assert.strictEqual(r.statusCode, 403, 'DELETE memorial as non-owner should return 403');

  // DELETE /api/memorials/:id (delete without auth should fail)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'DELETE' });
  assert.strictEqual(r.statusCode, 401, 'DELETE memorial without auth should return 401');

  // DELETE /api/memorials/:id (delete as owner)
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  assert.strictEqual(r.statusCode, 200, 'DELETE memorial as owner should return 200');
  const deleted = JSON.parse(r.body);
  assert.strictEqual(deleted.id, memorial1.id);

  // GET memorial after delete should return 404
  r = await req({ hostname: 'localhost', port: 3000, path: `/api/memorials/${memorial1.id}`, method: 'GET' });
  assert.strictEqual(r.statusCode, 404, 'GET deleted memorial should return 404');

  console.log('All tests passed');
  server.close();
})();

