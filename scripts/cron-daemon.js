#!/usr/bin/env node
'use strict';

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

const PULSE_SCRIPT = path.join(__dirname, 'pulse.js');
const PERF_SCRIPT = path.join(__dirname, 'perf-check.js');

console.log('[CRON] Daemon started. Pulse: 06:00 | Perf-check: 18:00 (Europe/Berlin)');
console.log('[CRON] Pulse script: ' + PULSE_SCRIPT);
console.log('[CRON] Perf-check script: ' + PERF_SCRIPT);

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

console.log('[CRON] Perf-check schedule: 0 18 * * * (daily at 18:00 Europe/Berlin)');

cron.schedule('0 18 * * *', () => {
  console.log(`[CRON] ${new Date().toISOString()} -- triggering perf-check`);
  const child = spawn('node', [PERF_SCRIPT], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('exit', (code) => {
    console.log(`[CRON] Perf-check exited with code ${code}`);
  });
  child.on('error', (err) => {
    console.error(`[CRON] Failed to spawn perf-check: ${err.message}`);
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
