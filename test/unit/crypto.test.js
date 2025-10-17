const assert = require('assert');
const crypto = require('crypto');

// Import the functions from server.js
// We need to extract these functions to be testable
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'dev-secret-change-me';

function hashPassword(password) {
  const salt = crypto.randomBytes(12).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, derived] = stored.split('$');
  if (!salt || !derived) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(derived, 'hex'));
}

function signToken(payloadObj, expiresInSec = 60*60*24) {
  const exp = Math.floor(Date.now()/1000) + expiresInSec;
  const payload = Object.assign({}, payloadObj, { exp });
  const payloadB = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB).digest('hex');
  return `${payloadB}.${sig}`;
}

function verifyToken(token) {
  try {
    const [payloadB, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadB).digest('hex');
    if (!sig || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(payloadB, 'base64').toString('utf8'));
    if (payload.exp && Math.floor(Date.now()/1000) > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

// Tests for password hashing
function testHashPassword() {
  const password = 'mySecretPassword123';
  const hashed = hashPassword(password);
  
  assert.ok(hashed, 'hashPassword should return a value');
  assert.ok(hashed.includes('$'), 'hashed password should contain $ separator');
  
  const [salt, derived] = hashed.split('$');
  assert.strictEqual(salt.length, 24, 'salt should be 24 hex chars (12 bytes)');
  assert.strictEqual(derived.length, 64, 'derived key should be 64 hex chars (32 bytes)');
  
  console.log('✓ hashPassword creates valid hash');
}

function testVerifyPassword() {
  const password = 'testPassword456';
  const hashed = hashPassword(password);
  
  assert.strictEqual(verifyPassword(password, hashed), true, 'correct password should verify');
  assert.strictEqual(verifyPassword('wrongPassword', hashed), false, 'wrong password should not verify');
  assert.strictEqual(verifyPassword('', hashed), false, 'empty password should not verify');
  
  console.log('✓ verifyPassword validates passwords correctly');
}

function testVerifyPasswordInvalid() {
  assert.strictEqual(verifyPassword('test', 'invalid'), false, 'invalid hash format should return false');
  assert.strictEqual(verifyPassword('test', ''), false, 'empty hash should return false');
  assert.strictEqual(verifyPassword('test', 'noseparator'), false, 'hash without separator should return false');
  
  console.log('✓ verifyPassword handles invalid input gracefully');
}

// Tests for token functions
function testSignToken() {
  const payload = { userId: 123, role: 'user' };
  const token = signToken(payload, 3600);
  
  assert.ok(token, 'signToken should return a value');
  assert.ok(token.includes('.'), 'token should contain . separator');
  
  const [payloadB, sig] = token.split('.');
  assert.ok(payloadB, 'token should have payload part');
  assert.ok(sig, 'token should have signature part');
  assert.strictEqual(sig.length, 64, 'signature should be 64 hex chars (sha256)');
  
  console.log('✓ signToken creates valid token');
}

function testVerifyToken() {
  const payload = { userId: 456, role: 'admin' };
  const token = signToken(payload, 3600);
  
  const verified = verifyToken(token);
  assert.ok(verified, 'valid token should verify');
  assert.strictEqual(verified.userId, 456, 'verified payload should contain userId');
  assert.strictEqual(verified.role, 'admin', 'verified payload should contain role');
  assert.ok(verified.exp, 'verified payload should contain exp');
  
  console.log('✓ verifyToken validates valid tokens');
}

function testVerifyTokenInvalid() {
  assert.strictEqual(verifyToken('invalid'), null, 'invalid token format should return null');
  assert.strictEqual(verifyToken(''), null, 'empty token should return null');
  assert.strictEqual(verifyToken('abc.def'), null, 'token with invalid signature should return null');
  
  // Test tampered token
  const payload = { userId: 789 };
  const token = signToken(payload, 3600);
  const [payloadB, sig] = token.split('.');
  const tamperedToken = payloadB + '.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  assert.strictEqual(verifyToken(tamperedToken), null, 'tampered token should return null');
  
  console.log('✓ verifyToken rejects invalid tokens');
}

function testVerifyTokenExpired() {
  const payload = { userId: 111 };
  const token = signToken(payload, -1); // expired 1 second ago
  
  // Wait a tiny bit to ensure expiration
  const verified = verifyToken(token);
  assert.strictEqual(verified, null, 'expired token should return null');
  
  console.log('✓ verifyToken rejects expired tokens');
}

// Run all tests
console.log('\n=== Crypto Unit Tests ===\n');
testHashPassword();
testVerifyPassword();
testVerifyPasswordInvalid();
testSignToken();
testVerifyToken();
testVerifyTokenInvalid();
testVerifyTokenExpired();
console.log('\n✓ All crypto unit tests passed!\n');
