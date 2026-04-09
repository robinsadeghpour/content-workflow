'use strict';

const crypto = require('crypto');

function makeHash(url) {
  // Normalize URL: trim, lowercase, strip trailing slash and common query params
  let normalized = url.trim().toLowerCase();
  // Remove trailing slash for consistency
  normalized = normalized.replace(/\/$/, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function filterDuplicates(db, ideas) {
  const checkStmt = db.prepare('SELECT 1 FROM ideas WHERE dedup_hash = ?');
  return ideas.filter(idea => {
    if (!idea.source_url) return false;
    const hash = makeHash(idea.source_url);
    idea.dedup_hash = hash;
    return !checkStmt.get(hash);
  });
}

module.exports = { makeHash, filterDuplicates };
