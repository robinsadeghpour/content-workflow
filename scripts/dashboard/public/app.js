'use strict';

/* ============================================================
   Helpers
   ============================================================ */

function formatDate(iso) {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      hour12: false,
    });
  } catch (e) {
    return iso;
  }
}

function truncate(str, len) {
  if (!str) return '';
  str = String(str);
  return str.length <= len ? str : str.slice(0, len) + '...';
}

function statusBadge(status) {
  const cls = 'badge badge-' + (status || 'unknown').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  return `<span class="${cls}">${status || 'unknown'}</span>`;
}

function platformBadge(platform) {
  const cls = 'badge badge-' + (platform || 'unknown').replace(/_/g, '-').toLowerCase();
  return `<span class="${cls}">${platform || 'unknown'}</span>`;
}

/** Try to extract display text from JSON draft content */
function extractDisplayText(content, platform) {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    if (platform === 'linkedin') {
      return parsed.post_text || parsed.caption || '';
    }
    return parsed.caption || parsed.post_text || '';
  } catch (e) {
    return String(content);
  }
}

/* ============================================================
   Stats Bar
   ============================================================ */

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    document.getElementById('stat-ideas-total').textContent = data.ideas.total;
    document.getElementById('stat-ideas-kept').textContent = data.ideas.kept;
    document.getElementById('stat-drafts-draft').textContent = data.drafts.draft;
    document.getElementById('stat-drafts-scheduled').textContent = data.drafts.scheduled;
    document.getElementById('stat-perf-avg').textContent = data.performance.avgScore || '0';
    document.getElementById('stat-perf-views').textContent = (data.performance.totalViews || 0).toLocaleString();
  } catch (e) {
    console.error('[Stats] failed to load:', e.message);
  }
}

/* ============================================================
   Tab Switching
   ============================================================ */

const TAB_LOADERS = {
  ideas: loadIdeas,
  drafts: loadDrafts,
  performance: loadPerformance,
  cron: loadCron,
};

let activeTab = 'ideas';

function switchTab(tabName) {
  // Deactivate all
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));

  // Activate selected
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  const section = document.getElementById(`tab-${tabName}`);
  if (btn) btn.classList.add('active');
  if (section) section.classList.add('active');

  activeTab = tabName;

  // Load data
  if (TAB_LOADERS[tabName]) {
    TAB_LOADERS[tabName]();
  }
}

/* ============================================================
   Ideas Tab
   ============================================================ */

async function loadIdeas() {
  const tbody = document.getElementById('ideas-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading">Loading...</td></tr>';

  try {
    const res = await fetch('/api/ideas');
    const ideas = await res.json();

    document.getElementById('ideas-count').textContent = `${ideas.length} ideas`;

    if (ideas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="loading">No ideas yet.</td></tr>';
      return;
    }

    tbody.innerHTML = ideas.map(idea => `
      <tr>
        <td>${escHtml(truncate(idea.title, 80))}</td>
        <td>${escHtml(truncate(idea.source_type || idea.source_url || '--', 40))}</td>
        <td>${idea.score != null ? Number(idea.score).toFixed(1) : '--'}</td>
        <td>${statusBadge(idea.status)}</td>
        <td>${formatDate(idea.created_at)}</td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Error: ${escHtml(e.message)}</td></tr>`;
  }
}

/* ============================================================
   Drafts Tab
   ============================================================ */

async function loadDrafts() {
  const container = document.getElementById('drafts-container');
  container.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch('/api/drafts');
    const drafts = await res.json();

    document.getElementById('drafts-count').textContent = `${drafts.length} drafts`;

    if (drafts.length === 0) {
      container.innerHTML = '<div class="empty-state">No drafts yet.</div>';
      return;
    }

    container.innerHTML = drafts.map(draft => {
      const preview = extractDisplayText(draft.content, draft.platform);
      const isActionable = draft.status === 'draft' || draft.status === 'critic_approved';

      return `
        <div class="draft-card" id="draft-${escHtml(draft.id)}">
          <div class="draft-card-header">
            ${platformBadge(draft.platform)}
            ${statusBadge(draft.status)}
            <span class="draft-title">${escHtml(truncate(draft.idea_title || 'Untitled', 60))}</span>
          </div>
          <div class="draft-content-preview">${escHtml(truncate(preview, 200))}</div>
          ${draft.visual_approach ? `<div class="draft-meta"><span>Visual: ${escHtml(draft.visual_approach)}</span></div>` : ''}
          ${draft.media_dir ? `<div class="draft-meta"><span>Media: ${escHtml(draft.media_dir)}</span></div>` : ''}
          <div class="draft-meta">
            <span>Updated: ${formatDate(draft.updated_at)}</span>
          </div>
          ${isActionable ? `
          <div class="draft-actions">
            <button class="btn-approve" onclick="approveDraft('${escHtml(draft.id)}')">Approve</button>
            <button class="btn-reject" onclick="rejectDraft('${escHtml(draft.id)}')">Reject</button>
          </div>` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    container.innerHTML = `<div class="loading">Error: ${escHtml(e.message)}</div>`;
  }
}

async function approveDraft(draftId) {
  await updateDraftStatus(draftId, 'approve');
}

async function rejectDraft(draftId) {
  await updateDraftStatus(draftId, 'reject');
}

async function updateDraftStatus(draftId, action) {
  const card = document.getElementById(`draft-${draftId}`);
  if (card) {
    const btns = card.querySelectorAll('button');
    btns.forEach(b => b.disabled = true);
  }

  try {
    const res = await fetch(`/api/drafts/${encodeURIComponent(draftId)}/${action}`, {
      method: 'POST',
    });
    const data = await res.json();

    if (!res.ok) {
      alert(`Error: ${data.error || 'Unknown error'}`);
      if (card) {
        const btns = card.querySelectorAll('button');
        btns.forEach(b => b.disabled = false);
      }
      return;
    }

    // Re-fetch drafts list to reflect updated state
    await loadDrafts();
    await loadStats();
  } catch (e) {
    alert(`Network error: ${e.message}`);
    if (card) {
      const btns = card.querySelectorAll('button');
      btns.forEach(b => b.disabled = false);
    }
  }
}

/* ============================================================
   Performance Tab
   ============================================================ */

async function loadPerformance() {
  const tbody = document.getElementById('performance-tbody');
  tbody.innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';

  try {
    const res = await fetch('/api/performance');
    const rows = await res.json();

    document.getElementById('performance-count').textContent = `${rows.length} records`;

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="loading">No performance data yet.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(row => {
      const preview = extractDisplayText(row.draft_content, row.draft_platform || row.platform);
      return `
        <tr>
          <td>${platformBadge(row.platform)}</td>
          <td>${escHtml(truncate(preview || '--', 80))}</td>
          <td>${(row.views || 0).toLocaleString()}</td>
          <td>${(row.likes || 0).toLocaleString()}</td>
          <td>${(row.comments || 0).toLocaleString()}</td>
          <td>${(row.shares || 0).toLocaleString()}</td>
          <td>${row.score != null ? Number(row.score).toFixed(2) : '--'}</td>
          <td>${formatDate(row.checked_at)}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Error: ${escHtml(e.message)}</td></tr>`;
  }
}

/* ============================================================
   Cron Tab
   ============================================================ */

async function loadCron() {
  try {
    const res = await fetch('/api/cron-status');
    const data = await res.json();

    const dot = document.querySelector('#cron-daemon-status .status-dot');
    const label = document.getElementById('cron-daemon-label');

    if (data.running) {
      dot.className = 'status-dot running';
      label.textContent = 'Cron daemon is running';
    } else {
      dot.className = 'status-dot stopped';
      label.textContent = 'Cron daemon is not running — start it with: node scripts/cron-daemon.js';
    }
  } catch (e) {
    console.error('[Cron] failed to load status:', e.message);
  }
}

/* Global trigger function called by inline onclick */
window.triggerScript = async function triggerScript(script) {
  const endpoint = script === 'pulse' ? '/api/trigger/pulse' : '/api/trigger/perf-check';
  const btn = document.querySelector(`.trigger-btn[data-script="${script}"]`);
  if (btn) btn.disabled = true;

  appendLog(`Triggering ${script}...`, 'info');

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();

    if (data.triggered) {
      appendLog(`${script} triggered (${data.script} spawned in background)`, 'success');
    } else {
      appendLog(`${script} trigger failed: ${JSON.stringify(data)}`, 'error');
    }
  } catch (e) {
    appendLog(`Network error triggering ${script}: ${e.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.clearLog = function clearLog() {
  const log = document.getElementById('trigger-log');
  log.innerHTML = '<p class="log-empty">Log cleared.</p>';
};

function appendLog(message, type) {
  const log = document.getElementById('trigger-log');
  const empty = log.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry ${type || ''}`;
  entry.innerHTML = `<span class="log-time">${formatDate(new Date().toISOString())}</span>${escHtml(message)}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

/* ============================================================
   Security: HTML escaping
   ============================================================ */

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   Init
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Set up tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Load initial data
  loadStats();
  loadIdeas(); // ideas tab is active by default

  // Auto-refresh stats every 30 seconds
  setInterval(loadStats, 30_000);
});
