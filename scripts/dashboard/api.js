'use strict';

const { execSync } = require('child_process');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

function platformSlug(platform) {
  if (!platform) return '';
  const p = String(platform).toLowerCase();
  if (p === 'tiktok_en' || p === 'tiktok-en') return 'tiktok-en';
  if (p === 'tiktok_de' || p === 'tiktok-de') return 'tiktok-de';
  return p;
}

function extractPostText(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str) return null;
  // The writer pipeline sometimes dumps the full result JSON into drafts.content.
  // Detect that and extract the human-readable field.
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const data = JSON.parse(str);
      const text =
        data.post_text ||
        data.caption ||
        data.script ||
        data.text ||
        data.content ||
        null;
      if (text) return String(text);
    } catch (e) {
      // Not valid JSON — fall through and return raw.
    }
  }
  return str;
}

function readResultJson(absDir, slug) {
  const candidates = [
    `${slug}-result.json`,
    'result.json',
  ];
  for (const name of candidates) {
    const p = path.join(absDir, name);
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      return extractPostText(raw);
    } catch (e) {
      // try next
    }
  }
  return null;
}

function listMediaFiles(absDir, relDir, depth = 0) {
  if (depth > 2) return [];
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.')) continue;
    const absChild = path.join(absDir, name);
    const relChild = `${relDir}/${name}`.replace(/\\/g, '/');
    if (entry.isDirectory()) {
      out.push(...listMediaFiles(absChild, relChild, depth + 1));
      continue;
    }
    if (/\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
      out.push(`/media/${relChild}`);
    }
  }
  // Natural sort so slide-10 lands after slide-9.
  out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return out;
}

function enrichDraft(draft) {
  if (!draft) return draft;
  const slug = platformSlug(draft.platform);
  let post_text = extractPostText(draft.content);
  let media_files = [];
  if (draft.media_dir) {
    // media_dir stored as relative path (e.g. "media/output/<id>/linkedin")
    const rel = String(draft.media_dir).replace(/^\/+/, '');
    const absDir = path.join(PROJECT_ROOT, rel);
    if (!post_text) {
      post_text = readResultJson(absDir, slug);
    }
    // Build URLs relative to the /media/ static mount. media_dir already starts
    // with "media/", so strip that prefix when building the URL path.
    const urlRel = rel.replace(/^media\//, '');
    media_files = listMediaFiles(absDir, urlRel);
  }
  return { ...draft, post_text, media_files };
}

/** Track running background jobs */
const runningJobs = new Map();
let jobCounter = 0;

/** In-memory oEmbed cache: url -> { body, expires } */
const oembedCache = new Map();
const OEMBED_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Derive a media object from a source URL for feed cards. */
function mediaFromUrl(sourceUrl) {
  if (!sourceUrl) return { kind: 'none', thumbnail: null, embed: null };
  let u;
  try { u = new URL(sourceUrl); } catch (e) {
    return { kind: 'none', thumbnail: null, embed: null };
  }
  const host = u.hostname.replace(/^www\./, '');

  // YouTube
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    let id = u.searchParams.get('v');
    let isShort = false;
    if (!id) {
      const shortsMatch = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/);
      if (shortsMatch) { id = shortsMatch[1]; isShort = true; }
      else {
        const embedMatch = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{6,})/);
        if (embedMatch) id = embedMatch[1];
      }
    }
    if (id) {
      return {
        kind: 'youtube',
        id,
        orientation: isShort ? 'portrait' : 'landscape',
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (id) {
      return {
        kind: 'youtube',
        id,
        orientation: 'landscape',
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        embed: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  // TikTok (always portrait)
  if (host.endsWith('tiktok.com')) {
    const m = u.pathname.match(/\/video\/(\d+)/);
    if (m) {
      const id = m[1];
      return {
        kind: 'tiktok',
        id,
        orientation: 'portrait',
        thumbnail: null,
        embed: `https://www.tiktok.com/embed/v2/${id}`,
      };
    }
  }

  // X / Twitter
  if (host === 'twitter.com' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) {
    const m = u.pathname.match(/\/status\/(\d+)/);
    if (m) {
      const id = m[1];
      return {
        kind: 'twitter',
        id,
        thumbnail: null,
        embed: `https://platform.twitter.com/embed/Tweet.html?id=${id}`,
      };
    }
  }

  // Fallback link
  return {
    kind: 'link',
    host,
    thumbnail: `https://www.google.com/s2/favicons?domain=${host}&sz=128`,
    embed: null,
  };
}

/** Fill gaps in a 7-day history series (YYYY-MM-DD, count). */
function fillHistoryDays(rows, days = 7) {
  const map = new Map();
  for (const r of rows) map.set(r.date, r.count);
  const out = [];
  const now = new Date();
  // Start at (days-1) days ago through today, UTC-ish date matching sqlite date('now')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) || 0 });
  }
  return out;
}

/** Collect POST body */
function collectBody(req, cb) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => { cb(body); });
}

/** Spawn claude CLI and stream output via SSE job system */
function spawnClaude(res, prompt, label) {
  const jobId = `job-${++jobCounter}-${Date.now()}`;
  const child = spawn('claude', ['-p', '--dangerously-skip-permissions', prompt], {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return trackChild(res, child, jobId, label);
}

/** Spawn a child process and stream its output, tracked as a job */
function streamChildOutput(res, child, label) {
  const jobId = `job-${++jobCounter}-${Date.now()}`;
  return trackChild(res, child, jobId, label);
}

/** Common job tracking for spawned processes */
function trackChild(res, child, jobId, label) {
  const job = { label, started: new Date().toISOString(), status: 'running', output: [], listeners: [], exitCode: null };
  runningJobs.set(jobId, job);

  const emit = (event) => {
    for (const fn of job.listeners) fn(event);
  };

  const pushOutput = (text) => {
    job.output.push(text);
    if (job.output.length > 500) job.output.splice(0, job.output.length - 500);
  };

  child.stdout && child.stdout.on('data', (data) => {
    const text = data.toString();
    pushOutput(text);
    emit({ type: 'stdout', text });
  });

  child.stderr && child.stderr.on('data', (data) => {
    const text = data.toString();
    pushOutput(text);
    emit({ type: 'stderr', text });
  });

  child.on('close', (code) => {
    job.status = code === 0 ? 'done' : 'error';
    job.exitCode = code;
    job.ended = new Date().toISOString();
    emit({ type: 'end', status: job.status, code });
    // Clean up after 5 minutes
    setTimeout(() => runningJobs.delete(jobId), 5 * 60 * 1000);
  });

  return sendJson(res, 200, { jobId, label, status: 'running' });
}

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

    // GET /api/ideas/feed?cursor=...&limit=20&status=new
    if (method === 'GET' && pathname === '/api/ideas/feed') {
      const { params } = parseUrl(req);
      const statusParam = (params.get('status') || 'new').toLowerCase();
      const validStatuses = new Set(['new', 'kept', 'skipped', 'starred', 'all']);
      if (!validStatuses.has(statusParam)) {
        return sendJson(res, 400, { error: `Invalid status: ${statusParam}` });
      }
      let limit = parseInt(params.get('limit') || '20', 10);
      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      if (limit > 50) limit = 50;
      const cursor = params.get('cursor');

      const where = [];
      const args = [];
      if (statusParam !== 'all') {
        where.push('status = ?');
        args.push(statusParam);
      }
      if (cursor) {
        where.push('created_at < ?');
        args.push(cursor);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const sql = `SELECT * FROM ideas ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ?`;
      args.push(limit);
      const rows = db.prepare(sql).all(...args);
      const items = rows.map((r) => ({ ...r, media: mediaFromUrl(r.source_url) }));
      const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null;
      return sendJson(res, 200, { items, nextCursor });
    }

    // GET /api/drafts
    if (method === 'GET' && pathname === '/api/drafts') {
      const rows = db.prepare(`
        SELECT d.*, i.title as idea_title, i.source_url as idea_source_url
        FROM drafts d
        LEFT JOIN ideas i ON d.idea_id = i.id
        ORDER BY d.updated_at DESC
        LIMIT 100
      `).all();
      return sendJson(res, 200, rows.map(enrichDraft));
    }

    // GET /api/drafts/:id
    if (method === 'GET' && segments.length === 3 && segments[0] === 'api' && segments[1] === 'drafts') {
      const draftId = segments[2];
      const row = db.prepare(`
        SELECT d.*, i.title as idea_title, i.source_url as idea_source_url, i.summary as idea_summary
        FROM drafts d
        LEFT JOIN ideas i ON d.idea_id = i.id
        WHERE d.id = ?
      `).get(draftId);
      if (!row) return sendJson(res, 404, { error: `Draft ${draftId} not found` });
      return sendJson(res, 200, enrichDraft(row));
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

      const ideasStarred = db.prepare("SELECT COUNT(*) as c FROM ideas WHERE status = 'starred'").get().c;

      const ideasHistoryRows = db.prepare(
        "SELECT date(created_at) as date, COUNT(*) as count FROM ideas WHERE created_at >= date('now','-6 days') GROUP BY date(created_at) ORDER BY date ASC"
      ).all();
      const draftsHistoryRows = db.prepare(
        "SELECT date(created_at) as date, COUNT(*) as count FROM drafts WHERE created_at >= date('now','-6 days') GROUP BY date(created_at) ORDER BY date ASC"
      ).all();

      return sendJson(res, 200, {
        ideas: {
          total: ideasTotal,
          new: ideasNew,
          kept: ideasKept,
          skipped: ideasSkipped,
          starred: ideasStarred,
          history: fillHistoryDays(ideasHistoryRows, 7),
        },
        drafts: {
          total: draftsTotal,
          draft: draftsDraft,
          approved: draftsApproved,
          scheduled: draftsScheduled,
          published: draftsPublished,
          history: fillHistoryDays(draftsHistoryRows, 7),
        },
        performance: {
          avgScore: perfRow.avgScore ? Math.round(perfRow.avgScore * 100) / 100 : 0,
          totalViews: perfRow.totalViews || 0,
          totalLikes: perfRow.totalLikes || 0,
        },
      });
    }

    // GET /api/oembed?url=... — thin CORS proxy for TikTok/Instagram oEmbed
    if (method === 'GET' && pathname === '/api/oembed') {
      const { params } = parseUrl(req);
      const target = params.get('url');
      if (!target) return sendJson(res, 400, { error: 'url param required' });
      if (!/tiktok\.com|instagram\.com/i.test(target)) {
        return sendJson(res, 400, { error: 'Only tiktok.com and instagram.com URLs allowed' });
      }
      const cached = oembedCache.get(target);
      if (cached && cached.expires > Date.now()) {
        return sendJson(res, 200, cached.body);
      }
      const upstream = /tiktok\.com/i.test(target)
        ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`
        : `https://api.instagram.com/oembed?url=${encodeURIComponent(target)}`;
      fetch(upstream)
        .then(async (r) => {
          if (!r.ok) {
            return sendJson(res, 502, { error: `Upstream ${r.status}` });
          }
          const body = await r.json();
          oembedCache.set(target, { body, expires: Date.now() + OEMBED_TTL_MS });
          return sendJson(res, 200, body);
        })
        .catch((err) => sendJson(res, 502, { error: err.message }));
      return;
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

    // POST /api/ideas/bulk-status — update many ideas in one transaction
    // Keep BEFORE the :id/status matcher so "bulk-status" isn't treated as an id.
    if (method === 'POST' && pathname === '/api/ideas/bulk-status') {
      return collectBody(req, (body) => {
        let parsed;
        try { parsed = JSON.parse(body || '{}'); } catch (e) {
          return sendJson(res, 400, { error: 'Invalid JSON body' });
        }
        const { ids, status } = parsed;
        const valid = new Set(['kept', 'skipped', 'starred', 'new']);
        if (!Array.isArray(ids) || ids.length === 0) {
          return sendJson(res, 400, { error: 'ids must be a non-empty array' });
        }
        if (!valid.has(status)) {
          return sendJson(res, 400, { error: `Invalid status: ${status}` });
        }
        const stmt = dbWrite.prepare('UPDATE ideas SET status = ? WHERE id = ?');
        const txn = dbWrite.transaction((items) => {
          let n = 0;
          for (const id of items) {
            const info = stmt.run(status, id);
            n += info.changes;
          }
          return n;
        });
        const updated = txn(ids);
        return sendJson(res, 200, { updated });
      });
    }

    // POST /api/ideas/:id/status — set status (+ optional visual_approach)
    if (method === 'POST' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'ideas' && segments[3] === 'status') {
      const ideaId = segments[2];
      return collectBody(req, (body) => {
        let parsed;
        try { parsed = JSON.parse(body || '{}'); } catch (e) {
          return sendJson(res, 400, { error: 'Invalid JSON body' });
        }
        const { status, visual_approach } = parsed;
        const valid = new Set(['kept', 'skipped', 'starred', 'new']);
        if (!valid.has(status)) {
          return sendJson(res, 400, { error: `Invalid status: ${status}` });
        }
        if (visual_approach != null && visual_approach !== 'photo' && visual_approach !== 'ai') {
          return sendJson(res, 400, { error: `Invalid visual_approach: ${visual_approach}` });
        }
        const idea = dbWrite.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        if (!idea) {
          return sendJson(res, 404, { error: `Idea ${ideaId} not found` });
        }
        dbWrite
          .prepare('UPDATE ideas SET status = ?, visual_approach = COALESCE(?, visual_approach) WHERE id = ?')
          .run(status, visual_approach != null ? visual_approach : null, ideaId);
        const updated = dbWrite.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        return sendJson(res, 200, updated);
      });
    }

    // POST /api/trigger/pulse
    if (method === 'POST' && pathname === '/api/trigger/pulse') {
      const pulseScript = path.join(PROJECT_ROOT, 'scripts', 'pulse.js');
      const child = spawn('node', [pulseScript], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      return streamChildOutput(res, child, 'pulse');
    }

    // POST /api/trigger/perf-check
    if (method === 'POST' && pathname === '/api/trigger/perf-check') {
      const perfScript = path.join(PROJECT_ROOT, 'scripts', 'perf-check.js');
      const child = spawn('node', [perfScript], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      return streamChildOutput(res, child, 'perf-check');
    }

    // POST /api/trigger/generate — generate content for a kept idea
    if (method === 'POST' && pathname === '/api/trigger/generate') {
      return collectBody(req, (body) => {
        const { ideaId } = JSON.parse(body);
        if (!ideaId) return sendJson(res, 400, { error: 'ideaId required' });
        const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        if (!idea) return sendJson(res, 404, { error: `Idea ${ideaId} not found` });

        const prompt = `Run /generate-content for idea ID ${ideaId}: "${idea.title}". Generate content for all platforms (LinkedIn, TikTok EN, TikTok DE, Instagram). Use the existing pipeline scripts. Do not ask questions — use defaults and best judgment.`;
        return spawnClaude(res, prompt, `generate-${ideaId}`);
      });
    }

    // POST /api/trigger/critic — run critic on a draft
    if (method === 'POST' && pathname === '/api/trigger/critic') {
      return collectBody(req, (body) => {
        const { draftId } = JSON.parse(body);
        if (!draftId) return sendJson(res, 400, { error: 'draftId required' });
        const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
        if (!draft) return sendJson(res, 404, { error: `Draft ${draftId} not found` });

        const script = path.join(PROJECT_ROOT, 'scripts', 'apply-critic.js');
        const child = spawn('node', [script, '--draft-id', String(draftId)], {
          cwd: PROJECT_ROOT,
          env: { ...process.env },
        });
        return streamChildOutput(res, child, `critic-${draftId}`);
      });
    }

    // POST /api/trigger/approve-schedule — approve draft and schedule via Postiz
    if (method === 'POST' && pathname === '/api/trigger/approve-schedule') {
      return collectBody(req, (body) => {
        const { draftId } = JSON.parse(body);
        if (!draftId) return sendJson(res, 400, { error: 'draftId required' });
        const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId);
        if (!draft) return sendJson(res, 404, { error: `Draft ${draftId} not found` });

        const script = path.join(PROJECT_ROOT, 'scripts', 'approve-draft.js');
        const child = spawn('node', [script, '--draft-id', String(draftId), '--schedule'], {
          cwd: PROJECT_ROOT,
          env: { ...process.env },
        });
        return streamChildOutput(res, child, `schedule-${draftId}`);
      });
    }

    // GET /api/jobs — list running + recently completed jobs
    if (method === 'GET' && pathname === '/api/jobs') {
      const jobs = [];
      for (const [id, job] of runningJobs) {
        jobs.push({ id, label: job.label, started: job.started, ended: job.ended || null, status: job.status, exitCode: job.exitCode });
      }
      jobs.sort((a, b) => (b.started || '').localeCompare(a.started || ''));
      return sendJson(res, 200, jobs);
    }

    // GET /api/jobs/:id/stream — SSE stream for a running job
    if (method === 'GET' && segments.length === 4 && segments[0] === 'api' && segments[1] === 'jobs' && segments[3] === 'stream') {
      const jobId = segments[2];
      const job = runningJobs.get(jobId);
      if (!job) return sendJson(res, 404, { error: 'Job not found' });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Send buffered output first
      for (const line of job.output) {
        res.write(`data: ${JSON.stringify({ type: 'stdout', text: line })}\n\n`);
      }

      if (job.status === 'done' || job.status === 'error') {
        res.write(`data: ${JSON.stringify({ type: 'end', status: job.status, code: job.exitCode })}\n\n`);
        res.end();
        return;
      }

      // Subscribe to live updates
      const listener = (event) => {
        try { res.write(`data: ${JSON.stringify(event)}\n\n`); } catch (e) {}
      };
      job.listeners.push(listener);

      req.on('close', () => {
        const idx = job.listeners.indexOf(listener);
        if (idx !== -1) job.listeners.splice(idx, 1);
      });
      return;
    }

    // Unknown /api/* route
    return sendJson(res, 404, { error: `Unknown API route: ${method} ${pathname}` });

  } catch (err) {
    console.error('[API Error]', err.message);
    return sendJson(res, 500, { error: err.message });
  }
}

module.exports = { handleApi };
