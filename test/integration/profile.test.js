const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = require('../../server');
const dataFile = path.join(__dirname, '..', '..', 'data.json');
const sqliteFile = path.join(__dirname, '..', '..', 'data.sqlite');

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

async function runProfileTests() {
  console.log('\n=== Profile Integration Tests ===\n');
  
  // Reset data - both JSON and SQLite if present
  fs.writeFileSync(dataFile, JSON.stringify({ 
    records: [], users: [], posts: [], chat: [], sessions: [], 
    live: {}, blocks: [], reports: [], followRequests: [], followers: [] 
  }));
  // Remove SQLite file if exists to ensure clean state
  if (fs.existsSync(sqliteFile)) {
    fs.unlinkSync(sqliteFile);
  }

  // Create a test user
  console.log('Setup: Creating test user...');
  let r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'profileuser', password: 'testpass123' }));
  
  assert.strictEqual(r.statusCode, 201, 'user creation should succeed');
  const user = JSON.parse(r.body);
  const userId = user.id;
  console.log('✓ Test user created');

  // Test 1: Get user profile by ID
  console.log('\nTest: Get user profile by ID...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: `/api/users/${userId}`, 
    method: 'GET'
  });
  
  assert.strictEqual(r.statusCode, 200, 'profile retrieval should return 200');
  const profile = JSON.parse(r.body);
  assert.strictEqual(profile.id, userId, 'profile should contain correct user id');
  assert.strictEqual(profile.username, 'profileuser', 'profile should contain username');
  assert.ok(profile.createdAt, 'profile should contain createdAt');
  assert.strictEqual(profile.password, undefined, 'profile should not expose password');
  assert.strictEqual(profile.private, false, 'default user should be public');
  console.log('✓ User profile retrieved successfully');

  // Test 2: Get non-existent user profile
  console.log('\nTest: Get non-existent user profile...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users/99999', 
    method: 'GET'
  });
  
  assert.strictEqual(r.statusCode, 404, 'non-existent user should return 404');
  const errorResp = JSON.parse(r.body);
  assert.ok(errorResp.error, 'response should contain error message');
  console.log('✓ Non-existent user profile returns 404');

  // Test 3: Invalid user ID format
  console.log('\nTest: Invalid user ID format...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users/invalid', 
    method: 'GET'
  });
  
  assert.strictEqual(r.statusCode, 400, 'invalid id should return 400');
  console.log('✓ Invalid user ID rejected');

  // Test 4: Create and retrieve private user profile
  console.log('\nTest: Create and retrieve private user profile...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'privateprofileuser', password: 'secret', private: true }));
  
  assert.strictEqual(r.statusCode, 201, 'private user creation should succeed');
  const privateUser = JSON.parse(r.body);
  const privateUserId = privateUser.id;
  
  r = await req({ 
    hostname: 'localhost', port: 3000, path: `/api/users/${privateUserId}`, 
    method: 'GET'
  });
  
  assert.strictEqual(r.statusCode, 200, 'private profile retrieval should succeed');
  const privateProfile = JSON.parse(r.body);
  assert.strictEqual(privateProfile.private, true, 'profile should indicate user is private');
  assert.strictEqual(privateProfile.password, undefined, 'profile should not expose password');
  console.log('✓ Private user profile retrieved with correct privacy flag');

  // Test 5: Profile should not expose sensitive data
  console.log('\nTest: Profile excludes sensitive data...');
  
  // Fetch profile and verify sensitive data is excluded
  r = await req({ 
    hostname: 'localhost', port: 3000, path: `/api/users/${userId}`, 
    method: 'GET'
  });
  
  const publicProfile = JSON.parse(r.body);
  assert.strictEqual(publicProfile.password, undefined, 'password should not be in response');
  
  // Verify only public fields are present
  const allowedFields = ['id', 'username', 'createdAt', 'private', 'suspended'];
  const responseFields = Object.keys(publicProfile);
  responseFields.forEach(field => {
    assert.ok(allowedFields.includes(field), `field ${field} should be allowed in profile`);
  });
  console.log('✓ Profile correctly excludes sensitive data');

  console.log('\n✓ All profile integration tests passed!\n');
}

// Export for main test runner
module.exports = { runProfileTests };

// Run if executed directly
if (require.main === module) {
  runProfileTests().then(() => {
    server.close();
    process.exit(0);
  }).catch(err => {
    console.error('Test failed:', err);
    server.close();
    process.exit(1);
  });
}
