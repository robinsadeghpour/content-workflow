#!/usr/bin/env node
'use strict';

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const PULSE_SCRIPT = path.join(__dirname, 'pulse.js');

console.log('[CRON] Pulse daemon started. Schedule: 0 6 * * * (daily at 06:00 Europe/Berlin)');
console.log('[CRON] Next run will execute: node ' + PULSE_SCRIPT);

cron.schedule('0 6 * * *', () => {
  console.log(`[CRON] ${new Date().toISOString()} -- triggering pulse`);
  const child = spawn('node', [PULSE_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('exit', (code) => {
    console.log(`[CRON] Pulse exited with code ${code}`);
  });
  child.on('error', (err) => {
    console.error(`[CRON] Failed to spawn pulse: ${err.message}`);
  });
}, {
  timezone: 'Europe/Berlin',
});

// Keep process alive
process.on('SIGINT', () => {
  console.log('[CRON] Daemon stopped (SIGINT)');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[CRON] Daemon stopped (SIGTERM)');
  process.exit(0);
});
