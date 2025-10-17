# Test Suite

This directory contains the comprehensive test suite for the Funeral Book application.

## Test Structure

```
test/
├── unit/                       # Unit tests
│   └── crypto.test.js         # Tests for password hashing and token functions
├── integration/               # Integration tests
│   ├── auth.test.js          # User signup and login tests
│   ├── profile.test.js       # User profile retrieval tests
│   └── password-reset.test.js # Password reset flow tests
├── test.js                    # Original comprehensive integration tests
└── run-all.js                # Main test runner
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run specific test suites
```bash
# Unit tests only
npm run test:unit

# Auth integration tests
npm run test:auth

# Profile integration tests
npm run test:profile

# Password reset tests
npm run test:password-reset

# Original integration tests
npm run test:original
```

## Test Coverage

### Unit Tests (`unit/crypto.test.js`)
Tests for core cryptographic functions:
- ✅ Password hashing (salt generation, PBKDF2)
- ✅ Password verification (correct/incorrect passwords)
- ✅ Token signing (JWT-style tokens with HMAC)
- ✅ Token verification (valid/invalid/expired tokens)

### Integration Tests

#### Authentication (`integration/auth.test.js`)
- ✅ User signup with valid credentials
- ✅ Duplicate username rejection
- ✅ Missing credentials validation
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Login with non-existent user
- ✅ Private account creation
- ✅ Authenticated requests with token
- ✅ Unauthenticated request rejection
- ✅ Invalid token rejection

#### Profile (`integration/profile.test.js`)
- ✅ Get user profile by ID
- ✅ Non-existent user profile (404)
- ✅ Invalid user ID format (400)
- ✅ Private user profile retrieval
- ✅ Sensitive data exclusion from profile

#### Password Reset (`integration/password-reset.test.js`)
- ✅ Reset password with valid old password
- ✅ Old password no longer works after reset
- ✅ New password works after reset
- ✅ Invalid old password rejection
- ✅ Unauthenticated password reset rejection
- ✅ Missing fields validation
- ✅ Password hashing verification

#### Original Tests (`test.js`)
Comprehensive integration tests covering:
- User registration and login
- Record CRUD operations
- Post creation and retrieval
- Private accounts and follow requests
- Follow request approval
- Reporting and moderation
- Admin functionality
- Live streaming start/stop
- Chat messaging

## Test Database

Tests use an in-memory or test database to ensure isolation. Each test suite:
1. Resets the database to a clean state before running
2. Creates necessary test data
3. Cleans up after completion

The test suite supports both JSON file storage and SQLite storage backends.

## Adding New Tests

When adding new features, follow this pattern:

1. **Unit Tests**: Add tests for pure functions in `unit/`
2. **Integration Tests**: Add endpoint tests in `integration/`
3. **Update Runner**: Include new test file in `run-all.js`
4. **Update package.json**: Add convenience script if needed

## CI/CD

Tests are automatically run on every push and pull request via GitHub Actions:
- See `.github/workflows/nodejs.yml` for CI configuration
- All tests must pass before merging

## Best Practices

- ✅ Each test should be independent and isolated
- ✅ Use descriptive test names that explain what is being tested
- ✅ Assert both success and failure cases
- ✅ Clean up test data after each test suite
- ✅ Use meaningful assertions with clear error messages
