const server = require('../server');
const { spawn } = require('child_process');
const path = require('path');

async function runAllTests() {
  console.log('==========================================');
  console.log('  Running All Tests');
  console.log('==========================================');
  
  let exitCode = 0;
  
  try {
    // Run unit tests (crypto)
    console.log('\n📝 Running Unit Tests...\n');
    require('./unit/crypto.test.js');
    
    // Run integration tests (auth)
    console.log('\n📝 Running Integration Tests...\n');
    const { runAuthTests } = require('./integration/auth.test.js');
    await runAuthTests();
    
    // Run integration tests (profile)
    const { runProfileTests } = require('./integration/profile.test.js');
    await runProfileTests();
    
    // Run integration tests (password reset)
    const { runPasswordResetTests } = require('./integration/password-reset.test.js');
    await runPasswordResetTests();
    
    // Close the current server before running original tests
    console.log('\n📝 Running Original Integration Tests...\n');
    server.close();
    
    // Wait a bit for the port to be released
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await new Promise((resolve, reject) => {
      // Run the original test.js in a separate process to avoid server conflicts
      const testProcess = spawn('node', [path.join(__dirname, 'test.js')], {
        stdio: 'inherit'
      });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Original tests failed with code ${code}`));
        }
      });
    });
    
    console.log('==========================================');
    console.log('  ✓ All Tests Passed!');
    console.log('==========================================\n');
    
  } catch (error) {
    console.error('\n❌ Tests Failed!');
    console.error(error);
    exitCode = 1;
  } finally {
    // Server should already be closed, but ensure it's closed
    try {
      server.close();
    } catch (e) {
      // Ignore if already closed
    }
    process.exit(exitCode);
  }
}

// Run all tests
runAllTests();
