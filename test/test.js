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
  fs.writeFileSync(dataFile, '[]');

  // POST a record
  let r = await req({ hostname: 'localhost', port: 3000, path: '/api/records', method: 'POST', headers: { 'Content-Type':'application/json' } }, JSON.stringify({ name: 'Alice', note: 'Beloved' }));
  assert.strictEqual(r.statusCode, 201, 'POST should return 201');
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

  console.log('All tests passed');
  server.close();
})();
