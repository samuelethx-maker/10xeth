(() => {
  const $ = (s) => document.querySelector(s);
  const device = $('#device');
  const main = $('#main');
  const STORE = 'hoplite-proto-v1';

  const MODELS = [
    { id: 'GPT-6 Luna', sub: 'Fast, balanced default' },
    { id: 'GPT-6 Sol', sub: 'Deeper reasoning for hard tasks' },
    { id: 'Claude Opus 5', sub: 'Long-horizon coding' },
    { id: 'Claude Sonnet 5', sub: 'Quick edits and reviews' },
  ];
  const EFFORTS = [
    { id: 'Low', bars: 1 }, { id: 'Default', bars: 3 }, { id: 'High', bars: 4 }, { id: 'Max', bars: 5 },
  ];
  const REPOS = [
    'samuelethx-maker/10xeth · main',
    'samuelethx-maker/10xeth · dev',
    'curiofold/web · main',
    'curiofold/api · main',
  ];

  const HOUR = 3600e3;
  const seedThreads = () => [
    { id: 't1', title: 'Create a Cinematic landing page', status: 'ready', at: Date.now() - 14 * HOUR,
      prompt: 'Create a Cinematic landing page for 10xeth with a hero video and scroll animations' },
    { id: 't2', title: 'Create a Cinematic onboarding flow', status: 'ready', at: Date.now() - 15 * HOUR,
      prompt: 'Create a Cinematic onboarding flow with three intro screens' },
    { id: 't3', title: 'Sweep for common bugs', status: 'ready', at: Date.now() - 18 * HOUR,
      prompt: 'Sweep for common bugs across the repo and open a PR with fixes' },
  ];

  const load = () => {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.threads) return { folders: [], ...s }; } catch {}
    return { threads: seedThreads(), folders: [], model: 'GPT-6 Luna', effort: 'Default', repo: REPOS[0], sort: 'recent', automations: {} };
  };
  const state = load();
  const ui = { view: 'home', threadId: null, query: '', files: [] };
  const save = () => localStorage.setItem(STORE, JSON.stringify(state));

  /* ---------- helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ago = (t) => {
    const m = Math.max(0, Math.round((Date.now() - t) / 60e3));
    if (m < 1) return 'now';
    if (m < 60) return m + 'm';
    if (m < 1440) return Math.round(m / 60) + 'h';
    return Math.round(m / 1440) + 'd';
  };
  const ICON = {
    check: '<svg viewBox="0 0 24 24" class="status-ico"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.3 2.3 4.7-4.8"/></svg>',
    running: '<svg viewBox="0 0 24 24" class="status-ico running"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/></svg>',
    tick: '<svg viewBox="0 0 24 24" class="check"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    stepDone: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.3 2.3 4.7-4.8"/></svg>',
    stepPending: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/></svg>',
    folder: '<svg viewBox="0 0 24 24" class="folder-ico fill"><path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.9c.6 0 1.1.2 1.5.6L12 7h6.8A2.2 2.2 0 0 1 21 9.2v8.6a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8V7.2Z"/></svg>',
    pr: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="M6 8.2v7.6M18 15.8V10a3 3 0 0 0-3-3h-4M13 4.5 10.5 7l2.5 2.5"/></svg>',
  };

  let toastTimer;
  const toast = (msg) => {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  };

  /* ---------- drawer ---------- */
  const setDrawer = (open) => {
    device.classList.toggle('open', open);
    if (!open) closeSearch();
  };

  // Edge swipe to open, swipe left to close — follows the finger like the native gesture.
  let drag = null;
  const drawerWidth = () => device.clientWidth * 0.83 + 4;
  device.addEventListener('touchstart', (e) => {
    if (device.classList.contains('sheet-open')) return;
    const x = e.touches[0].clientX - device.getBoundingClientRect().left;
    const open = device.classList.contains('open');
    if ((!open && x < 28) || (open && x > drawerWidth() - 20)) {
      drag = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, open, dx: 0, active: false };
    }
  }, { passive: true });
  device.addEventListener('touchmove', (e) => {
    if (!drag || dnd) return;
    const dx = e.touches[0].clientX - drag.x0, dy = e.touches[0].clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.active = true; device.classList.add('dragging');
    }
    drag.dx = dx;
    const w = drawerWidth();
    const pos = Math.min(w, Math.max(0, (drag.open ? w : 0) + dx));
    main.style.transform = `translateX(${pos}px)`;
    main.style.borderRadius = `${(pos / w) * 28}px 0 0 ${(pos / w) * 28}px`;
    const d = $('#drawer'); d.style.transform = `translateX(${-18 + (pos / w) * 18}%)`; d.style.opacity = 0.4 + 0.6 * (pos / w);
  }, { passive: true });
  device.addEventListener('touchend', () => {
    if (!drag) return;
    if (drag.active) {
      device.classList.remove('dragging');
      main.style.transform = main.style.borderRadius = '';
      const d = $('#drawer'); d.style.transform = d.style.opacity = '';
      setDrawer(drag.open ? drag.dx > -60 : drag.dx > 60);
    }
    drag = null;
  });

  /* ---------- thread list ---------- */
  const byThread = (id) => state.threads.find((t) => t.id === id);
  const folderOf = (id) => state.folders.find((f) => f.ids.includes(id));
  // Drop dangling ids and dissolve folders left with fewer than two threads.
  const tidyFolders = () => {
    state.folders.forEach((f) => { f.ids = f.ids.filter(byThread); });
    state.folders = state.folders.filter((f) => f.ids.length > 1);
  };
  const cmp = (a, b) => state.sort === 'az' ? a.title.localeCompare(b.title) : b.at - a.at;

  const threadRow = (t) => `
      <li><button class="thread-item ${ui.view === 'thread' && ui.threadId === t.id ? 'active' : ''} ${t.status === 'running' ? 'unread' : ''}" data-action="open-thread" data-id="${t.id}">
        ${t.status === 'running' ? ICON.running : ICON.check}
        <span class="t-title">${esc(t.title)}</span>
        <span class="t-time">${ago(t.at)}</span>
        <span class="t-sub"><span class="avatar">S</span>${t.status === 'running' ? 'Running' : 'Ready'}</span>
      </button></li>`;

  const folderRow = (f, kids) => {
    const running = kids.filter((t) => t.status === 'running').length;
    const hasActive = ui.view === 'thread' && f.ids.includes(ui.threadId);
    const mini = kids.slice(0, 4).map((t) => `<i class="${t.status === 'running' ? 'run' : ''}"></i>`).join('');
    return `
      <li class="folder ${f.open ? 'open' : ''} ${f.fresh ? 'fresh' : ''}" data-folder-id="${f.id}">
        <div class="folder-head-row">
          <button class="folder-head ${!f.open && hasActive ? 'active' : ''} ${!f.open && running ? 'unread' : ''}" data-action="toggle-folder" data-id="${f.id}">
            ${f.open ? ICON.folder : `<span class="folder-tile">${mini}</span>`}
            ${f.open ? '<span></span>' : `<span class="t-title">${esc(kids[0].title)}</span>
            <span class="t-time">${ago(kids[0].at)}</span>
            <span class="t-sub folder-preview">${esc(kids.slice(1).map((t) => t.title).join(' · '))}</span>`}
          </button>
          ${f.open ? `<button class="icon-btn folder-more" data-action="folder-more" data-id="${f.id}" aria-label="Folder options"><svg viewBox="0 0 24 24" class="fill"><circle cx="5.5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18.5" cy="12" r="1.7"/></svg></button>` : ''}
        </div>
        ${f.open ? `<ul class="folder-items">${kids.map(threadRow).join('')}</ul>` : ''}
      </li>`;
  };

  const renderThreads = () => {
    const q = ui.query.trim().toLowerCase();
    if (q) {
      const list = state.threads.filter((t) => t.title.toLowerCase().includes(q) || (t.prompt || '').toLowerCase().includes(q)).sort(cmp);
      $('#threadList').innerHTML = list.length ? list.map(threadRow).join('') : `<li class="empty">No threads match “${esc(ui.query)}”</li>`;
      return;
    }
    const grouped = new Set(state.folders.flatMap((f) => f.ids));
    const entries = [
      ...state.threads.filter((t) => !grouped.has(t.id)).map((t) => ({ title: t.title, at: t.at, html: () => threadRow(t) })),
      ...state.folders.map((f) => {
        const kids = f.ids.map(byThread).filter(Boolean).sort(cmp);
        return { title: kids[0]?.title || '', at: Math.max(...kids.map((t) => t.at)), html: () => folderRow(f, kids) };
      }),
    ].sort(cmp);
    $('#threadList').innerHTML = entries.length ? entries.map((e) => e.html()).join('') : '<li class="empty">No threads yet</li>';
    state.folders.forEach((f) => delete f.fresh);
  };

  /* ---------- drag a thread onto another to make a folder ---------- */
  const list = $('#threadList');
  let press = null, dnd = null, swallowClick = false;
  const endPress = () => { if (press) clearTimeout(press.timer); press = null; };

  list.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.thread-item');
    if (!item || ui.query || e.button > 0) return;
    press = { item, id: item.dataset.id, x: e.clientX, y: e.clientY, timer: setTimeout(() => startDnd(), 380) };
  });
  list.addEventListener('contextmenu', (e) => { if (e.target.closest('.thread-item')) e.preventDefault(); });

  const startDnd = () => {
    const { item, id, x, y } = press; press = null;
    const r = item.getBoundingClientRect();
    const ghost = item.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = r.width + 'px';
    document.body.appendChild(ghost);
    item.classList.add('drag-src');
    list.classList.add('dnd');
    dnd = { id, item, ghost, ox: x - r.left, oy: y - r.top, target: null, from: folderOf(id) };
    moveDnd(x, y);
    navigator.vibrate?.(10);
  };

  const moveDnd = (x, y) => {
    dnd.ghost.style.transform = `translate(${x - dnd.ox}px, ${y - dnd.oy}px) scale(1.03)`;
    const under = document.elementFromPoint(x, y);
    const row = under?.closest('.thread-item, .folder');
    let target = null;
    if (row && list.contains(row)) {
      if (row.classList.contains('thread-item') && row.dataset.id !== dnd.id) target = row;
      else if (row.classList.contains('folder') && (!dnd.from || row.dataset.folderId !== dnd.from.id)) target = row;
    }
    // Dragging a thread out of its folder: the folder fades to show it will leave.
    const leaving = dnd.from && !under?.closest(`[data-folder-id="${dnd.from.id}"]`);
    list.querySelectorAll('.drop-target, .drop-leave').forEach((el) => el.classList.remove('drop-target', 'drop-leave'));
    if (target && target.classList.contains('thread-item') && dnd.from && folderOf(target.dataset.id) === dnd.from) target = null;
    target?.classList.add('drop-target');
    if (leaving && !target) list.querySelector(`[data-folder-id="${dnd.from.id}"]`)?.classList.add('drop-leave');
    dnd.target = target; dnd.leaving = leaving;
  };

  const dropDnd = () => {
    const { id, target, from, leaving } = dnd;
    let msg = '';
    if (target) {
      const into = target.classList.contains('folder')
        ? state.folders.find((f) => f.id === target.dataset.folderId)
        : folderOf(target.dataset.id);
      if (from) from.ids = from.ids.filter((x) => x !== id);
      if (into) { into.ids.push(id); msg = 'Added to folder'; }
      else {
        state.folders.push({ id: 'f' + Date.now(), ids: [target.dataset.id, id], open: false, fresh: true });
        msg = 'Folder created';
      }
    } else if (from && leaving) {
      from.ids = from.ids.filter((x) => x !== id);
      msg = from.ids.length < 2 ? 'Folder removed' : 'Removed from folder';
    }
    cancelDnd();
    if (msg) { tidyFolders(); save(); renderThreads(); toast(msg); }
  };

  const cancelDnd = () => {
    if (!dnd) return;
    dnd.ghost.remove();
    list.classList.remove('dnd');
    list.querySelectorAll('.drag-src, .drop-target, .drop-leave').forEach((el) => el.classList.remove('drag-src', 'drop-target', 'drop-leave'));
    dnd = null; swallowClick = true;
    setTimeout(() => { swallowClick = false; }, 0);
  };

  window.addEventListener('pointermove', (e) => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) endPress();
    if (dnd) moveDnd(e.clientX, e.clientY);
  });
  window.addEventListener('pointerup', () => { endPress(); if (dnd) dropDnd(); });
  window.addEventListener('pointercancel', () => { endPress(); cancelDnd(); });
  // Keep the list from scrolling while a thread is being dragged on touch screens.
  list.addEventListener('touchmove', (e) => { if (dnd) e.preventDefault(); }, { passive: false });
  document.addEventListener('click', (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  const closeSearch = () => {
    $('#searchRow').hidden = true; ui.query = ''; $('#searchInput').value = ''; renderThreads();
  };

  /* ---------- views ---------- */
  const show = (view) => {
    ui.view = view;
    for (const v of ['home', 'thread', 'page']) $('#view-' + v).hidden = v !== view;
    renderThreads();
  };

  const stepsFor = (t) => [
    'Cloned ' + (t.repo || state.repo).split(' · ')[0],
    'Read project structure',
    'Planned changes',
    'Implemented changes',
    'Ran build and tests',
    'Opened pull request',
  ];

  const renderThread = () => {
    const t = state.threads.find((x) => x.id === ui.threadId);
    if (!t) return show('home');
    $('#threadTitle').textContent = t.title;
    $('#threadSub').textContent = `${t.model || state.model} · ${t.status === 'running' ? 'Running' : 'Ready'}`;
    const steps = stepsFor(t);
    const done = t.status === 'running' ? (t.progress || 0) : steps.length;
    let html = `<div class="msg-user">${esc(t.prompt || t.title)}</div><div class="msg-agent"><p>On it. I'll work in <b>${esc(t.repo || state.repo)}</b>.</p></div>`;
    steps.forEach((s, i) => {
      if (i < done) html += `<div class="step done">${ICON.stepDone}${s}</div>`;
      else if (i === done) html += `<div class="step pending">${ICON.stepPending}${s}…</div>`;
    });
    if (t.status === 'ready') {
      html += `<div class="msg-agent"><p>Done — the changes are ready for review. Build and tests pass.</p></div>
        <div class="card">${ICON.pr}<div><div class="c-title">${esc(t.title)}</div><div class="c-sub">#${t.pr || 42} · +${t.add || 214} −${t.del || 37}</div></div>
        <button class="c-btn" data-action="toast" data-msg="Opening pull request…">View PR</button></div>`;
    }
    (t.replies || []).forEach((r) => {
      html += `<div class="msg-user">${esc(r)}</div><div class="msg-agent"><p>Got it — I'll fold that into the same pull request.</p></div>`;
    });
    const m = $('#messages'); m.innerHTML = html; m.scrollTop = m.scrollHeight;
  };

  const openThread = (id) => { ui.threadId = id; show('thread'); renderThread(); setDrawer(false); };

  const runThread = (t) => {
    const total = stepsFor(t).length;
    const tick = () => {
      t.progress = (t.progress || 0) + 1;
      if (t.progress >= total) { t.status = 'ready'; t.at = Date.now(); toast('“' + t.title + '” is ready'); }
      save(); renderThreads();
      if (ui.view === 'thread' && ui.threadId === t.id) renderThread();
      if (t.status === 'running') setTimeout(tick, 1100 + Math.random() * 900);
    };
    setTimeout(tick, 900);
  };

  const titleFrom = (p) => {
    const s = p.trim().replace(/\s+/g, ' ');
    return s.length > 48 ? s.slice(0, 46) + '…' : s;
  };

  const submitTask = (text) => {
    const t = {
      id: 't' + Date.now(), title: titleFrom(text), prompt: text + (ui.files.length ? `\n\n📎 ${ui.files.join(', ')}` : ''),
      status: 'running', progress: 0, at: Date.now(), model: state.model, repo: state.repo,
      pr: 40 + Math.floor(Math.random() * 60), add: 50 + Math.floor(Math.random() * 400), del: Math.floor(Math.random() * 90),
    };
    state.threads.unshift(t); save();
    ui.files = []; renderAttachments();
    openThread(t.id); runThread(t);
  };

  /* ---------- pages ---------- */
  const AUTOMATIONS = [
    { id: 'nightly', name: 'Nightly bug sweep', sub: 'Every day at 02:00 · 10xeth' },
    { id: 'deps', name: 'Dependency updates', sub: 'Mondays at 09:00 · all projects' },
    { id: 'issues', name: 'Triage new issues', sub: 'On GitHub issue opened' },
  ];
  const renderPage = (page) => {
    const body = $('#pageBody');
    if (page === 'automations') {
      $('#pageTitle').textContent = 'Automations';
      body.innerHTML = `<div class="group-label">Active</div><div class="list">${AUTOMATIONS.map((a) => `
        <div class="row"><div><div>${a.name}</div><div class="r-sub">${a.sub}</div></div>
        <button class="toggle ${state.automations[a.id] !== false ? 'on' : ''}" data-action="toggle-auto" data-id="${a.id}" aria-label="Toggle ${a.name}"></button></div>`).join('')}</div>
        <button class="primary-btn" data-action="toast" data-msg="New automation (prototype)">New automation</button>`;
    } else {
      $('#pageTitle').textContent = 'Settings';
      body.innerHTML = `
        <div class="group-label">Account</div>
        <div class="list">
          <div class="row"><span class="avatar" style="width:32px;height:32px;font-size:14px">S</span><div><div>samuelethx-maker</div><div class="r-sub">Owner · Curiofold</div></div></div>
        </div>
        <div class="group-label">Defaults</div>
        <div class="list">
          <button class="row" data-action="model"><span>Model</span><span class="r-end">${esc(state.model)} ›</span></button>
          <button class="row" data-action="effort"><span>Effort</span><span class="r-end">${esc(state.effort)} ›</span></button>
          <button class="row" data-action="repo"><span>Repository</span><span class="r-end">${esc(state.repo.split(' · ')[0])} ›</span></button>
        </div>
        <div class="group-label">Agent</div>
        <div class="list">
          <div class="row"><span>Verbosity</span><span class="r-end">Medium</span></div>
          <div class="row"><span>Auto-merge pull requests</span><button class="toggle" data-action="toggle-plain" aria-label="Auto-merge"></button></div>
          <div class="row"><span>Notifications</span><button class="toggle on" data-action="toggle-plain" aria-label="Notifications"></button></div>
        </div>
        <div class="group-label">Prototype</div>
        <div class="list"><button class="row" data-action="reset" style="color:#ff6b6b">Reset demo data</button></div>`;
    }
  };
  const openPage = (page) => { show('page'); renderPage(page); ui.page = page; setDrawer(false); };

  /* ---------- sheets ---------- */
  const openSheet = (title, options, onPick) => {
    $('#sheetTitle').textContent = title;
    $('#sheetBody').innerHTML = options.map((o, i) => `
      <button class="opt ${o.selected ? 'selected' : ''} ${o.danger ? 'danger' : ''}" data-i="${i}">
        ${o.icon || ''}<div><div>${esc(o.label)}</div>${o.sub ? `<div class="o-sub">${esc(o.sub)}</div>` : ''}</div>${ICON.tick}
      </button>`).join('');
    $('#sheetBody').onclick = (e) => {
      const b = e.target.closest('.opt'); if (!b) return;
      closeSheet(); onPick(options[+b.dataset.i]);
    };
    device.classList.add('sheet-open');
  };
  const closeSheet = () => device.classList.remove('sheet-open');

  const syncChips = () => {
    $('#modelLabel').textContent = state.model;
    $('#effortLabel').textContent = state.effort;
    $('#repoLabel').textContent = state.repo;
    const bars = (EFFORTS.find((e) => e.id === state.effort) || EFFORTS[1]).bars;
    [...$('#effortBars').children].forEach((b, i) => b.classList.toggle('on', i < bars));
    if (ui.view === 'page') renderPage(ui.page);
  };

  const renderAttachments = () => {
    $('#attachments').innerHTML = ui.files.map((f, i) => `<span class="att">📎 ${esc(f)}<button type="button" data-action="rm-file" data-i="${i}">✕</button></span>`).join('');
  };

  /* ---------- actions ---------- */
  const actions = {
    'toggle-drawer': () => {
      const open = !device.classList.contains('open');
      setDrawer(open);
      if (open && !state.folderTip) {
        state.folderTip = true; save();
        setTimeout(() => toast('Tip: hold a thread and drop it on another to make a folder'), 500);
      }
    },
    'toggle-folder': (el) => {
      const f = state.folders.find((x) => x.id === el.dataset.id);
      f.open = !f.open; save(); renderThreads();
    },
    'folder-more': (el) => {
      const f = state.folders.find((x) => x.id === el.dataset.id);
      openSheet('Folder', [
        { label: 'Collapse', go: () => { f.open = false; save(); renderThreads(); } },
        { label: 'Ungroup threads', danger: true, go: () => { state.folders = state.folders.filter((x) => x !== f); save(); renderThreads(); toast('Folder removed'); } },
      ], (o) => o.go());
    },
    'close-drawer': () => setDrawer(false),
    'new-thread': () => { show('home'); setDrawer(false); setTimeout(() => $('#prompt').focus(), 420); },
    'open-thread': (el) => openThread(el.dataset.id),
    page: (el) => openPage(el.dataset.page),
    search: () => { $('#searchRow').hidden = false; $('#searchInput').focus(); },
    'search-close': closeSearch,
    sort: () => openSheet('Sort threads', [
      { label: 'Most recent', value: 'recent', selected: state.sort === 'recent' },
      { label: 'Alphabetical', value: 'az', selected: state.sort === 'az' },
    ], (o) => { state.sort = o.value; save(); renderThreads(); }),
    org: () => openSheet('Workspace', [
      { label: 'All Projects', sub: 'Curiofold', selected: $('#projectLabel').textContent === 'All Projects' },
      { label: '10xeth', sub: 'samuelethx-maker/10xeth', selected: $('#projectLabel').textContent === '10xeth' },
    ], (o) => { $('#projectLabel').textContent = o.label; }),
    model: () => openSheet('Model', MODELS.map((m) => ({ label: m.id, sub: m.sub, selected: m.id === state.model })),
      (o) => { state.model = o.label; save(); syncChips(); }),
    effort: () => openSheet('Reasoning effort', EFFORTS.map((e) => ({ label: e.id, selected: e.id === state.effort })),
      (o) => { state.effort = o.label; save(); syncChips(); }),
    repo: () => openSheet('Repository & branch', REPOS.map((r) => ({ label: r, selected: r === state.repo })),
      (o) => { state.repo = o.label; save(); syncChips(); }),
    more: () => openSheet('More', [
      { label: 'Automations', go: () => openPage('automations') },
      { label: 'Settings', go: () => openPage('settings') },
      { label: 'Share feedback', go: () => toast('Thanks for the feedback!') },
    ], (o) => o.go()),
    'thread-more': () => openSheet('Thread', [
      { label: 'Copy link', go: () => toast('Link copied') },
      { label: 'Rename', go: () => {
        const t = state.threads.find((x) => x.id === ui.threadId);
        const n = prompt('Rename thread', t.title); if (n) { t.title = n.trim(); save(); renderThread(); renderThreads(); }
      } },
      { label: 'Archive thread', danger: true, go: () => {
        state.threads = state.threads.filter((x) => x.id !== ui.threadId); tidyFolders(); save(); show('home'); toast('Thread archived');
      } },
    ], (o) => o.go()),
    attach: () => $('#fileInput').click(),
    'rm-file': (el) => { ui.files.splice(+el.dataset.i, 1); renderAttachments(); },
    'close-sheet': closeSheet,
    toast: (el) => toast(el.dataset.msg),
    'toggle-auto': (el) => {
      const on = !el.classList.contains('on'); el.classList.toggle('on', on);
      state.automations[el.dataset.id] = on; save();
    },
    'toggle-plain': (el) => el.classList.toggle('on'),
    reset: () => { localStorage.removeItem(STORE); location.reload(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !device.contains(el)) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el); }
  });

  $('#fileInput').addEventListener('change', (e) => {
    ui.files.push(...[...e.target.files].map((f) => f.name)); e.target.value = ''; renderAttachments();
  });
  $('#searchInput').addEventListener('input', (e) => { ui.query = e.target.value; renderThreads(); });

  const autosize = (ta, form) => {
    ta.addEventListener('input', () => {
      ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px';
      form.classList.toggle('has-text', ta.value.trim().length > 0);
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
    });
  };
  autosize($('#prompt'), $('#composer'));
  autosize($('#reply'), $('#replyComposer'));

  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const ta = $('#prompt'); const v = ta.value.trim();
    if (!v) { ta.focus(); return; }
    ta.value = ''; ta.style.height = ''; $('#composer').classList.remove('has-text'); ta.blur();
    submitTask(v);
  });
  $('#replyComposer').addEventListener('submit', (e) => {
    e.preventDefault();
    const ta = $('#reply'); const v = ta.value.trim(); if (!v) return;
    const t = state.threads.find((x) => x.id === ui.threadId);
    (t.replies ||= []).push(v); t.at = Date.now(); save();
    ta.value = ''; ta.style.height = ''; $('#replyComposer').classList.remove('has-text');
    renderThread(); renderThreads();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (device.classList.contains('sheet-open')) closeSheet(); else setDrawer(false); }
  });

  // Resume any threads that were mid-run when the page was reloaded.
  state.threads.filter((t) => t.status === 'running').forEach(runThread);
  syncChips(); show('home');
  setInterval(renderThreads, 60e3);
})();
