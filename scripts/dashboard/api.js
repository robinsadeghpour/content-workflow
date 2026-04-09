'use strict';

const { execSync } = require('child_process');
const { spawn } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

/**
 * Parse the request URL and extract pathname + search params.
 * Returns { pathname, params, segments }
 */
function parseUrl(req) {
  const url = new URL(req.url, 'http://localhost');
  return {
    pathname: url.pathname,
    params: url.searchParams,
    // Segments after stripping empty strings, e.g. ['api', 'drafts', '123', 'approve']
    segments: url.pathname.split('/').filter(Boolean),
  };
}

/**
 * Send a JSON response.
 */
function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Main API handler. Called by server.js for all /api/* requests.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {BetterSqlite3.Database} db - read-only connection
 * @param {BetterSqlite3.Database} dbWrite - writable connection
 */
function handleApi(req, res, db, dbWrite) {
  const { pathname, segments } = parseUrl(req);
  const method = req.method.toUpperCase();

  try {
    // GET /api/ideas
    if (method === 'GET' && pathname === '/api/ideas') {
      const rows = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC LIMIT 100').all();
      return sendJson(res, 200, rows);
    }

    // GET /api/drafts
    if (method === 'GET' && pathname === '/api/drafts') {
      const rows = db.prepare(`
        SELECT d.*, i.title as idea_title
        FROM drafts d
        LEFT JOIN ideas i ON d.idea_id = i.id
        ORDER BY d.updated_at DESC
        LIMIT 100
      `).all();
      return sendJson(res, 200, rows);
    }

    // GET /api/performance
    if (method === 'GET' && pathname === '/api/performance') {
      const rows = db.prepare(`
        SELECT p.*, d.platform as draft_platform, d.content as draft_content
        FROM performance p
        LEFT JOIN drafts d ON p.draft_id = d.id
        ORDER BY p.checked_at DESC
        LIMIT 50
      `).all();
      return sendJson(res, 200, rows);
    }

    // GET /api/stats
    if (method === 'GET' && pathname === '/api/stats') {
      const ideasTotal = db.prepare("SELECT COUNT(*) as c FROM ideas").get().c;
      const ideasNew = db.prepare("SELECT COUNT(*) as c FROM ideas WHERE status = 'new'").get().c;
      const ideasKept = db.prepare("SELECT COUNT(*) as c FROM ideas WHERE status = 'kept'").get().c;
      const ideasSkipped = db.prepare("SELECT COUNT(*) as c FROM ideas WHERE status = 'skipped'").get().c;

      const draftsTotal = db.prepare("SELECT COUNT(*) as c FROM drafts").get().c;
      const draftsDraft = db.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'draft'").get().c;
      const draftsApproved = db.prepare("SELECT COUNT(*) as c FROM drafts WHERE status IN ('user-approved', 'critic_approved')").get().c;
      const draftsScheduled = db.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'scheduled'").get().c;
      const draftsPublished = db.prepare("SELECT COUNT(*) as c FROM drafts WHERE status = 'published'").get().c;

      const perfRow = db.prepare(`
        SELECT AVG(score) as avgScore, SUM(views) as totalViews, SUM(likes) as totalLikes
        FROM performance
      `).get();

      return sendJson(res, 200, {
        ideas: { total: ideasTotal, new: ideasNew, kept: ideasKept, skipped: ideasSkipped },
        drafts: { total: draftsTotal, draft: draftsDraft, approved: draftsApproved, scheduled: draftsScheduled, published: draftsPublished },
        performance: {
          avgScore: perfRow.avgScore ? Math.round(perfRow.avgScore * 100) / 100 : 0,
          totalViews: perfRow.totalViews || 0,
          totalLikes: perfRow.totalLikes || 0,
        },
      });
    }

    // GET /api/cron-status
    if (method === 'GET' && pathname === '/api/cron-status') {
      let running = false;
      try {
        const result = execSync('pgrep -f cron-daemon || true', { encoding: 'utf-8' }).trim();
        running = result.length > 0;
      } catch (e) {
        running = false;
      }
      return sendJson(res, 200, {
        pulse: {
          schedule: '0 6 * * *',
          timezone: 'Europe/Berlin',
          description: 'Daily idea discovery',
        },
        perfCheck: {
          schedule: '0 18 * * *',
          timezone: 'Europe/Berlin',
          description: 'Daily performance check',
        },
        running,
      });
    }

    // POST /api/drafts/:id/approve
    // segments: ['api', 'drafts', ':id', 'approve']
    if (method === 'POST' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'drafts' && segments[3] === 'approve') {
      const draftId = segments[2];
      const draft = dbWrite.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      if (!draft) {
        return sendJson(res, 404, { error: `Draft ${draftId} not found` });
      }
      dbWrite.prepare("UPDATE drafts SET status = 'approved', updated_at = datetime('now') WHERE id = ?").run(draftId);
      const updated = dbWrite.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      return sendJson(res, 200, updated);
    }

    // POST /api/drafts/:id/reject
    if (method === 'POST' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'drafts' && segments[3] === 'reject') {
      const draftId = segments[2];
      const draft = dbWrite.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      if (!draft) {
        return sendJson(res, 404, { error: `Draft ${draftId} not found` });
      }
      dbWrite.prepare("UPDATE drafts SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(draftId);
      const updated = dbWrite.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
      return sendJson(res, 200, updated);
    }

    // POST /api/trigger/pulse
    if (method === 'POST' && pathname === '/api/trigger/pulse') {
      const pulseScript = path.join(PROJECT_ROOT, 'scripts', 'pulse.js');
      const child = spawn('node', [pulseScript], {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      child.unref();
      return sendJson(res, 200, { triggered: true, script: 'pulse.js' });
    }

    // POST /api/trigger/perf-check
    if (method === 'POST' && pathname === '/api/trigger/perf-check') {
      const perfScript = path.join(PROJECT_ROOT, 'scripts', 'perf-check.js');
      const child = spawn('node', [perfScript], {
        cwd: PROJECT_ROOT,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });
      child.unref();
      return sendJson(res, 200, { triggered: true, script: 'perf-check.js' });
    }

    // Unknown /api/* route
    return sendJson(res, 404, { error: `Unknown API route: ${method} ${pathname}` });

  } catch (err) {
    console.error('[API Error]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

module.exports = { handleApi };
