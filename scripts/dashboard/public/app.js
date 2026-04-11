'use strict';

/* Content Workflow Dashboard — vanilla JS */
(function () {
  // ============================================================
  // State
  // ============================================================
  const state = {
    view: 'feed',
    stats: null,
    feed: {
      stack: [],
      cursor: null,
      hasMore: true,
      loading: false,
      undo: [],
      sessionCounts: { kept: 0, skipped: 0, starred: 0 },
    },
    backlog: {
      rows: [],
      filter: 'all',
      minScore: 0,
      search: '',
      selected: new Set(),
      loaded: false,
    },
    jobs: new Map(),
    activeStreams: new Map(),
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  };

  // ============================================================
  // API client
  // ============================================================
  const api = {
    async get(path) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
      return res.json();
    },
    async post(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        let msg = `POST ${path} ${res.status}`;
        try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
        throw new Error(msg);
      }
      return res.json();
    },
  };

  // ============================================================
  // Utilities
  // ============================================================
  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = (Date.now() - then) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function hostFromUrl(url) {
    if (!url) return '';
    try { return new URL(url).host.replace(/^www\./, ''); } catch (_) { return ''; }
  }

  function platformClass(p) {
    if (!p) return '';
    const s = String(p).toLowerCase();
    if (s.includes('youtube')) return 'badge--youtube';
    if (s.includes('tiktok')) return 'badge--tiktok';
    if (s.includes('twitter') || s === 'x') return 'badge--twitter';
    if (s.includes('linkedin')) return 'badge--linkedin';
    if (s.includes('instagram')) return 'badge--instagram';
    return '';
  }

  function svgIcon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
  }

  function copyId(id) {
    if (!id) return;
    const show = () => showToast(`Copied ${String(id).slice(0, 8)}…`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).then(show).catch(() => show());
    } else {
      const ta = document.createElement('textarea');
      ta.value = id; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (_) {}
      document.body.removeChild(ta);
      show();
    }
  }

  // Derive media info client-side from source_url if server didn't supply it
  function deriveMedia(idea) {
    if (idea.media && (idea.media.thumbnail || idea.media.embed)) return idea.media;
    const url = idea.source_url || '';
    const host = hostFromUrl(url);
    const media = { host, thumbnail: null, embed: null, kind: idea.source_type || null };

    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      media.thumbnail = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
      media.embed = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
      media.kind = 'youtube';
      media.orientation = /\/shorts\//.test(url) ? 'portrait' : 'landscape';
      return media;
    }
    const ttMatch = url.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
    if (ttMatch) {
      media.embed = `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
      media.kind = 'tiktok';
      media.orientation = 'portrait';
      return media;
    }
    const txMatch = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
    if (txMatch) {
      media.embed = `https://platform.twitter.com/embed/Tweet.html?id=${txMatch[1]}`;
      media.kind = 'twitter';
      return media;
    }
    return media;
  }

  // ============================================================
  // Router
  // ============================================================
  const views = {};

  function setView(name) {
    if (state.view === name) return;
    const prev = views[state.view];
    if (prev && prev.unmount) prev.unmount();

    state.view = name;
    document.querySelectorAll('.view').forEach((el) => {
      el.hidden = el.id !== `view-${name}`;
    });
    document.querySelectorAll('.rail__item').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.view === name);
    });

    const next = views[name];
    if (next && next.mount) next.mount();
  }

  // ============================================================
  // Stats / topbar
  // ============================================================
  async function loadStats() {
    try {
      const data = await api.get('/api/stats');
      state.stats = data;
      const ideas = data.ideas || {};
      document.getElementById('chip-new').textContent = ideas.new ?? ideas.total ?? '0';
      document.getElementById('chip-kept').textContent = ideas.kept ?? '0';
      document.getElementById('chip-starred').textContent = ideas.starred ?? '0';
    } catch (e) {
      console.error('[stats]', e.message);
    }
  }

  // ============================================================
  // Toast
  // ============================================================
  let toastTimer = null;
  function showToast(message, onUndo) {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<span class="toast__msg">${escHtml(message)}</span>` +
      (onUndo ? `<button class="toast__btn" id="toast-undo">${svgIcon('undo')} Undo</button>` : '');
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-open'));
    if (toastTimer) clearTimeout(toastTimer);
    if (onUndo) {
      document.getElementById('toast-undo').addEventListener('click', () => {
        hideToast();
        onUndo();
      });
    }
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('is-open');
    setTimeout(() => { toast.hidden = true; }, 250);
  }

  // ============================================================
  // Feed view
  // ============================================================
  views.feed = {
    async mount() {
      state.feed.stack = [];
      state.feed.cursor = null;
      state.feed.hasMore = true;
      state.feed.undo = [];
      state.feed.sessionCounts = { kept: 0, skipped: 0, starred: 0 };
      renderFeedSkeletons();
      await loadFeedPage();
      renderFeedStack();
      document.getElementById('view-feed').focus();
      window.addEventListener('keydown', feedKeydown);
    },
    unmount() {
      window.removeEventListener('keydown', feedKeydown);
      unmountActiveEmbed();
    },
  };

  async function loadFeedPage() {
    if (state.feed.loading || !state.feed.hasMore) return;
    state.feed.loading = true;
    try {
      const params = new URLSearchParams({ status: 'new', limit: '20' });
      if (state.feed.cursor) params.set('cursor', state.feed.cursor);
      const data = await api.get(`/api/ideas/feed?${params}`);
      const items = Array.isArray(data) ? data : (data.items || data.ideas || []);
      items.forEach((it) => state.feed.stack.push(it));
      const nextCursor = (data && !Array.isArray(data)) ? (data.nextCursor || data.cursor) : null;
      state.feed.cursor = nextCursor || null;
      state.feed.hasMore = Boolean(nextCursor) && items.length > 0;
      items.forEach(enrichOembedThumbnail);
    } catch (e) {
      console.error('[feed load]', e.message);
      state.feed.hasMore = false;
    } finally {
      state.feed.loading = false;
    }
  }

  // TikTok (and other oembed-supported) items arrive without a thumbnail_url.
  // Fetch it lazily via the backend oembed proxy and inject into the active card.
  const oembedPromises = new Map();
  function enrichOembedThumbnail(idea) {
    const kind = idea.media && idea.media.kind;
    if (kind !== 'tiktok') return;
    if (idea.media.thumbnail) return;
    if (!idea.source_url) return;
    if (oembedPromises.has(idea.id)) return;
    const p = api.get(`/api/oembed?url=${encodeURIComponent(idea.source_url)}`)
      .then((data) => {
        const thumb = data && data.thumbnail_url;
        if (!thumb) return;
        idea.media.thumbnail = thumb;
        // If this idea is the currently active card, inject the image live.
        const active = activeCardEl();
        if (active && active.dataset.id === String(idea.id)) {
          const mediaEl = active.querySelector('.feed-card__media');
          if (mediaEl && !mediaEl.querySelector('img')) {
            const img = document.createElement('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.alt = '';
            img.src = thumb;
            const playBtn = mediaEl.querySelector('[data-action="embed"]');
            if (playBtn) mediaEl.insertBefore(img, playBtn);
            else mediaEl.appendChild(img);
          }
        }
      })
      .catch(() => {});
    oembedPromises.set(idea.id, p);
  }

  function renderFeedSkeletons() {
    const stack = document.getElementById('feed-stack');
    stack.innerHTML = `
      <div class="feed-card" aria-hidden="true">
        <div class="feed-card__media skeleton"></div>
        <div class="feed-card__body">
          <div class="skeleton" style="height:24px;width:80%"></div>
          <div class="skeleton" style="height:14px;width:100%"></div>
          <div class="skeleton" style="height:14px;width:90%"></div>
        </div>
      </div>`;
  }

  function renderFeedStack() {
    const stack = document.getElementById('feed-stack');
    const empty = document.getElementById('feed-empty');
    stack.innerHTML = '';

    if (state.feed.stack.length === 0) {
      empty.hidden = false;
      const c = state.feed.sessionCounts;
      document.getElementById('feed-empty-stats').textContent =
        `Session: ${c.kept} kept · ${c.starred} starred · ${c.skipped} skipped.`;
      return;
    }
    empty.hidden = true;

    const visible = state.feed.stack.slice(0, 3);
    visible.forEach((idea, i) => {
      const card = buildFeedCard(idea, i === 0);
      if (i === 1) card.classList.add('is-ghost-1');
      if (i === 2) card.classList.add('is-ghost-2');
      if (i > 0) card.setAttribute('aria-hidden', 'true');
      stack.appendChild(card);
    });

    const active = stack.querySelector('.feed-card:not([aria-hidden])');
    if (active) attachSwipe(active);

    // Prefetch more when running low
    if (state.feed.stack.length < 5 && state.feed.hasMore) {
      loadFeedPage().then(() => {
        // only re-render if ghosts need filling
        if (stack.querySelectorAll('.feed-card').length < 3) renderFeedStack();
      });
    }
  }

  function buildFeedCard(idea, isActive) {
    const media = deriveMedia(idea);
    const card = document.createElement('article');
    card.className = 'feed-card';
    card.dataset.id = idea.id;

    const score = idea.score != null ? Number(idea.score).toFixed(2) : '';
    const srcBadgeCls = platformClass(media.kind || idea.source_type);

    const mediaHtml = media.thumbnail
      ? `<img loading="lazy" decoding="async" src="${escHtml(media.thumbnail)}" alt="" />`
      : `<div class="feed-card__media-btn"></div>`;

    const playBtn = (media.embed && isActive)
      ? `<button class="feed-card__media-btn" data-action="embed" aria-label="Play embed"><span class="feed-card__play">${svgIcon('play')}</span></button>`
      : '';

    const transcript = idea.transcript
      ? `<details class="feed-card__transcript"><summary>Show transcript</summary><div class="feed-card__transcript-text">${escHtml(idea.transcript)}</div></details>`
      : '';

    const mediaClass = media.orientation === 'portrait'
      ? 'feed-card__media feed-card__media--portrait'
      : 'feed-card__media';

    card.innerHTML = `
      <div class="feed-card__wash feed-card__wash--skip"></div>
      <div class="feed-card__wash feed-card__wash--keep"></div>
      <div class="feed-card__wash feed-card__wash--star"></div>
      <div class="${mediaClass}">
        ${srcBadgeCls ? `<span class="feed-card__source-badge"><span class="badge ${srcBadgeCls}">${escHtml(media.kind || idea.source_type || '')}</span></span>` : ''}
        ${score ? `<span class="feed-card__score">${score}</span>` : ''}
        ${mediaHtml}
        ${playBtn}
      </div>
      <div class="feed-card__body">
        <h2 class="feed-card__title">${escHtml(idea.title || 'Untitled')}</h2>
        ${idea.summary ? `<p class="feed-card__summary">${escHtml(idea.summary)}</p>` : ''}
        ${transcript}
      </div>
      <div class="feed-card__actions">
        <button class="feed-action feed-action--skip" data-decision="skipped" aria-label="Skip (Left arrow)">
          ${svgIcon('x')}<span class="feed-action__key">Skip</span>
        </button>
        <button class="feed-action feed-action--keep" data-decision="kept" aria-label="Keep (Right arrow)">
          ${svgIcon('check')}<span class="feed-action__key">Keep</span>
        </button>
        <button class="feed-action feed-action--star" data-decision="starred" aria-label="Star (Up arrow)">
          ${svgIcon('star')}<span class="feed-action__key">Star</span>
        </button>
      </div>
      <div class="feed-card__footer">
        <span>${escHtml(media.host || idea.source_type || '')}</span>
        <code class="feed-card__id" title="${escHtml(idea.id || '')}" data-copy-id="${escHtml(idea.id || '')}">${escHtml(String(idea.id || '').slice(0, 8))}</code>
        <span>${escHtml(relativeTime(idea.created_at))}</span>
      </div>
    `;

    if (isActive) {
      card.querySelectorAll('.feed-action').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          decide(btn.dataset.decision);
        });
      });
      const embedBtn = card.querySelector('[data-action="embed"]');
      if (embedBtn) embedBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleEmbed(); });
      const idChip = card.querySelector('[data-copy-id]');
      if (idChip) idChip.addEventListener('click', (e) => {
        e.stopPropagation();
        copyId(idChip.dataset.copyId);
      });
    }

    return card;
  }

  function currentIdea() { return state.feed.stack[0]; }
  function activeCardEl() {
    return document.querySelector('#feed-stack .feed-card:not([aria-hidden])');
  }

  function toggleEmbed() {
    const idea = currentIdea();
    if (!idea) return;
    const media = deriveMedia(idea);
    if (!media.embed) return;
    const mediaEl = activeCardEl()?.querySelector('.feed-card__media');
    if (!mediaEl) return;
    const existing = mediaEl.querySelector('iframe');
    if (existing) {
      existing.remove();
      mediaEl.classList.remove('is-embed-tall');
      const hidden = mediaEl.querySelector('img');
      if (hidden) hidden.style.display = '';
      return;
    }
    const img = mediaEl.querySelector('img');
    if (img) img.style.display = 'none';
    const iframe = document.createElement('iframe');
    iframe.src = media.embed;
    iframe.loading = 'lazy';
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
    mediaEl.appendChild(iframe);
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'feed-card__embed-close';
    closeBtn.setAttribute('aria-label', 'Close embed');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      unmountActiveEmbed();
      const card = activeCardEl();
      if (card) card.focus({ preventScroll: true });
    });
    mediaEl.appendChild(closeBtn);
    if (media.kind === 'tiktok' || media.orientation === 'portrait') {
      mediaEl.classList.add('is-embed-tall');
    }
    const card = activeCardEl();
    if (card) {
      card.setAttribute('tabindex', '-1');
      card.focus({ preventScroll: true });
    }
  }

  function unmountActiveEmbed() {
    const container = document.querySelector('#feed-stack .feed-card__media');
    const iframe = document.querySelector('#feed-stack iframe');
    const closeBtn = document.querySelector('#feed-stack .feed-card__embed-close');
    if (iframe) iframe.remove();
    if (closeBtn) closeBtn.remove();
    if (container) {
      container.classList.remove('is-embed-tall');
      const hidden = container.querySelector('img');
      if (hidden) hidden.style.display = '';
    }
  }

  async function decide(status) {
    const idea = currentIdea();
    if (!idea) return;
    const prevStatus = idea.status || 'new';
    unmountActiveEmbed();

    // Optimistic pop
    state.feed.stack.shift();
    if (status === 'kept') state.feed.sessionCounts.kept++;
    else if (status === 'starred') state.feed.sessionCounts.starred++;
    else if (status === 'skipped') state.feed.sessionCounts.skipped++;

    state.feed.undo.unshift({ idea, prevStatus });
    if (state.feed.undo.length > 5) state.feed.undo.pop();

    renderFeedStack();
    loadStats();

    try {
      await api.post(`/api/ideas/${encodeURIComponent(idea.id)}/status`, { status });
    } catch (e) {
      console.error('[decide]', e.message);
      showToast(`Failed to ${status}: ${e.message}`);
      return;
    }
    showToast(`Marked "${truncate(idea.title, 40)}" as ${status}`, async () => {
      try {
        await api.post(`/api/ideas/${encodeURIComponent(idea.id)}/status`, { status: prevStatus });
        state.feed.stack.unshift(idea);
        if (status === 'kept') state.feed.sessionCounts.kept--;
        else if (status === 'starred') state.feed.sessionCounts.starred--;
        else if (status === 'skipped') state.feed.sessionCounts.skipped--;
        renderFeedStack();
        loadStats();
      } catch (e) {
        showToast(`Undo failed: ${e.message}`);
      }
    });
  }

  function truncate(str, n) {
    if (!str) return '';
    str = String(str);
    return str.length <= n ? str : str.slice(0, n) + '...';
  }

  function feedKeydown(e) {
    if (state.view !== 'feed') return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); decide('skipped'); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); decide('kept'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); decide('starred'); }
    else if (e.key === ' ') { e.preventDefault(); toggleEmbed(); }
    else if (e.key.toLowerCase() === 'u') {
      e.preventDefault();
      const last = state.feed.undo.shift();
      if (last) {
        hideToast();
        (async () => {
          try {
            await api.post(`/api/ideas/${encodeURIComponent(last.idea.id)}/status`, { status: last.prevStatus });
            state.feed.stack.unshift(last.idea);
            renderFeedStack();
            loadStats();
          } catch (err) { showToast(`Undo failed: ${err.message}`); }
        })();
      }
    }
  }

  // Swipe gesture
  function attachSwipe(card) {
    let dragging = false;
    let startX = 0, startY = 0, dx = 0, dy = 0;
    let pointerId = null;

    function onDown(e) {
      if (e.target.closest('button, a, details, summary')) return;
      dragging = true;
      pointerId = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      card.classList.add('is-dragging');
      card.setPointerCapture(pointerId);
    }
    function onMove(e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      const verticalWins = Math.abs(dy) > Math.abs(dx) + 20 && dy < 0;
      const rot = state.reducedMotion ? 0 : (dx * 0.04);
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;

      const skipW = card.querySelector('.feed-card__wash--skip');
      const keepW = card.querySelector('.feed-card__wash--keep');
      const starW = card.querySelector('.feed-card__wash--star');
      if (state.reducedMotion) return;
      if (verticalWins) {
        starW.style.opacity = Math.min(1, Math.abs(dy) / 160);
        skipW.style.opacity = 0; keepW.style.opacity = 0;
      } else {
        starW.style.opacity = 0;
        if (dx < 0) { skipW.style.opacity = Math.min(1, -dx / 160); keepW.style.opacity = 0; }
        else       { keepW.style.opacity = Math.min(1, dx / 160); skipW.style.opacity = 0; }
      }
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('is-dragging');
      try { card.releasePointerCapture(pointerId); } catch (_) {}
      const verticalWins = Math.abs(dy) > Math.abs(dx) + 20 && dy < 0;
      const threshold = 80;

      if (verticalWins && Math.abs(dy) > threshold) { decide('starred'); return; }
      if (dx > threshold) { decide('kept'); return; }
      if (dx < -threshold) { decide('skipped'); return; }
      // spring back
      card.style.transform = '';
      card.querySelectorAll('.feed-card__wash').forEach((w) => (w.style.opacity = 0));
      dx = 0; dy = 0;
    }

    card.addEventListener('pointerdown', onDown);
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }

  // ============================================================
  // Backlog view
  // ============================================================
  views.backlog = {
    async mount() {
      if (!state.backlog.loaded) {
        try {
          const data = await api.get('/api/ideas/feed?status=all&limit=1000');
          const items = Array.isArray(data) ? data : (data.items || data.ideas || []);
          state.backlog.rows = items;
          state.backlog.loaded = true;
        } catch (e) {
          // fallback to legacy /api/ideas
          try {
            state.backlog.rows = await api.get('/api/ideas');
            state.backlog.loaded = true;
          } catch (err) { console.error('[backlog]', err.message); }
        }
      }
      renderBacklog();
      wireBacklogEvents();
    },
    unmount() {
      const scroll = document.getElementById('backlog-scroll');
      if (scroll) scroll.removeEventListener('scroll', renderBacklog);
    },
  };

  function filteredBacklog() {
    const { rows, filter, minScore, search } = state.backlog;
    const q = search.toLowerCase().trim();
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if ((r.score || 0) < minScore) return false;
      if (q) {
        const hay = `${r.title || ''} ${r.summary || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  const ROW_H = 48;
  function renderBacklog() {
    const tbody = document.getElementById('backlog-tbody');
    const scroll = document.getElementById('backlog-scroll');
    if (!tbody || !scroll) return;

    const rows = filteredBacklog();
    const total = rows.length;
    if (total === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-3);padding:32px">No ideas match this filter.</td></tr>`;
      return;
    }
    const scrollTop = scroll.scrollTop;
    const viewportH = scroll.clientHeight || 600;
    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - 10);
    const visibleCount = Math.ceil(viewportH / ROW_H) + 20;
    const endIdx = Math.min(total, startIdx + visibleCount);

    const padTop = startIdx * ROW_H;
    const padBot = Math.max(0, (total - endIdx) * ROW_H);

    const chunk = rows.slice(startIdx, endIdx);
    const html = [];
    if (padTop) html.push(`<tr style="height:${padTop}px"><td colspan="7"></td></tr>`);
    chunk.forEach((r) => {
      const checked = state.backlog.selected.has(r.id) ? 'checked' : '';
      const score = r.score != null ? Number(r.score) : 0;
      const media = deriveMedia(r);
      const src = media.host || r.source_type || '--';
      const shortId = String(r.id || '').slice(0, 8);
      html.push(`
        <tr data-id="${escHtml(r.id)}">
          <td><input type="checkbox" class="backlog-row-check" ${checked} aria-label="Select row" /></td>
          <td><code class="idea-id" title="${escHtml(r.id || '')}" data-copy-id="${escHtml(r.id || '')}">${escHtml(shortId)}</code></td>
          <td class="cell-title">${escHtml(truncate(r.title || 'Untitled', 100))}</td>
          <td>${escHtml(src)}</td>
          <td><div class="score-bar"><div class="score-bar__fill" style="width:${Math.min(100, Math.max(0, score * 100))}%"></div></div></td>
          <td><span class="badge badge--${escHtml(r.status || 'new')}">${escHtml(r.status || 'new')}</span></td>
          <td>${escHtml(relativeTime(r.created_at))}</td>
        </tr>
      `);
    });
    if (padBot) html.push(`<tr style="height:${padBot}px"><td colspan="7"></td></tr>`);
    tbody.innerHTML = html.join('');
  }

  function wireBacklogEvents() {
    const scroll = document.getElementById('backlog-scroll');
    scroll.addEventListener('scroll', renderBacklog, { passive: true });

    document.querySelectorAll('#backlog-filters .filter-chip').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('#backlog-filters .filter-chip').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        state.backlog.filter = btn.dataset.filter;
        renderBacklog();
      };
    });

    const slider = document.getElementById('backlog-score');
    const scoreLabel = document.getElementById('backlog-score-val');
    scoreLabel.textContent = Number(slider.value).toFixed(2);
    slider.oninput = () => {
      state.backlog.minScore = Number(slider.value);
      scoreLabel.textContent = Number(slider.value).toFixed(2);
      renderBacklog();
    };

    const search = document.getElementById('backlog-search');
    search.oninput = () => {
      state.backlog.search = search.value;
      renderBacklog();
    };

    const tbody = document.getElementById('backlog-tbody');
    tbody.onclick = (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.dataset.id;
      if (e.target.classList.contains('backlog-row-check')) {
        if (e.target.checked) state.backlog.selected.add(id);
        else state.backlog.selected.delete(id);
        updateBulkBar();
        return;
      }
      const idCell = e.target.closest('[data-copy-id]');
      if (idCell) {
        e.stopPropagation();
        copyId(idCell.dataset.copyId);
        return;
      }
      openDrawer(id);
    };

    document.querySelectorAll('.bulk-bar [data-bulk]').forEach((btn) => {
      btn.onclick = async () => {
        const status = btn.dataset.bulk;
        const ids = Array.from(state.backlog.selected);
        if (!ids.length) return;
        try {
          await api.post('/api/ideas/bulk-status', { ids, status });
          state.backlog.rows.forEach((r) => { if (state.backlog.selected.has(r.id)) r.status = status; });
          state.backlog.selected.clear();
          updateBulkBar();
          renderBacklog();
          loadStats();
          showToast(`${ids.length} ideas marked ${status}`);
        } catch (e) { showToast(`Bulk update failed: ${e.message}`); }
      };
    });

    document.getElementById('backlog-select-all').onchange = (e) => {
      if (e.target.checked) filteredBacklog().forEach((r) => state.backlog.selected.add(r.id));
      else state.backlog.selected.clear();
      updateBulkBar();
      renderBacklog();
    };
  }

  function updateBulkBar() {
    const bar = document.getElementById('bulk-bar');
    const n = state.backlog.selected.size;
    bar.hidden = n === 0;
    document.getElementById('bulk-count').textContent = `${n} selected`;
  }

  // Drawer
  function openDrawer(id) {
    const idea = state.backlog.rows.find((r) => r.id === id);
    if (!idea) return;
    const media = deriveMedia(idea);
    document.getElementById('drawer-title').textContent = idea.title || 'Idea';
    const body = document.getElementById('drawer-body');
    body.innerHTML = `
      <div class="drawer__id"><code data-copy-id="${escHtml(idea.id)}" title="Click to copy">${escHtml(idea.id)}</code></div>
      ${media.thumbnail ? `<div class="feed-card__media" style="border-radius:var(--radius-sm);overflow:hidden;position:relative"><img src="${escHtml(media.thumbnail)}" alt="" loading="lazy" /></div>` : ''}
      <div>
        <div class="badge ${platformClass(media.kind || idea.source_type)}">${escHtml(media.kind || idea.source_type || 'source')}</div>
        <span class="badge badge--${escHtml(idea.status || 'new')}" style="margin-left:8px">${escHtml(idea.status || 'new')}</span>
        <span class="badge" style="margin-left:8px">score ${Number(idea.score || 0).toFixed(2)}</span>
      </div>
      ${idea.summary ? `<p style="color:var(--text-2);line-height:1.6">${escHtml(idea.summary)}</p>` : ''}
      ${idea.transcript ? `<details><summary style="cursor:pointer;color:var(--text-2)">Transcript</summary><div style="margin-top:8px;white-space:pre-wrap;color:var(--text-2);max-height:300px;overflow:auto">${escHtml(idea.transcript)}</div></details>` : ''}
      ${idea.source_url ? `<a href="${escHtml(idea.source_url)}" target="_blank" rel="noopener">Open source</a>` : ''}
      <div style="display:flex;gap:8px;margin-top:auto">
        <button class="btn btn--ghost" data-drawer-action="kept">Keep</button>
        <button class="btn btn--ghost" data-drawer-action="starred">Star</button>
        <button class="btn btn--ghost" data-drawer-action="skipped">Skip</button>
      </div>
    `;
    const idNode = body.querySelector('[data-copy-id]');
    if (idNode) idNode.onclick = () => copyId(idNode.dataset.copyId);
    body.querySelectorAll('[data-drawer-action]').forEach((btn) => {
      btn.onclick = async () => {
        try {
          await api.post(`/api/ideas/${encodeURIComponent(id)}/status`, { status: btn.dataset.drawerAction });
          idea.status = btn.dataset.drawerAction;
          renderBacklog();
          loadStats();
          closeDrawer();
        } catch (e) { showToast(`Failed: ${e.message}`); }
      };
    });
    document.getElementById('drawer').hidden = false;
    document.getElementById('drawer-backdrop').hidden = false;
    requestAnimationFrame(() => {
      document.getElementById('drawer').classList.add('is-open');
      document.getElementById('drawer-backdrop').classList.add('is-open');
    });
  }
  function closeDrawer() {
    const d = document.getElementById('drawer');
    const b = document.getElementById('drawer-backdrop');
    d.classList.remove('is-open');
    b.classList.remove('is-open');
    setTimeout(() => { d.hidden = true; b.hidden = true; }, 250);
  }

  // ============================================================
  // Pipeline view
  // ============================================================
  const KANBAN_COLS = [
    { key: 'draft', title: 'Draft', match: (s) => s === 'draft' || s === 'generated' },
    { key: 'ready', title: 'Ready', match: (s) => s === 'critic_approved' },
    { key: 'approved', title: 'Approved', match: (s) => s === 'approved' || s === 'user-approved' || s === 'pending-schedule' },
    { key: 'shipped', title: 'Shipped', match: (s) => s === 'scheduled' || s === 'published' },
  ];

  const pipelineState = { drafts: [] };

  views.pipeline = {
    async mount() {
      try {
        const drafts = await api.get('/api/drafts');
        pipelineState.drafts = drafts;
        renderKanban(drafts);
      } catch (e) {
        document.getElementById('kanban').innerHTML = `<div style="color:var(--text-2)">Error: ${escHtml(e.message)}</div>`;
      }
    },
    unmount() {},
  };

  function renderKanban(drafts) {
    const kanban = document.getElementById('kanban');
    const buckets = {};
    KANBAN_COLS.forEach((c) => (buckets[c.key] = []));
    drafts.forEach((d) => {
      const col = KANBAN_COLS.find((c) => c.match(d.status || 'draft'));
      if (col) buckets[col.key].push(d);
      else buckets.draft.push(d);
    });

    kanban.innerHTML = KANBAN_COLS.map((c) => `
      <div class="kanban__col">
        <div class="kanban__title"><span>${c.title}</span><span class="kanban__count">${buckets[c.key].length}</span></div>
        <div class="kanban__list">
          ${buckets[c.key].map((d) => kanbanCardHtml(d)).join('') || `<div style="color:var(--text-3);font-size:12px">Empty</div>`}
        </div>
      </div>
    `).join('');

    kanban.querySelectorAll('.kanban__card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-draft-action]') || e.target.closest('[data-copy-id]')) return;
        const id = card.dataset.id;
        const draft = pipelineState.drafts.find((x) => String(x.id) === String(id));
        if (draft) openDraftDrawer(draft);
      });
    });

    kanban.querySelectorAll('[data-copy-id]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        copyId(el.dataset.copyId);
      });
    });

    kanban.querySelectorAll('[data-draft-action]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.draftId;
        const action = btn.dataset.draftAction;
        btn.disabled = true;
        try {
          if (action === 'critic') await api.post('/api/trigger/critic', { draftId: id });
          else if (action === 'approve') await api.post(`/api/drafts/${encodeURIComponent(id)}/approve`);
          else if (action === 'schedule') await api.post('/api/trigger/approve-schedule', { draftId: id });
          const drafts2 = await api.get('/api/drafts');
          pipelineState.drafts = drafts2;
          renderKanban(drafts2);
        } catch (err) { showToast(`Failed: ${err.message}`); btn.disabled = false; }
      };
    });
  }

  function kanbanCardHtml(d) {
    const p = platformClass(d.platform);
    const shortIdeaId = String(d.idea_id || '').slice(0, 8);
    const files = Array.isArray(d.media_files) ? d.media_files : [];
    const previewHtml = files.length ? `
      <div class="kanban__card-preview">
        ${files.slice(0, 4).map((f) => `<img loading="lazy" decoding="async" src="${escHtml(f)}" alt="" />`).join('')}
        ${files.length > 4 ? `<span class="kanban__card-more">+${files.length - 4}</span>` : ''}
      </div>` : '';
    const textHtml = d.post_text ? `<div class="kanban__card-text">${escHtml(truncate(d.post_text, 220))}</div>` : '';
    return `
      <div class="kanban__card" data-id="${escHtml(d.id)}">
        <div class="kanban__card-meta">
          <span class="badge ${p}">${escHtml(d.platform || '')}</span>
          ${d.visual_approach ? `<span class="badge">${escHtml(d.visual_approach)}</span>` : ''}
          ${d.research_thin === 1 || d.research_thin === true ? `<span class="badge badge--research-thin" title="Research was sparse or failed — writer leaned on idea summary/transcript">research-thin</span>` : ''}
          ${d.did_not_pass_critic === 1 || d.did_not_pass_critic === true ? `<span class="badge badge--did-not-pass" title="Critic loop hit the 2-revision cap without passing — best iteration kept">did-not-pass</span>` : ''}
          <span style="margin-left:auto">${escHtml(relativeTime(d.updated_at))}</span>
        </div>
        <div class="kanban__card-title">${escHtml(d.idea_title || 'Untitled')}</div>
        ${shortIdeaId ? `<code class="idea-id" title="${escHtml(d.idea_id)}" data-copy-id="${escHtml(d.idea_id)}">${escHtml(shortIdeaId)}</code>` : ''}
        ${previewHtml}
        ${textHtml}
        <div class="kanban__card-actions">
          ${(d.status === 'draft' || d.status === 'generated') ? `<button class="btn btn--ghost" data-draft-action="critic" data-draft-id="${escHtml(d.id)}">Run Critic</button>` : ''}
          ${(d.status === 'draft' || d.status === 'critic_approved') ? `<button class="btn btn--ghost" data-draft-action="approve" data-draft-id="${escHtml(d.id)}">Approve</button>` : ''}
          ${(d.status === 'approved' || d.status === 'user-approved' || d.status === 'critic_approved') ? `<button class="btn btn--ghost" data-draft-action="schedule" data-draft-id="${escHtml(d.id)}">Schedule</button>` : ''}
        </div>
      </div>
    `;
  }

  function platformPreviewHtml(draft, files) {
    const platform = String(draft.platform || '').toLowerCase();
    const firstSlide = files[0] || null;
    const text = draft.post_text || '';

    if (platform === 'linkedin') {
      const galleryClass = firstSlide ? 'preview__media preview__media--document' : '';
      const n = files.length;
      return `
        <div class="preview preview--linkedin">
          <div class="preview__header">
            <div class="preview__avatar">R</div>
            <div>
              <div class="preview__name">Robin Sadeghpour</div>
              <div class="preview__meta">Building AI content workflows · Now · 🌐</div>
            </div>
          </div>
          <p class="preview__text preview__text--clamp" data-preview-text>${escHtml(text || '(no text)')}</p>
          ${text.length > 220 ? `<button class="preview__seemore" data-preview-more>…see more</button>` : ''}
          ${firstSlide ? `
            <div class="${galleryClass}">
              <img loading="lazy" src="${escHtml(firstSlide)}" alt="" />
              ${n > 1 ? `<span class="preview__page">1 / ${n}</span>` : ''}
            </div>` : ''}
          <div class="preview__actions">👍 Like &nbsp; 💬 Comment &nbsp; 🔁 Repost &nbsp; ✈ Send</div>
        </div>`;
    }

    if (platform === 'instagram') {
      const n = files.length;
      const dots = n > 1 ? `<div class="preview__dots">${Array.from({length: Math.min(n, 8)}).map((_,i)=>`<span class="${i===0?'is-active':''}"></span>`).join('')}</div>` : '';
      return `
        <div class="preview preview--instagram">
          <div class="preview__header">
            <div class="preview__avatar">R</div>
            <div class="preview__name">robinsadeghpour</div>
            <div style="margin-left:auto;color:#111">•••</div>
          </div>
          ${firstSlide ? `
            <div class="preview__media preview__media--square">
              <img loading="lazy" src="${escHtml(firstSlide)}" alt="" />
              ${dots}
            </div>` : ''}
          <div class="preview__icons">♡ &nbsp; 💬 &nbsp; ➤ <span style="margin-left:auto">🔖</span></div>
          <div class="preview__likes">1,248 likes</div>
          <div class="preview__caption"><b>robinsadeghpour</b> ${escHtml(text || '')}</div>
        </div>`;
    }

    if (platform === 'tiktok_en' || platform === 'tiktok_de' || platform === 'tiktok') {
      const handle = platform === 'tiktok_de' ? '@robinsadeghpour.de' : '@robinsadeghpour';
      const showCaption = draft.format !== 'photo_overlay' && draft.visual_approach !== 'photo_overlay';
      return `
        <div class="preview preview--tiktok">
          <div class="tiktok-phone">
            ${firstSlide ? `<img src="${escHtml(firstSlide)}" alt="" />` : '<div style="height:100%;background:#111"></div>'}
            <div class="tiktok-phone__overlay">
              <div class="tiktok-phone__handle">${escHtml(handle)}</div>
              ${showCaption ? `<div class="tiktok-phone__caption">${escHtml(text || '')}</div>` : ''}
            </div>
            <div class="tiktok-phone__side">
              <div><div class="tiktok-phone__icon">♡</div>12.4K</div>
              <div><div class="tiktok-phone__icon">💬</div>284</div>
              <div><div class="tiktok-phone__icon">↗</div>96</div>
            </div>
            <div class="tiktok-phone__bottom">🎵 original sound — robin</div>
          </div>
        </div>`;
    }

    // Fallback: generic card with first slide + text.
    return `
      <div class="preview">
        ${firstSlide ? `<div class="preview__media"><img src="${escHtml(firstSlide)}" alt="" /></div>` : ''}
        <p class="preview__text">${escHtml(text || '(no text)')}</p>
      </div>`;
  }

  function openDraftDrawer(draft) {
    const title = draft.idea_title || 'Draft';
    document.getElementById('drawer-title').textContent = title;
    const body = document.getElementById('drawer-body');
    const files = Array.isArray(draft.media_files) ? draft.media_files : [];
    const p = platformClass(draft.platform);
    const isIg = String(draft.platform || '').toLowerCase() === 'instagram';
    body.innerHTML = `
      <div class="drawer__id">
        idea <code data-copy-id="${escHtml(draft.idea_id || '')}" title="Click to copy">${escHtml(draft.idea_id || '')}</code>
        &nbsp;·&nbsp;
        draft <code data-copy-id="${escHtml(draft.id || '')}" title="Click to copy">${escHtml(draft.id || '')}</code>
      </div>
      <div>
        <span class="badge ${p}">${escHtml(draft.platform || '')}</span>
        <span class="badge badge--${escHtml(draft.status || 'draft')}" style="margin-left:8px">${escHtml(draft.status || 'draft')}</span>
        ${draft.visual_approach ? `<span class="badge" style="margin-left:8px">${escHtml(draft.visual_approach)}</span>` : ''}
      </div>

      <div class="drawer__section-label">Platform preview</div>
      ${platformPreviewHtml(draft, files)}

      ${files.length ? `
        <div class="drawer__section-label">All slides (${files.length})</div>
        <div class="drawer__gallery ${isIg ? 'drawer__gallery--square' : ''}">
          ${files.map((f) => `<a href="${escHtml(f)}" target="_blank" rel="noopener"><img loading="lazy" src="${escHtml(f)}" alt="" /></a>`).join('')}
        </div>` : ''}

      <div class="drawer__section-label">Full post text <button class="btn btn--ghost" style="padding:2px 8px;font-size:11px" data-copy-text>Copy</button></div>
      <pre class="drawer__raw-text">${draft.post_text ? escHtml(draft.post_text) : '(empty)'}</pre>

      ${draft.idea_source_url ? `<a href="${escHtml(draft.idea_source_url)}" target="_blank" rel="noopener" style="font-size:13px;color:var(--text-2)">→ Open original source</a>` : ''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border)">
        ${(draft.status === 'draft' || draft.status === 'generated') ? `<button class="btn btn--ghost" data-draft-drawer-action="critic">Run Critic</button>` : ''}
        ${(draft.status === 'draft' || draft.status === 'critic_approved') ? `<button class="btn btn--ghost" data-draft-drawer-action="approve">Approve</button>` : ''}
        ${(draft.status === 'approved' || draft.status === 'user-approved' || draft.status === 'critic_approved') ? `<button class="btn btn--primary" data-draft-drawer-action="schedule">Schedule</button>` : ''}
      </div>
    `;
    body.querySelectorAll('[data-copy-id]').forEach((el) => {
      el.onclick = () => copyId(el.dataset.copyId);
    });
    const copyTextBtn = body.querySelector('[data-copy-text]');
    if (copyTextBtn) copyTextBtn.onclick = () => {
      if (draft.post_text) { copyId(draft.post_text); }
    };
    const moreBtn = body.querySelector('[data-preview-more]');
    if (moreBtn) moreBtn.onclick = () => {
      const t = body.querySelector('[data-preview-text]');
      if (t) t.classList.toggle('preview__text--clamp');
      moreBtn.remove();
    };
    body.querySelectorAll('[data-draft-drawer-action]').forEach((btn) => {
      btn.onclick = async () => {
        btn.disabled = true;
        const action = btn.dataset.draftDrawerAction;
        try {
          if (action === 'critic') await api.post('/api/trigger/critic', { draftId: draft.id });
          else if (action === 'approve') await api.post(`/api/drafts/${encodeURIComponent(draft.id)}/approve`);
          else if (action === 'schedule') await api.post('/api/trigger/approve-schedule', { draftId: draft.id });
          const drafts2 = await api.get('/api/drafts');
          pipelineState.drafts = drafts2;
          renderKanban(drafts2);
          const updated = drafts2.find((x) => String(x.id) === String(draft.id));
          if (updated) openDraftDrawer(updated);
          else closeDrawer();
        } catch (e) {
          showToast(`Failed: ${e.message}`);
          btn.disabled = false;
        }
      };
    });
    document.getElementById('drawer').hidden = false;
    document.getElementById('drawer-backdrop').hidden = false;
    requestAnimationFrame(() => {
      document.getElementById('drawer').classList.add('is-open');
      document.getElementById('drawer-backdrop').classList.add('is-open');
    });
  }

  // ============================================================
  // Performance view
  // ============================================================
  views.performance = {
    async mount() {
      try {
        const [stats, perf] = await Promise.all([
          api.get('/api/stats'),
          api.get('/api/performance'),
        ]);
        renderPerformance(stats, perf);
      } catch (e) {
        document.getElementById('perf-stats').innerHTML = `<div style="color:var(--text-2)">Error: ${escHtml(e.message)}</div>`;
      }
    },
    unmount() {},
  };

  function renderPerformance(stats, perf) {
    const grid = document.getElementById('perf-stats');
    const published = perf.length;
    const totalViews = perf.reduce((s, r) => s + (r.views || 0), 0);
    const totalLikes = perf.reduce((s, r) => s + (r.likes || 0), 0);
    const avg = perf.length
      ? (perf.reduce((s, r) => s + (r.score || 0), 0) / perf.length).toFixed(2)
      : '0';
    const hist = (stats && stats.history) || [];
    const views = hist.map((h) => h.views || h.value || 0);

    const cards = [
      { label: 'Posts published', value: published, series: hist.map((h) => h.posts || 0) },
      { label: 'Total views', value: totalViews.toLocaleString(), series: views },
      { label: 'Total likes', value: totalLikes.toLocaleString(), series: hist.map((h) => h.likes || 0) },
      { label: 'Avg score', value: avg, series: hist.map((h) => h.score || 0) },
    ];
    grid.innerHTML = cards.map((c) => `
      <div class="stat-card">
        <div class="stat-card__label">${escHtml(c.label)}</div>
        <div class="stat-card__value">${escHtml(String(c.value))}</div>
        ${sparkline(c.series)}
      </div>
    `).join('');

    const tbody = document.getElementById('perf-tbody');
    tbody.innerHTML = perf.map((r) => `
      <tr>
        <td><span class="badge ${platformClass(r.platform)}">${escHtml(r.platform || '')}</span></td>
        <td class="cell-title">${escHtml(truncate(r.draft_content || '--', 80))}</td>
        <td>${(r.views || 0).toLocaleString()}</td>
        <td>${(r.likes || 0).toLocaleString()}</td>
        <td>${(r.comments || 0).toLocaleString()}</td>
        <td>${(r.shares || 0).toLocaleString()}</td>
        <td>${r.score != null ? Number(r.score).toFixed(2) : '--'}</td>
        <td>${escHtml(relativeTime(r.checked_at))}</td>
      </tr>
    `).join('') || `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--text-3)">No performance data yet.</td></tr>`;
  }

  function sparkline(series) {
    if (!series || series.length < 2) return `<svg class="sparkline" viewBox="0 0 100 40"></svg>`;
    const max = Math.max(...series, 1);
    const min = Math.min(...series, 0);
    const range = max - min || 1;
    const step = 100 / (series.length - 1);
    const pts = series.map((v, i) => {
      const x = i * step;
      const y = 40 - ((v - min) / range) * 36 - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
      <polyline fill="none" stroke="var(--primary)" stroke-width="1.5" points="${pts}" />
    </svg>`;
  }

  // ============================================================
  // Workflows view
  // ============================================================
  views.workflows = {
    async mount() {
      loadCronStatus();
      loadJobs();
      document.querySelectorAll('[data-trigger]').forEach((btn) => {
        btn.onclick = () => triggerScript(btn.dataset.trigger);
      });
    },
    unmount() {},
  };

  async function loadCronStatus() {
    try {
      const data = await api.get('/api/cron-status');
      const dot = document.querySelector('#cron-status .status-dot');
      const label = document.getElementById('cron-label');
      const pulseSched = data.pulse && data.pulse.schedule ? data.pulse.schedule : '';
      const perfSched = data.perfCheck && data.perfCheck.schedule ? data.perfCheck.schedule : '';
      const parts = [];
      if (pulseSched) parts.push(`Pulse ${pulseSched}`);
      if (perfSched) parts.push(`Perf ${perfSched}`);
      const tail = parts.length ? ` · ${parts.join(' · ')}` : '';
      if (data.running) {
        dot.className = 'status-dot running';
        label.textContent = `Cron running${tail}`;
      } else {
        dot.className = 'status-dot stopped';
        label.textContent = `Cron not running${tail} — start with: node scripts/cron-daemon.js`;
      }
    } catch (e) { console.error('[cron]', e.message); }
  }

  async function loadJobs() {
    try {
      const jobs = await api.get('/api/jobs');
      const list = document.getElementById('jobs-list');
      if (!jobs.length) {
        list.innerHTML = `<div style="color:var(--text-3);text-align:center;padding:24px">No jobs yet.</div>`;
        return;
      }
      list.innerHTML = jobs.map((j) => `
        <div class="job-card" id="job-${escHtml(j.id)}">
          <div class="job-card__head" data-job="${escHtml(j.id)}">
            <span class="badge badge--${j.status === 'running' ? 'draft' : j.status === 'done' ? 'approved' : 'skipped'}">${escHtml(j.status)}</span>
            <span class="job-card__label">${escHtml(j.label)}</span>
            <span class="job-card__time">${escHtml(relativeTime(j.started))}</span>
          </div>
          <pre class="job-card__output" id="job-output-${escHtml(j.id)}" hidden></pre>
        </div>
      `).join('');
      list.querySelectorAll('.job-card__head').forEach((h) => {
        h.onclick = () => {
          const id = h.dataset.job;
          const out = document.getElementById(`job-output-${id}`);
          out.hidden = !out.hidden;
          if (!out.hidden) streamJob(id);
        };
      });
    } catch (e) { console.error('[jobs]', e.message); }
  }

  function streamJob(jobId) {
    if (state.activeStreams.has(jobId)) return;
    const es = new EventSource(`/api/jobs/${encodeURIComponent(jobId)}/stream`);
    state.activeStreams.set(jobId, es);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const out = document.getElementById(`job-output-${jobId}`);
      if (!out) return;
      if (data.type === 'stdout' || data.type === 'stderr') {
        out.textContent += data.text;
        out.scrollTop = out.scrollHeight;
      }
      if (data.type === 'end') {
        es.close();
        state.activeStreams.delete(jobId);
        loadJobs();
        loadStats();
      }
    };
    es.onerror = () => { es.close(); state.activeStreams.delete(jobId); };
  }

  const runningTriggers = new Set();
  async function triggerScript(script) {
    if (runningTriggers.has(script)) return;
    const endpoint = script === 'pulse' ? '/api/trigger/pulse' : '/api/trigger/perf-check';
    const buttons = Array.from(document.querySelectorAll(`[data-trigger="${script}"]`));
    if (script === 'pulse') {
      const top = document.getElementById('btn-run-pulse');
      if (top) buttons.push(top);
      const empty = document.getElementById('feed-empty-pulse');
      if (empty) buttons.push(empty);
    }
    runningTriggers.add(script);
    buttons.forEach((b) => { b.disabled = true; b.dataset.prevLabel = b.textContent; b.textContent = `${script} running…`; });
    try {
      const data = await api.post(endpoint);
      showToast(`${script} started`);
      loadJobs();
      const jobId = data && data.jobId;
      if (jobId) {
        const poll = async () => {
          try {
            const jobs = await api.get('/api/jobs');
            const job = jobs.find((j) => j.id === jobId);
            if (!job || job.status !== 'running') {
              runningTriggers.delete(script);
              buttons.forEach((b) => { b.disabled = false; if (b.dataset.prevLabel) { b.textContent = b.dataset.prevLabel; delete b.dataset.prevLabel; } });
              loadJobs();
              loadStats();
              showToast(`${script} ${job ? job.status : 'done'}`);
              return;
            }
            setTimeout(poll, 2000);
          } catch (e) { setTimeout(poll, 2000); }
        };
        setTimeout(poll, 2000);
      } else {
        runningTriggers.delete(script);
        buttons.forEach((b) => { b.disabled = false; if (b.dataset.prevLabel) { b.textContent = b.dataset.prevLabel; delete b.dataset.prevLabel; } });
      }
    } catch (e) {
      runningTriggers.delete(script);
      buttons.forEach((b) => { b.disabled = false; if (b.dataset.prevLabel) { b.textContent = b.dataset.prevLabel; delete b.dataset.prevLabel; } });
      showToast(`Error: ${e.message}`);
    }
  }

  // ============================================================
  // Boot
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    // Rail navigation
    document.querySelectorAll('.rail__item').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });

    // Topbar pulse button
    document.getElementById('btn-run-pulse').addEventListener('click', () => triggerScript('pulse'));
    document.getElementById('feed-empty-pulse').addEventListener('click', () => triggerScript('pulse'));

    // Drawer close
    document.getElementById('drawer-close').addEventListener('click', closeDrawer);
    document.getElementById('drawer-backdrop').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const iframe = document.querySelector('#feed-stack iframe');
      if (iframe) {
        e.preventDefault();
        unmountActiveEmbed();
        const card = activeCardEl();
        if (card) card.focus({ preventScroll: true });
        return;
      }
      if (!document.getElementById('drawer').hidden) closeDrawer();
    });

    // Global search — jumps to backlog with search set
    const search = document.getElementById('global-search');
    search.addEventListener('input', () => {
      state.backlog.search = search.value;
      if (state.view === 'backlog') renderBacklog();
    });
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') setView('backlog');
    });

    loadStats();
    setInterval(loadStats, 30_000);

    // Initial mount of feed
    document.querySelectorAll('.view').forEach((el) => { el.hidden = el.id !== 'view-feed'; });
    views.feed.mount();
  });
})();
