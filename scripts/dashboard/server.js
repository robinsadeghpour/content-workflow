#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { handleApi } = require('./api.js');

const PORT = 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MEDIA_DIR = path.join(__dirname, '..', '..', 'media');
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'content.db');

// MIME type map
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Open DB connections
const dbRead = new Database(DB_PATH, { readonly: true });
const dbWrite = new Database(DB_PATH);

/**
 * Serve a static file from PUBLIC_DIR.
 * Path-traversal guard: resolved path must start with PUBLIC_DIR.
 */
function serveStatic(req, res) {
  let urlPath = new URL(req.url, 'http://localhost').pathname;

  // Default to index.html for root
  if (urlPath === '/') urlPath = '/index.html';

  // Path traversal guard (T-Q-03): ensure resolved path stays within PUBLIC_DIR
  const resolved = path.resolve(path.join(PUBLIC_DIR, urlPath));
  const publicDirNormalized = PUBLIC_DIR.endsWith(path.sep) ? PUBLIC_DIR : PUBLIC_DIR + path.sep;
  if (!resolved.startsWith(publicDirNormalized) && resolved !== PUBLIC_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

function serveMedia(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  const rel = urlPath.replace(/^\/media\/?/, '');
  const resolved = path.resolve(path.join(MEDIA_DIR, rel));
  const mediaDirNormalized = MEDIA_DIR.endsWith(path.sep) ? MEDIA_DIR : MEDIA_DIR + path.sep;
  if (!resolved.startsWith(mediaDirNormalized) && resolved !== MEDIA_DIR) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }
  fs.readFile(resolved, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  if (urlPath.startsWith('/api/')) {
    handleApi(req, res, dbRead, dbWrite);
  } else if (urlPath.startsWith('/media/')) {
    serveMedia(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('\n[Dashboard] Shutting down...');
  server.close(() => {
    try { dbRead.close(); } catch (e) {}
    try { dbWrite.close(); } catch (e) {}
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = server;
