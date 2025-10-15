const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const server = require('../../server');
const dataFile = path.join(__dirname, '..', '..', 'data.json');

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

async function runAuthTests() {
  console.log('\n=== Auth Integration Tests ===\n');
  
  // Reset data
  fs.writeFileSync(dataFile, JSON.stringify({ 
    records: [], users: [], posts: [], chat: [], sessions: [], 
    live: {}, blocks: [], reports: [], followRequests: [], followers: [] 
  }));

  // Test 1: User signup with valid credentials
  console.log('Test: User signup with valid credentials...');
  let r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'testuser', password: 'testpass123' }));
  
  assert.strictEqual(r.statusCode, 201, 'signup should return 201');
  const user = JSON.parse(r.body);
  assert.ok(user.id, 'response should contain user id');
  assert.strictEqual(user.username, 'testuser', 'response should contain username');
  assert.ok(user.createdAt, 'response should contain createdAt');
  assert.strictEqual(user.password, undefined, 'response should not expose password');
  console.log('✓ User signup successful');

  // Test 2: Signup with duplicate username
  console.log('\nTest: Signup with duplicate username...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'testuser', password: 'anotherpass' }));
  
  assert.strictEqual(r.statusCode, 409, 'duplicate username should return 409');
  const errorResp = JSON.parse(r.body);
  assert.ok(errorResp.error, 'response should contain error message');
  console.log('✓ Duplicate username rejected');

  // Test 3: Signup with missing credentials
  console.log('\nTest: Signup with missing credentials...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'onlyusername' }));
  
  assert.strictEqual(r.statusCode, 400, 'missing password should return 400');
  console.log('✓ Missing credentials rejected');

  // Test 4: Login with valid credentials
  console.log('\nTest: Login with valid credentials...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users/login', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'testuser', password: 'testpass123' }));
  
  assert.strictEqual(r.statusCode, 200, 'login should return 200');
  const loginResp = JSON.parse(r.body);
  assert.ok(loginResp.token, 'login response should contain token');
  const token = loginResp.token;
  
  // Verify token format
  assert.ok(token.includes('.'), 'token should have correct format');
  console.log('✓ Login successful with valid token');

  // Test 5: Login with invalid credentials
  console.log('\nTest: Login with invalid credentials...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users/login', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'testuser', password: 'wrongpassword' }));
  
  assert.strictEqual(r.statusCode, 401, 'wrong password should return 401');
  console.log('✓ Invalid credentials rejected');

  // Test 6: Login with non-existent user
  console.log('\nTest: Login with non-existent user...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users/login', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'nonexistent', password: 'anypass' }));
  
  assert.strictEqual(r.statusCode, 401, 'non-existent user should return 401');
  console.log('✓ Non-existent user rejected');

  // Test 7: Create private account
  console.log('\nTest: Create private account...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/users', 
    method: 'POST', headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ username: 'privateuser', password: 'secret', private: true }));
  
  assert.strictEqual(r.statusCode, 201, 'private account creation should return 201');
  const privateUser = JSON.parse(r.body);
  assert.ok(privateUser.id, 'private user should have id');
  
  // Verify in data that the user is marked as private
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const storedUser = data.users.find(u => u.username === 'privateuser');
  assert.strictEqual(storedUser.private, true, 'user should be marked as private in database');
  console.log('✓ Private account created successfully');

  // Test 8: Authenticated request with token
  console.log('\nTest: Use token for authenticated request...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/posts', 
    method: 'POST', 
    headers: { 
      'Content-Type':'application/json',
      'Authorization': `Bearer ${token}`
    } 
  }, JSON.stringify({ title: 'Test Post', body: 'This is a test post' }));
  
  assert.strictEqual(r.statusCode, 201, 'authenticated request should succeed');
  const post = JSON.parse(r.body);
  assert.strictEqual(post.title, 'Test Post', 'post should be created');
  console.log('✓ Authenticated request successful');

  // Test 9: Request without token (when auth required)
  console.log('\nTest: Request without authentication token...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/posts', 
    method: 'POST', 
    headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ title: 'Test Post', body: 'This is a test post' }));
  
  // This should still work because posts can be created without auth in current implementation
  // But let's test a truly auth-required endpoint like follow
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/follow/request', 
    method: 'POST', 
    headers: { 'Content-Type':'application/json' } 
  }, JSON.stringify({ targetId: 2 }));
  
  assert.strictEqual(r.statusCode, 401, 'follow request without auth should return 401');
  console.log('✓ Unauthenticated request rejected');

  // Test 10: Invalid token format
  console.log('\nTest: Request with invalid token...');
  r = await req({ 
    hostname: 'localhost', port: 3000, path: '/api/follow/request', 
    method: 'POST', 
    headers: { 
      'Content-Type':'application/json',
      'Authorization': 'Bearer invalidtoken'
    } 
  }, JSON.stringify({ targetId: 2 }));
  
  assert.strictEqual(r.statusCode, 401, 'invalid token should return 401');
  console.log('✓ Invalid token rejected');

  console.log('\n✓ All auth integration tests passed!\n');
}

// Export for main test runner
module.exports = { runAuthTests };

// Run if executed directly
if (require.main === module) {
  runAuthTests().then(() => {
    server.close();
    process.exit(0);
  }).catch(err => {
    console.error('Test failed:', err);
    server.close();
    process.exit(1);
  });
}
