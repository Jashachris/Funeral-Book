const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = require('../server');
const dataFile = path.join(__dirname, '..', 'data.json');
const sqliteFile = path.join(__dirname, '..', 'data.sqlite');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let s=''; res.on('data', c=>s+=c); res.on('end', ()=> resolve({ statusCode: res.statusCode, body: s, headers: res.headers }));
    });
    r.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        r.write(body);
      } else {
        r.write(body);
      }
    }
    r.end();
  });
}

function createMultipartBody(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
  const parts = [];
  
  // Add fields
  for (const [name, value] of Object.entries(fields || {})) {
    parts.push(
      `------WebKitFormBoundary${boundary.slice(28)}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    );
  }
  
  // Add files
  for (const [name, file] of Object.entries(files || {})) {
    parts.push(
      `------WebKitFormBoundary${boundary.slice(28)}\r\n` +
      `Content-Disposition: form-data; name="${name}"; filename="${file.filename}"\r\n` +
      `Content-Type: ${file.contentType || 'application/octet-stream'}\r\n\r\n`
    );
    parts.push(file.data);
    parts.push('\r\n');
  }
  
  parts.push(`------WebKitFormBoundary${boundary.slice(28)}--\r\n`);
  
  return {
    boundary: `----WebKitFormBoundary${boundary.slice(28)}`,
    body: Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p)))
  };
}

(async ()=>{
  // reset data - both JSON and SQLite
  fs.writeFileSync(dataFile, JSON.stringify({ 
    records: [], 
    users: [], 
    posts: [], 
    chat: [], 
    sessions: [], 
    live: {}, 
    blocks: [], 
    reports: [], 
    followRequests: [], 
    followers: [],
    memorials: []
  }));
  // Remove SQLite file to ensure clean state
  if (fs.existsSync(sqliteFile)) {
    fs.unlinkSync(sqliteFile);
  }

  console.log('=== Memorial Integration Test ===');

  // 1. Create a temp user
  console.log('1. Creating temp user...');
  let r = await req({ 
    hostname: 'localhost', 
    port: 3000, 
    path: '/api/users', 
    method: 'POST', 
    headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'testuser', password: 'testpass' }));
  assert.strictEqual(r.statusCode, 201, 'user creation should return 201');
  const user = JSON.parse(r.body);
  console.log('✓ User created:', user.username);

  // 2. Login to get token
  console.log('2. Logging in...');
  r = await req({ 
    hostname: 'localhost', 
    port: 3000, 
    path: '/api/users/login', 
    method: 'POST', 
    headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'testuser', password: 'testpass' }));
  assert.strictEqual(r.statusCode, 200, 'login should return 200');
  const token = JSON.parse(r.body).token;
  console.log('✓ Logged in successfully');

  // 3. Create a memorial
  console.log('3. Creating memorial...');
  r = await req({ 
    hostname: 'localhost', 
    port: 3000, 
    path: '/api/memorials', 
    method: 'POST', 
    headers: { 
      'Content-Type':'application/json',
      'Authorization': `Bearer ${token}`
    } 
  }, JSON.stringify({ 
    name: 'John Doe', 
    bio: 'A beloved father and friend' 
  }));
  assert.strictEqual(r.statusCode, 201, 'memorial creation should return 201');
  const memorial = JSON.parse(r.body);
  assert.strictEqual(memorial.name, 'John Doe');
  assert.ok(memorial.id, 'memorial should have an id');
  console.log('✓ Memorial created:', memorial.name, '(ID:', memorial.id + ')');

  // 4. Upload a small file
  console.log('4. Uploading test file...');
  const testFileContent = 'This is a test memorial photo file content';
  const multipart = createMultipartBody({}, {
    file: {
      filename: 'test-photo.txt',
      contentType: 'text/plain',
      data: Buffer.from(testFileContent)
    }
  });

  r = await req({ 
    hostname: 'localhost', 
    port: 3000, 
    path: `/api/memorials/${memorial.id}/media`, 
    method: 'POST', 
    headers: { 
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
      'Authorization': `Bearer ${token}`
    } 
  }, multipart.body);
  assert.strictEqual(r.statusCode, 201, 'file upload should return 201');
  const uploadedMedia = JSON.parse(r.body);
  assert.ok(uploadedMedia.url, 'uploaded media should have a url');
  assert.ok(uploadedMedia.filename, 'uploaded media should have a filename');
  console.log('✓ File uploaded:', uploadedMedia.url);

  // 5. Fetch memorial and assert media is returned
  console.log('5. Fetching memorial to verify media...');
  r = await req({ 
    hostname: 'localhost', 
    port: 3000, 
    path: `/api/memorials/${memorial.id}`, 
    method: 'GET'
  });
  assert.strictEqual(r.statusCode, 200, 'GET memorial should return 200');
  const fetchedMemorial = JSON.parse(r.body);
  assert.strictEqual(fetchedMemorial.name, 'John Doe');
  assert.ok(Array.isArray(fetchedMemorial.media), 'memorial should have media array');
  assert.strictEqual(fetchedMemorial.media.length, 1, 'memorial should have 1 media item');
  assert.strictEqual(fetchedMemorial.media[0].originalName, 'test-photo.txt');
  console.log('✓ Memorial fetched with media:', fetchedMemorial.media[0].originalName);

  // 6. Verify the uploaded file can be accessed
  console.log('6. Verifying uploaded file can be accessed...');
  r = await req({ 
    hostname: 'localhost', 
    port: 3000, 
    path: uploadedMedia.url, 
    method: 'GET'
  });
  assert.strictEqual(r.statusCode, 200, 'GET uploaded file should return 200');
  assert.strictEqual(r.body, testFileContent, 'file content should match');
  console.log('✓ File accessible and content verified');

  console.log('\n=== All Memorial Integration Tests Passed ✓ ===\n');
  server.close();
})();
