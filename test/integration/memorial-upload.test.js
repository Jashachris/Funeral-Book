const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = require('../../server');
const dataFile = path.join(__dirname, '..', '..', 'data.json');
const sqliteFile = path.join(__dirname, '..', '..', 'data.sqlite');
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(opts, res => {
      let s=''; res.on('data', c=>s+=c); res.on('end', ()=> resolve({ statusCode: res.statusCode, body: s, headers: res.headers }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

// Helper to create multipart form data with a file
function createMultipartBody(fields, files) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let body = '';
  
  // Add fields
  for (const [name, value] of Object.entries(fields || {})) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
    body += `${value}\r\n`;
  }
  
  // Add files
  for (const file of files || []) {
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${file.fieldname}"; filename="${file.filename}"\r\n`;
    body += `Content-Type: ${file.mimetype || 'application/octet-stream'}\r\n\r\n`;
    body += file.data;
    body += '\r\n';
  }
  
  body += `--${boundary}--\r\n`;
  
  return { body, boundary };
}

async function runMemorialUploadTests() {
  console.log('\n=== Memorial Upload Integration Tests ===\n');
  
  // Reset data - both JSON and SQLite if present
  fs.writeFileSync(dataFile, JSON.stringify({ 
    records: [], users: [], posts: [], chat: [], sessions: [], 
    live: {}, blocks: [], reports: [], followRequests: [], followers: [], media: [] 
  }));
  
  // Remove SQLite file if exists to ensure clean state
  if (fs.existsSync(sqliteFile)) {
    fs.unlinkSync(sqliteFile);
  }
  
  // Clean uploads directory
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file !== 'README.md') {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
  }

  // Test 1: Create a temp user
  console.log('Test: Create temp user...');
  let r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'memorialtest', password: 'testpass123' }));
  
  assert.strictEqual(r.statusCode, 201, 'user creation should return 201');
  const user = JSON.parse(r.body);
  assert.ok(user.id, 'user should have id');
  console.log('✓ Temp user created');

  // Test 2: Login to get token
  console.log('\nTest: Login temp user...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users/login', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'memorialtest', password: 'testpass123' }));
  
  assert.strictEqual(r.statusCode, 200, 'login should return 200');
  const loginResp = JSON.parse(r.body);
  assert.ok(loginResp.token, 'login response should contain token');
  console.log('✓ User logged in');

  // Test 3: Create a memorial (record)
  console.log('\nTest: Create memorial...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/records', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ name: 'John Doe', note: 'In loving memory' }));
  
  assert.strictEqual(r.statusCode, 201, 'memorial creation should return 201');
  const memorial = JSON.parse(r.body);
  assert.ok(memorial.id, 'memorial should have id');
  assert.strictEqual(memorial.name, 'John Doe', 'memorial should have correct name');
  console.log('✓ Memorial created with ID:', memorial.id);

  // Test 4: Upload a small test file to the memorial
  console.log('\nTest: Upload media file to memorial...');
  const testFileContent = 'This is a test image file content for memorial upload test';
  const multipart = createMultipartBody({}, [{
    fieldname: 'file',
    filename: 'test-photo.jpg',
    mimetype: 'image/jpeg',
    data: testFileContent
  }]);
  
  r = await req({ 
    hostname: 'localhost', port: 3000, 
    path: `/api/records/${memorial.id}/media`, 
    method: 'POST', 
    headers: { 
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
      'Content-Length': Buffer.byteLength(multipart.body)
    } 
  }, multipart.body);
  
  assert.strictEqual(r.statusCode, 201, 'media upload should return 201');
  const uploadResp = JSON.parse(r.body);
  assert.ok(uploadResp.id, 'upload response should contain media id');
  assert.strictEqual(uploadResp.filename, 'test-photo.jpg', 'upload response should contain filename');
  assert.ok(uploadResp.size > 0, 'upload response should contain file size');
  console.log('✓ Media file uploaded with ID:', uploadResp.id);

  // Test 5: Fetch memorial media and assert it exists
  console.log('\nTest: Fetch memorial media...');
  r = await req({ 
    hostname: 'localhost', port: 3000, 
    path: `/api/records/${memorial.id}/media`, 
    method: 'GET'
  });
  
  assert.strictEqual(r.statusCode, 200, 'fetch media should return 200');
  const mediaList = JSON.parse(r.body);
  assert.ok(Array.isArray(mediaList), 'media list should be an array');
  assert.strictEqual(mediaList.length, 1, 'should have one media item');
  assert.strictEqual(mediaList[0].filename, 'test-photo.jpg', 'media should have correct filename');
  assert.strictEqual(mediaList[0].recordId, memorial.id, 'media should be linked to memorial');
  assert.ok(mediaList[0].createdAt, 'media should have createdAt timestamp');
  console.log('✓ Memorial media retrieved successfully');

  // Test 6: Verify uploaded file exists on disk
  console.log('\nTest: Verify file exists on disk...');
  const uploadedFiles = fs.readdirSync(uploadsDir).filter(f => f !== 'README.md');
  assert.strictEqual(uploadedFiles.length, 1, 'should have one uploaded file');
  const uploadedFilePath = path.join(uploadsDir, uploadedFiles[0]);
  assert.ok(fs.existsSync(uploadedFilePath), 'uploaded file should exist');
  const fileContent = fs.readFileSync(uploadedFilePath, 'utf8');
  assert.strictEqual(fileContent, testFileContent, 'file content should match uploaded content');
  console.log('✓ Uploaded file verified on disk');

  // Test 7: Upload to non-existent memorial should fail
  console.log('\nTest: Upload to non-existent memorial...');
  const multipart2 = createMultipartBody({}, [{
    fieldname: 'file',
    filename: 'test2.jpg',
    mimetype: 'image/jpeg',
    data: 'test content'
  }]);
  
  r = await req({ 
    hostname: 'localhost', port: 3000, 
    path: '/api/records/99999/media', 
    method: 'POST', 
    headers: { 
      'Content-Type': `multipart/form-data; boundary=${multipart2.boundary}`,
      'Content-Length': Buffer.byteLength(multipart2.body)
    } 
  }, multipart2.body);
  
  assert.strictEqual(r.statusCode, 404, 'upload to non-existent memorial should return 404');
  console.log('✓ Upload to non-existent memorial rejected');

  // Test 8: Fetch media for non-existent memorial should fail
  console.log('\nTest: Fetch media for non-existent memorial...');
  r = await req({ 
    hostname: 'localhost', port: 3000, 
    path: '/api/records/99999/media', 
    method: 'GET'
  });
  
  assert.strictEqual(r.statusCode, 404, 'fetch media for non-existent memorial should return 404');
  console.log('✓ Fetch for non-existent memorial rejected');

  console.log('\n✓ All memorial upload integration tests passed!\n');
}

// Export for main test runner
module.exports = { runMemorialUploadTests };

// Run if executed directly
if (require.main === module) {
  runMemorialUploadTests().then(() => {
    server.close();
    process.exit(0);
  }).catch(err => {
    console.error('Test failed:', err);
    server.close();
    process.exit(1);
  });
}
