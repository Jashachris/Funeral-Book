#!/usr/bin/env node
// Lightweight share helper: starts the server (if not running) and opens a public tunnel via ngrok or localtunnel.
// Usage: node scripts/share.js

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const NGROK_TOKEN = process.env.NGROK_AUTH_TOKEN;

function isServerUp(port, cb) {
  const req = http.request({ hostname: 'localhost', port, path: '/', method: 'GET', timeout: 1000 }, res => cb(true));
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
  req.end();
}

function startServer(cb) {
  // start using npm start
  const p = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['start'], { stdio: 'inherit' });
  p.on('error', (err) => console.error('failed to start server:', err));
  // give server a moment to boot
  setTimeout(() => cb(p), 800);
}

function startNgrok(port) {
  console.log('Starting ngrok tunnel...');
  // require user to have ngrok installed or set NGROK_AUTH_TOKEN and use npx ngrok
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = NGROK_TOKEN ? ['ngrok', 'http', `--authtoken=${NGROK_TOKEN}`, String(port)] : ['ngrok', 'http', String(port)];
  const p = spawn(cmd, args, { stdio: 'inherit' });
  p.on('close', code => console.log('ngrok exited with', code));
}

function startLocaltunnel(port) {
  console.log('Starting localtunnel (via npx localtunnel)...');
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const p = spawn(cmd, ['localtunnel', '--port', String(port)], { stdio: 'inherit' });
  p.on('close', code => console.log('localtunnel exited with', code));
}

// main
isServerUp(PORT, (up) => {
  if (!up) {
    console.log(`Server not listening on port ${PORT}, starting locally (npm start)`);
    startServer((serverProc) => {
      console.log('Server started, creating public tunnel...');
      if (NGROK_TOKEN) startNgrok(PORT); else startLocaltunnel(PORT);
    });
  } else {
    console.log(`Server already running on port ${PORT}, creating public tunnel...`);
    if (NGROK_TOKEN) startNgrok(PORT); else startLocaltunnel(PORT);
  }
});
