const fs = require('fs');
const path = require('path');

const EMAIL_LOG_FILE = path.join(__dirname, '..', 'email-debug.log');

/**
 * Debug SMTP logger for development environment
 * Logs all email attempts to a file instead of sending them
 */
function logEmail(options) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    to: options.to,
    from: options.from || 'noreply@funeral-book.local',
    subject: options.subject,
    body: options.body || options.text || options.html,
  };

  const logLine = `\n${'='.repeat(80)}\n${JSON.stringify(logEntry, null, 2)}\n`;

  fs.appendFileSync(EMAIL_LOG_FILE, logLine, 'utf8');
  console.log(`[EMAIL DEBUG] Email logged to ${EMAIL_LOG_FILE}`);
  console.log(`  To: ${logEntry.to}`);
  console.log(`  Subject: ${logEntry.subject}`);

  return { success: true, logged: true };
}

module.exports = { logEmail };
