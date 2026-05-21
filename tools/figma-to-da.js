import DA_SDK from 'https://da.live/nx/utils/sdk.js';

const STORAGE_KEY = 'figma-to-da:serverUrl';
const STORAGE_KEY_TOKEN = 'figma-to-da:figmaToken';
const STORAGE_KEY_REPO = 'figma-to-da:repoPath';
const HISTORY_KEY = 'figma-da:history';
const POLL_INTERVAL = 3000;
const MAX_HISTORY = 20;

const DEFAULT_BREAKPOINTS = [
  { label: 'Desktop', width: 1440, figmaUrl: '' },
  { label: 'Tablet', width: 768, figmaUrl: '' },
  { label: 'Mobile', width: 390, figmaUrl: '' },
];

// ── Multi-breakpoint input ─────────────────────────────────────────────────────
function buildBreakpointList(initial = DEFAULT_BREAKPOINTS) {
  const rows = [];

  const list = el('div', { class: 'bp-list' });

  function updateRemoveButtons() {
    rows.forEach((r) => {
      r.removeBtn.style.visibility = rows.length > 1 ? '' : 'hidden';
    });
  }

  function addRow(data = { label: '', width: null, figmaUrl: '' }) {
    const labelInput = el('input', { type: 'text', placeholder: 'Label', value: data.label });
    const widthInput = el('input', { type: 'number', placeholder: 'px', value: data.width ?? '', min: '1', max: '9999' });
    const urlInput = el('input', { type: 'text', placeholder: 'https://www.figma.com/design/…', value: data.figmaUrl });
    const removeBtn = el('button', { class: 'bp-remove', type: 'button', title: 'Remove' }, '×');

    const row = el('div', { class: 'bp-row' }, labelInput, widthInput, urlInput, removeBtn);
    const rowData = { el: row, labelInput, widthInput, urlInput, removeBtn };

    removeBtn.addEventListener('click', () => {
      if (rows.length <= 1) return;
      const idx = rows.indexOf(rowData);
      if (idx !== -1) rows.splice(idx, 1);
      row.remove();
      updateRemoveButtons();
    });

    rows.push(rowData);
    list.append(row);
    updateRemoveButtons();
  }

  initial.forEach((d) => addRow(d));

  const addBtn = el('button', { class: 'bp-add', type: 'button' }, '+ Add breakpoint');
  addBtn.addEventListener('click', () => addRow());

  const wrap = el('div', { class: 'bp-wrap' },
    el('div', { class: 'bp-header' },
      el('span', { class: 'form-label' }, 'Breakpoints'),
      el('span', { class: 'bp-hint' }, 'Label · Width · Figma URL')),
    list,
    addBtn);

  return {
    el: wrap,
    getBreakpoints() {
      return rows
        .map((r) => ({
          label: r.labelInput.value.trim() || 'Breakpoint',
          width: r.widthInput.value ? Number(r.widthInput.value) : null,
          figmaUrl: r.urlInput.value.trim(),
        }))
        .filter((b) => b.figmaUrl.includes('figma.com'));
    },
  };
}

// ── Tiny DOM builder ──────────────────────────────────────────────────────────
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('data-')) node.dataset[k.slice(5)] = v;
    else node[k] = v;
  });
  children.flat().forEach((c) => {
    if (c == null) return;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

// ── Pixel Claude Robot SVG ────────────────────────────────────────────────────
function buildRobotSVG(cls = 'robot--idle') {
  const wrap = el('div', { class: 'robot-col' });
  const svgWrap = el('div', {});
  svgWrap.innerHTML = `<svg class="robot ${cls}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Left ear nub -->
  <rect x="12" y="12" width="8" height="16" fill="#C17850"/>
  <!-- Right ear nub -->
  <rect x="60" y="12" width="8" height="16" fill="#C17850"/>
  <!-- Head -->
  <rect x="20" y="8" width="40" height="28" fill="#C17850"/>
  <!-- Head top shadow row -->
  <rect x="20" y="8" width="40" height="4" fill="#8B5533"/>
  <!-- Left eye -->
  <rect class="robot-eye" x="26" y="16" width="8" height="8" fill="#1A1A1A"/>
  <!-- Right eye -->
  <rect class="robot-eye" x="46" y="16" width="8" height="8" fill="#1A1A1A"/>
  <!-- Eye highlights -->
  <rect x="26" y="16" width="2" height="2" fill="#D49068"/>
  <rect x="46" y="16" width="2" height="2" fill="#D49068"/>
  <!-- Neck -->
  <rect x="28" y="36" width="24" height="4" fill="#8B5533"/>
  <!-- Body -->
  <rect x="16" y="40" width="48" height="20" fill="#C17850"/>
  <!-- Body bottom shadow row -->
  <rect x="16" y="56" width="48" height="4" fill="#8B5533"/>
  <!-- Left arm -->
  <rect class="robot-arm-l" x="8" y="42" width="8" height="14" fill="#C17850"/>
  <!-- Right arm -->
  <rect class="robot-arm-r" x="64" y="42" width="8" height="14" fill="#C17850"/>
  <!-- Left leg -->
  <rect x="22" y="60" width="10" height="12" fill="#C17850"/>
  <!-- Right leg -->
  <rect x="48" y="60" width="10" height="12" fill="#C17850"/>
</svg>`;

  const statusLabel = el('div', { class: 'robot-status-label' }, 'working…');
  wrap.append(svgWrap, statusLabel);

  return {
    el: wrap,
    get svg() { return svgWrap.querySelector('.robot'); },
    get statusLabel() { return statusLabel; },
    setState(state) {
      const svg = svgWrap.querySelector('.robot');
      svg.setAttribute('class', `robot robot--${state}`);
      const labels = { idle: '', working: 'analyzing…', parallel: 'multitasking!', done: 'done! 🎉' };
      statusLabel.textContent = labels[state] || state;
      statusLabel.classList.toggle('visible', state !== 'idle');
    },
  };
}

// ── Pipeline DAG (DA mode) ────────────────────────────────────────────────────
function buildPipelineDA() {
  const dag = el('div', { class: 'pipeline-dag' });

  function makeStep(id, label) {
    const row = el('div', { class: 'pipe-step', 'data-id': id, 'data-status': 'pending' });
    const dot = el('div', { class: 'pipe-dot' });
    const lbl = el('span', { class: 'pipe-step-label' }, label);
    const badge = el('span', { class: 'pipe-step-badge' });
    row.append(dot, lbl, badge);
    return row;
  }

  function makeLine(id = '') {
    return el('div', { class: 'pipe-line', 'data-line': id });
  }

  function makeParallelItem(id, label) {
    const row = el('div', { class: 'pipe-parallel-item', 'data-id': id, 'data-status': 'pending' });
    const dot = el('div', { class: 'pipe-parallel-dot' });
    const lbl = el('span', { class: 'pipe-parallel-label' }, label);
    const badge = el('span', { class: 'pipe-parallel-badge' });
    row.append(dot, lbl, badge);
    return row;
  }

  const analyzeStep = makeStep('analyze', 'Analyze design');
  const lineA = makeLine('a');
  const parallelSection = el('div', { class: 'pipe-parallel-section' });
  const buildItem = makeParallelItem('build-blocks', 'Build new blocks');
  const extractItem = makeParallelItem('extract', 'Extract content');
  parallelSection.append(buildItem, extractItem);
  const lineB = makeLine('b');
  const assembleStep = makeStep('assemble', 'Assemble document');
  const lineC = makeLine('c');
  const uploadStep = makeStep('upload', 'Upload & preview');

  dag.append(analyzeStep, lineA, parallelSection, lineB, assembleStep, lineC, uploadStep);

  const STATUS_LABELS = {
    pending: '',
    running: '⟳ running',
    done: '✓ done',
    error: '✗ error',
    skipped: '— skipped',
  };

  function setStep(row, status) {
    row.dataset.status = status;
    const badge = row.querySelector('.pipe-step-badge, .pipe-parallel-badge');
    if (badge) badge.textContent = STATUS_LABELS[status] ?? '';
  }

  function updateLines(stageNum) {
    lineA.className = 'pipe-line' + (stageNum > 0 ? ' pipe-line--done' : stageNum === 0 ? ' pipe-line--active' : '');
    lineB.className = 'pipe-line' + (stageNum > 1 ? ' pipe-line--done' : stageNum === 1 ? ' pipe-line--active' : '');
    lineC.className = 'pipe-line' + (stageNum > 2 ? ' pipe-line--done' : stageNum === 2 ? ' pipe-line--active' : '');
  }

  function update(job) {
    const stage = job.stage ?? 0;
    const workers = job.workers ?? {};
    const isDone = job.status === 'done';
    const isError = job.status === 'error';

    setStep(analyzeStep, stage === 0 ? 'running' : 'done');
    updateLines(stage);

    const buildStatus = workers['build-blocks'] ?? (stage < 1 ? 'pending' : stage === 1 ? 'running' : 'done');
    const extractStatus = workers['extract'] ?? (stage < 1 ? 'pending' : stage === 1 ? 'running' : 'done');
    setStep(buildItem, buildStatus);
    setStep(extractItem, extractStatus);

    if (stage < 2) {
      setStep(assembleStep, 'pending');
      setStep(uploadStep, 'pending');
    } else if (stage === 2) {
      setStep(assembleStep, 'running');
      setStep(uploadStep, 'pending');
    } else if (stage === 3) {
      setStep(assembleStep, 'done');
      setStep(uploadStep, isDone ? 'done' : 'running');
    }

    if (isDone) {
      setStep(analyzeStep, 'done');
      setStep(buildItem, workers['build-blocks'] ?? 'done');
      setStep(extractItem, 'done');
      setStep(assembleStep, 'done');
      setStep(uploadStep, 'done');
      updateLines(4);
    }
    if (isError) {
      const cur = uploadStep.dataset.status;
      if (cur === 'running' || cur === 'pending') setStep(uploadStep, 'error');
    }
  }

  return { el: dag, update };
}

// ── Pipeline DAG (Snowflake mode) ─────────────────────────────────────────────
function buildPipelineSnowflake() {
  const dag = el('div', { class: 'pipeline-dag' });

  function makeStep(id, label) {
    const row = el('div', { class: 'pipe-step', 'data-id': id, 'data-status': 'pending' });
    row.append(el('div', { class: 'pipe-dot' }), el('span', { class: 'pipe-step-label' }, label), el('span', { class: 'pipe-step-badge' }));
    return row;
  }

  const analyzeStep = makeStep('analyze', 'Analyze design');
  const line = el('div', { class: 'pipe-line' });
  const generateStep = makeStep('generate', 'Generate HTML');

  dag.append(analyzeStep, line, generateStep);

  const LABELS = { pending: '', running: '⟳ running', done: '✓ done', error: '✗ error' };
  function setStep(row, s) {
    row.dataset.status = s;
    const b = row.querySelector('.pipe-step-badge');
    if (b) b.textContent = LABELS[s] ?? '';
  }

  function update(job) {
    const stage = job.stage ?? 0;
    const isDone = job.status === 'done';
    setStep(analyzeStep, stage === 0 ? 'running' : 'done');
    line.className = 'pipe-line' + (stage > 0 ? ' pipe-line--done' : '');
    setStep(generateStep, stage === 0 ? 'pending' : isDone ? 'done' : 'running');
  }

  return { el: dag, update };
}

// ── Pipeline DAG (HTML → DA mode) ────────────────────────────────────────────
function buildPipelineHtmlToDA() {
  const dag = el('div', { class: 'pipeline-dag' });

  function makeStep(id, label) {
    const row = el('div', { class: 'pipe-step', 'data-id': id, 'data-status': 'pending' });
    row.append(el('div', { class: 'pipe-dot' }), el('span', { class: 'pipe-step-label' }, label), el('span', { class: 'pipe-step-badge' }));
    return row;
  }

  function makeLine() { return el('div', { class: 'pipe-line' }); }

  const genStep = makeStep('gen-html', 'Generate prototype HTML');
  const lineA = makeLine();
  const convertStep = makeStep('html-map', 'Map HTML to Milo blocks');
  const lineB = makeLine();
  const pushStep = makeStep('upload', 'Assemble & upload to DA');

  dag.append(genStep, lineA, convertStep, lineB, pushStep);

  const LABELS = { pending: '', running: '⟳ running', done: '✓ done', error: '✗ error', skipped: '— skipped' };
  function setStep(row, s) {
    row.dataset.status = s;
    const b = row.querySelector('.pipe-step-badge');
    if (b) b.textContent = LABELS[s] ?? '';
  }

  function update(job) {
    const stage = job.stage ?? 0;
    const isDone = job.status === 'done';
    const isError = job.status === 'error';

    setStep(genStep, stage === 0 ? 'running' : 'done');
    lineA.className = 'pipe-line' + (stage > 0 ? ' pipe-line--done' : stage === 0 ? ' pipe-line--active' : '');
    setStep(convertStep, stage < 1 ? 'pending' : stage === 1 ? 'running' : 'done');
    lineB.className = 'pipe-line' + (stage > 1 ? ' pipe-line--done' : stage === 1 ? ' pipe-line--active' : '');
    setStep(pushStep, stage < 2 ? 'pending' : isDone ? 'done' : 'running');

    if (isDone) {
      setStep(genStep, 'done'); setStep(convertStep, 'done'); setStep(pushStep, 'done');
      lineA.className = 'pipe-line pipe-line--done';
      lineB.className = 'pipe-line pipe-line--done';
    }
    if (isError) {
      const cur = pushStep.dataset.status;
      if (cur === 'running' || cur === 'pending') setStep(pushStep, 'error');
    }
  }

  return { el: dag, update };
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function buildSidebar(onNewClick, onEntryClick, onPendingClick) {
  const sidebar = el('div', { class: 'sidebar' });
  const header = el('div', { class: 'sidebar-header' });
  const title = el('span', { class: 'sidebar-title' }, 'Sessions');
  const newBtn = el('button', { class: 'btn-new', type: 'button' }, '+ New');
  newBtn.addEventListener('click', onNewClick);
  header.append(title, newBtn);

  const list = el('div', { class: 'sidebar-list' });
  const emptyMsg = el('div', { class: 'sidebar-empty' }, 'No prototypes yet.\nRun one to see it here.');
  list.append(emptyMsg);

  sidebar.append(header, list);

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  }

  function saveHistory(entries) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); } catch { /* storage unavailable */ }
  }

  let pendingEntry = null;

  function renderList(entries) {
    const pendingItems = [];
    if (pendingEntry) {
      const item = el('div', { class: 'sidebar-item sidebar-item--pending' });
      const badgeLabel = pendingEntry.mode === 'da' ? 'DA' : pendingEntry.mode === 'html-to-da' ? 'H→DA' : '❄';
      const badgeClass = `sidebar-badge sidebar-badge-${pendingEntry.mode === 'html-to-da' ? 'html-to-da' : pendingEntry.mode}`;
      const badge = el('span', { class: badgeClass }, badgeLabel);
      const info = el('div', { class: 'sidebar-item-info' },
        el('span', { class: 'sidebar-slug' }, pendingEntry.slug || 'running…'),
        el('span', { class: 'sidebar-time' }, pendingEntry.time),
      );
      const dot = el('div', { class: 'sidebar-dot' });
      item.append(badge, info, dot);
      item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        onPendingClick?.();
      });
      pendingItems.push(item);
    }

    if (entries.length === 0 && !pendingEntry) {
      list.replaceChildren(emptyMsg);
      return;
    }
    list.replaceChildren(...pendingItems, ...entries.map((entry, idx) => {
      const isUrl = entry.value?.startsWith('http');
      const item = el('div', { class: `sidebar-item${entry.isError ? ' sidebar-item--error' : ''}` });
      const badgeLabel = entry.mode === 'da' ? 'DA' : entry.mode === 'html-to-da' ? 'H→DA' : '❄';
      const badgeClass = `sidebar-badge sidebar-badge-${entry.mode === 'html-to-da' ? 'html-to-da' : entry.mode}`;
      const badge = el('span', { class: badgeClass }, badgeLabel);
      const info = el('div', { class: 'sidebar-item-info' },
        el('span', { class: 'sidebar-slug' }, entry.isError ? 'failed' : (entry.slug || '—')),
        el('span', { class: 'sidebar-time' }, entry.time),
      );
      const dot = el('div', { class: 'sidebar-dot' });
      item.append(badge, info, dot);
      item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        onEntryClick(entry);
      });
      return item;
    }));
  }

  let history = loadHistory();
  renderList(history);

  return {
    el: sidebar,
    addEntry(entry) {
      history.unshift(entry);
      if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
      saveHistory(history);
      renderList(history);
    },
    setPendingEntry(entry) {
      pendingEntry = entry;
      renderList(history);
    },
    markPendingActive() {
      const pendingItem = list.querySelector('.sidebar-item--pending');
      if (pendingItem) {
        document.querySelectorAll('.sidebar-item').forEach((i) => i.classList.remove('active'));
        pendingItem.classList.add('active');
      }
    },
    markActive(idx) {
      const items = list.querySelectorAll('.sidebar-item');
      items.forEach((item, i) => item.classList.toggle('active', i === idx));
    },
  };
}

// ── Preview panel ─────────────────────────────────────────────────────────────
function buildPreviewPanel() {
  const outer = el('div', { class: 'preview-outer' });
  outer.classList.add('open');

  // Handle is ALWAYS visible (outside the collapsible area)
  const handle = el('div', { class: 'preview-handle' });
  const handleLabel = el('span', { class: 'preview-handle-label' }, 'Preview');
  const badgeSlot = el('span', {});  // badge inserted here after job
  handleLabel.append(badgeSlot);
  const chevron = el('span', { class: 'preview-handle-chevron' }, '▲');
  handle.append(handleLabel, chevron);

  // Collapsible area
  const area = el('div', { class: 'preview-area' });
  const content = el('div', { class: 'preview-content' });
  const emptyState = el('div', { class: 'preview-empty' },
    el('div', { class: 'preview-empty-icon' }, '🖼'),
    el('div', { class: 'preview-empty-text' }, 'Your preview will appear here'),
  );
  content.append(emptyState);
  area.append(content);

  // Handle is sibling of area, both inside outer
  outer.append(handle, area);

  handle.addEventListener('click', () => {
    outer.classList.toggle('open');
  });

  function open() { outer.classList.add('open'); }

  function showPreview(value, mode, serverUrl) {
    // Update badge
    const previewBadgeLabel = mode === 'da' ? 'DA' : mode === 'html-to-da' ? 'H→DA' : '❄';
    const previewBadgeClass = `preview-badge preview-badge-${mode === 'html-to-da' ? 'html-to-da' : mode}`;
    badgeSlot.replaceChildren(el('span', { class: previewBadgeClass }, previewBadgeLabel));

    content.replaceChildren();

    if (mode === 'snowflake' && value && !value.startsWith('http')) {
      const filename = value.split('/').at(-1);
      const iframeSrc = `${serverUrl}/snowflake/${filename}`;
      const iframe = el('iframe', { class: 'preview-iframe', src: iframeSrc, title: 'Snowflake preview' });
      content.append(iframe);
      open();
    } else if ((mode === 'da' || mode === 'html-to-da') && value && value.startsWith('http')) {
      const card = el('div', { class: 'preview-da-card' });
      const openBtn = el('button', { class: 'btn', type: 'button' }, 'Open in new tab →');
      openBtn.addEventListener('click', () => window.open(value, '_blank', 'noopener'));
      card.append(
        el('div', { class: 'card-label' }, 'DA Page Preview'),
        el('a', { class: 'preview-da-url', href: value, target: '_blank', rel: 'noopener' }, value),
        openBtn,
      );
      content.append(card);
      open();
    } else {
      content.append(emptyState);
    }
  }

  return { el: outer, showPreview };
}

// ── Main UI builder ───────────────────────────────────────────────────────────
function buildUI(context, token, username) {
  let currentMode = 'da';
  let currentServerUrl = localStorage.getItem(STORAGE_KEY) || 'http://localhost:3002';
  let isViewingActiveJob = false;
  let savedLiveDag = null;
  let savedLiveRobot = null;
  let savedLogChildren = null;
  let dagInstance = buildPipelineDA();
  let robotInstance = null;

  // ── Topbar ──
  const topbar = el('div', { class: 'topbar' });

  const topbarBrand = el('div', { class: 'topbar-brand' });
  const topbarRobotWrap = el('div', { class: 'topbar-robot-wrap' });
  topbarRobotWrap.innerHTML = `<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style="image-rendering:pixelated">
    <rect x="12" y="12" width="8" height="16" fill="#C17850"/>
    <rect x="60" y="12" width="8" height="16" fill="#C17850"/>
    <rect x="20" y="8" width="40" height="28" fill="#C17850"/>
    <rect x="20" y="8" width="40" height="4" fill="#8B5533"/>
    <rect x="26" y="16" width="8" height="8" fill="#1A1A1A"/>
    <rect x="46" y="16" width="8" height="8" fill="#1A1A1A"/>
    <rect x="28" y="36" width="24" height="4" fill="#8B5533"/>
    <rect x="16" y="40" width="48" height="20" fill="#C17850"/>
    <rect x="16" y="56" width="48" height="4" fill="#8B5533"/>
    <rect x="22" y="60" width="10" height="12" fill="#C17850"/>
    <rect x="48" y="60" width="10" height="12" fill="#C17850"/>
  </svg>`;

  const topbarTitle = el('span', { class: 'topbar-title' }, 'Figma → DA Prototyper');
  topbarBrand.append(topbarRobotWrap, topbarTitle);

  const spacer = el('div', { class: 'topbar-spacer' });

  const PRIMARY_MODES = ['da', 'html-to-da'];
  const modeButtons = PRIMARY_MODES.map((m) => {
    const btn = el('button', { class: `mode-btn${m === currentMode ? ' active' : ''}`, type: 'button' },
      m === 'da' ? 'Figma → DA' : 'Figma → HTML → DA');
    btn.addEventListener('click', () => {
      if (currentMode === m) return;
      currentMode = m;
      modeButtons.forEach((b, i) => b.classList.toggle('active', PRIMARY_MODES[i] === m));
      runBtn.textContent = 'Prototype →';
      resetPipeline();
    });
    return btn;
  });

  const modeToggle = el('div', { class: 'mode-toggle' }, ...modeButtons);
  const userChip = el('div', { class: 'topbar-user' }, username);

  topbar.append(topbarBrand, spacer, modeToggle, userChip);

  // ── Form card ──
  const figmaInput = el('textarea', { placeholder: 'https://www.figma.com/design/...' });

  // Multi-breakpoint toggle
  let bpMultiMode = false;
  let breakpointList = buildBreakpointList();
  breakpointList.el.style.display = 'none';

  const bpToggle = el('button', { class: 'bp-toggle', type: 'button' }, '＋ Add breakpoints');
  bpToggle.addEventListener('click', () => {
    bpMultiMode = !bpMultiMode;
    figmaInput.style.display = bpMultiMode ? 'none' : '';
    breakpointList.el.style.display = bpMultiMode ? '' : 'none';
    bpToggle.textContent = bpMultiMode ? '× Single URL' : '＋ Add breakpoints';
    if (bpMultiMode) {
      // Reset to fresh default list each time multi-mode is activated
      const newList = buildBreakpointList();
      breakpointList.el.replaceWith(newList.el);
      breakpointList = newList;
    }
  });

  const serverInput = el('input', { type: 'text', placeholder: 'http://localhost:3002', value: currentServerUrl });
  serverInput.addEventListener('blur', () => { currentServerUrl = serverInput.value.trim(); localStorage.setItem(STORAGE_KEY, currentServerUrl); });

  const figmaTokenInput = el('input', { type: 'password', placeholder: 'figd_…', value: localStorage.getItem(STORAGE_KEY_TOKEN) || '' });
  figmaTokenInput.addEventListener('blur', () => { localStorage.setItem(STORAGE_KEY_TOKEN, figmaTokenInput.value.trim()); });

  const repoPathInput = el('input', { type: 'text', placeholder: '/Users/you/Code/da-playground', value: localStorage.getItem(STORAGE_KEY_REPO) || '' });
  repoPathInput.addEventListener('blur', () => { localStorage.setItem(STORAGE_KEY_REPO, repoPathInput.value.trim()); });

  const runBtn = el('button', { class: 'btn', type: 'button' }, 'Prototype →');
  const errorMsg = el('div', { class: 'error-msg' });

  const customInput = el('textarea', { placeholder: 'e.g. "Use a dark background" or "Render CTAs in orange"' });
  const customRow = el('label', { class: 'custom-row' },
    el('span', { class: 'form-label' }, 'Custom instructions (optional)'),
    customInput);

  // Advanced snowflake toggle (collapsed by default)
  const snowflakeContent = el('div', { class: 'advanced-content', style: 'display:none' },
    el('p', { class: 'hint' }, 'Generate a self-contained HTML file only — useful for custom embedding or further editing.'),
    customRow,
    el('button', {
      class: 'btn', type: 'button',
      style: 'align-self:flex-start',
    }, 'Generate HTML →'),
  );
  const advancedToggle = el('button', { class: 'advanced-toggle', type: 'button' }, '▸ Generate Snowflake HTML (advanced)');
  advancedToggle.addEventListener('click', () => {
    const open = snowflakeContent.style.display !== 'none';
    snowflakeContent.style.display = open ? 'none' : 'flex';
    advancedToggle.textContent = open
      ? '▸ Generate Snowflake HTML (advanced)'
      : '▾ Generate Snowflake HTML (advanced)';
  });
  // Wire the snowflake run button inside the advanced section
  const snowflakeRunBtn = snowflakeContent.querySelector('button.btn');
  snowflakeRunBtn.addEventListener('click', async () => {
    clearError();
    const serverUrl = serverInput.value.trim();
    const repoPath = repoPathInput.value.trim();
    const figmaToken = figmaTokenInput.value.trim();

    // Resolve figma source — single URL or multi-breakpoint
    let sfFigmaPayload;
    let sfPrimaryFigmaUrl;
    if (bpMultiMode) {
      const bps = breakpointList.getBreakpoints();
      if (!bps.length) { showError('Add at least one valid Figma URL (figma.com/design/…).'); return; }
      sfFigmaPayload = { breakpoints: bps };
      sfPrimaryFigmaUrl = bps[0].figmaUrl;
    } else {
      const figmaUrl = figmaInput.value.trim();
      if (!figmaUrl || !figmaUrl.includes('figma.com')) { showError('Please enter a valid Figma URL.'); return; }
      sfFigmaPayload = { figmaUrl };
      sfPrimaryFigmaUrl = figmaUrl;
    }

    if (!serverUrl) { showError('Please enter your agent server URL.'); configContent.style.display = ''; return; }
    if (!repoPath) { showError('Please enter the Repo Path.'); configContent.style.display = ''; return; }
    currentServerUrl = serverUrl;
    localStorage.setItem(STORAGE_KEY, serverUrl);
    const savedMode = currentMode;
    currentMode = 'snowflake';
    resetPipeline();
    showPipeline();
    robotInstance.setState('working');
    isViewingActiveJob = true;
    sidebarInstance.setPendingEntry({
      mode: 'snowflake',
      figmaUrl: sfPrimaryFigmaUrl,
      slug: 'running…',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    sidebarInstance.markPendingActive();
    try {
      const res = await fetch(`${serverUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sfFigmaPayload,
          daContext: { ...context, token, username },
          mode: 'snowflake',
          repoPath,
          ...(figmaToken && { figmaToken }),
          ...(customInput.value.trim() && { customPrompt: customInput.value.trim() }),
        }),
      });
      if (!res.ok) throw new Error(`Failed to start job (HTTP ${res.status})`);
      const { jobId } = await res.json();
      const { value, summary, blockBranch, usage, mode } = await pollJob(serverUrl, jobId);
      if (isViewingActiveJob) {
        showResult(value, summary, blockBranch, usage, mode);
        if (value) previewPanel.showPreview(value, mode, serverUrl);
      }
      isViewingActiveJob = false;
      savedLiveDag = null; savedLiveRobot = null; savedLogChildren = null;
      sidebarInstance.setPendingEntry(null);
      let slug = value ? value.split('/').at(-1).replace(/\.html$/, '') : '—';
      sidebarInstance.addEntry({ mode, figmaUrl: sfPrimaryFigmaUrl, value, slug, summary, blockBranch,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isError: false, ts: Date.now() });
    } catch (e) {
      if (isViewingActiveJob) showResult('error', e.message, null, null, 'snowflake');
      isViewingActiveJob = false;
      savedLiveDag = null; savedLiveRobot = null; savedLogChildren = null;
      sidebarInstance.setPendingEntry(null);
      sidebarInstance.addEntry({ mode: 'snowflake', figmaUrl: sfPrimaryFigmaUrl, value: null, slug: '—',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isError: true, ts: Date.now() });
    } finally {
      currentMode = savedMode;
    }
  });

  const advancedSection = el('div', { class: 'advanced-section' }, advancedToggle, snowflakeContent);

  const configContent = el('div', { class: 'config-content' },
    el('label', { class: 'form-group' },
      el('span', { class: 'form-label' }, 'Agent Server URL'),
      serverInput),
    el('label', { class: 'form-group' },
      el('span', { class: 'form-label' }, 'Repo Path'),
      repoPathInput),
    el('label', { class: 'form-group' },
      el('span', { class: 'form-label' }, 'Figma Token'),
      figmaTokenInput),
    el('p', { class: 'hint' }, 'Run npm start in forge/figma-to-da. Server URL defaults to localhost:3002. Repo path and Figma token are sent per-request and saved locally.'));
  const configToggle = el('button', { class: 'config-toggle', type: 'button' }, '⚙ Server config');
  configContent.style.display = 'none';
  configToggle.addEventListener('click', () => {
    const open = configContent.style.display !== 'none';
    configContent.style.display = open ? 'none' : '';
    configToggle.textContent = open ? '⚙ Server config' : '⚙ Hide config';
  });

  const formCard = el('div', { class: 'card' },
    el('span', { class: 'card-label' }, 'Design Source'),
    el('div', { class: 'form-group' },
      el('span', { class: 'form-label' }, 'Figma URL'),
      figmaInput),
    breakpointList.el,
    bpToggle,
    errorMsg,
    el('div', { style: 'display:flex; gap:10px; align-items:center' }, runBtn, configToggle),
    el('div', { class: 'config-section' }, configContent),
    advancedSection);

  // ── Pipeline panel ──
  const pipelinePanel = el('div', { class: 'card pipeline-panel' });
  const panelLabel = el('span', { class: 'card-label' }, 'Pipeline');

  const pipelineBody = el('div', { class: 'pipeline-body' });
  robotInstance = buildRobotSVG('idle');
  pipelineBody.append(robotInstance.el);
  pipelineBody.append(dagInstance.el);

  const logList = el('div', { class: 'pipe-log' });

  const pipeStats = el('div', { class: 'pipe-stats' });
  const pipeResultActions = el('div', { class: 'pipe-result-actions' });

  pipelinePanel.append(panelLabel, pipelineBody, logList, pipeStats, pipeResultActions);

  // ── Preview & sidebar ──
  const previewPanel = buildPreviewPanel();

  const sidebarInstance = buildSidebar(
    () => resetForm(),
    (entry) => { restoreSession(entry); },
    () => {
      isViewingActiveJob = true;
      if (savedLiveDag) {
        dagInstance.el.replaceWith(savedLiveDag.el);
        dagInstance = savedLiveDag;
        savedLiveDag = null;
        robotInstance.el.replaceWith(savedLiveRobot.el);
        robotInstance = savedLiveRobot;
        savedLiveRobot = null;
        const newEntries = [...logList.children];
        logList.replaceChildren(...savedLogChildren, ...newEntries);
        savedLogChildren = null;
        pipeResultActions.replaceChildren();
        pipeStats.replaceChildren();
        pipeStats.classList.remove('visible');
      }
      pipelinePanel.classList.add('visible');
      runBtn.disabled = true;
      snowflakeRunBtn.disabled = true;
      modeButtons.forEach((b) => { b.disabled = true; });
    },
  );

  // ── Layout assembly ──
  const scrollArea = el('div', { class: 'scroll-area' }, formCard, pipelinePanel);
  const main = el('div', { class: 'main' }, scrollArea, previewPanel.el);
  const workspace = el('div', { class: 'workspace' }, sidebarInstance.el, main);

  document.body.append(topbar, workspace);

  // ── Helpers ──
  function showError(msg) { errorMsg.textContent = msg; errorMsg.classList.add('visible'); }
  function clearError() { errorMsg.textContent = ''; errorMsg.classList.remove('visible'); }

  function resetPipeline() {
    // Rebuild DAG for new mode
    const newDag = currentMode === 'da' ? buildPipelineDA()
      : currentMode === 'html-to-da' ? buildPipelineHtmlToDA()
      : buildPipelineSnowflake();
    dagInstance.el.replaceWith(newDag.el);
    dagInstance = newDag;
    // Rebuild robot
    const newRobot = buildRobotSVG('idle');
    robotInstance.el.replaceWith(newRobot.el);
    robotInstance = newRobot;
    logList.replaceChildren();
    pipeStats.replaceChildren();
    pipeStats.classList.remove('visible');
    pipeResultActions.replaceChildren();
    pipelinePanel.classList.remove('visible');
  }

  function resetForm() {
    figmaInput.value = '';
    customInput.value = '';
    runBtn.disabled = false;
    snowflakeRunBtn.disabled = false;
    modeButtons.forEach((b) => { b.disabled = false; });
    clearError();
    resetPipeline();
  }

  function showPipeline() {
    pipelinePanel.classList.add('visible');
    runBtn.disabled = true;
    snowflakeRunBtn.disabled = true;
    modeButtons.forEach((b) => { b.disabled = true; });
  }

  function restoreSession(entry) {
    if (isViewingActiveJob) {
      savedLiveDag = dagInstance;
      savedLiveRobot = robotInstance;
      savedLogChildren = [...logList.children];
    }
    isViewingActiveJob = false;
    const isPrimary = entry.mode === 'da' || entry.mode === 'html-to-da';
    if (currentMode !== entry.mode) {
      currentMode = isPrimary ? entry.mode : currentMode;
      modeButtons.forEach((b, i) => b.classList.toggle('active', PRIMARY_MODES[i] === currentMode));
      runBtn.textContent = 'Prototype →';
    }

    figmaInput.value = entry.figmaUrl || '';
    clearError();

    // Build the correct DAG for the entry's mode, even for snowflake sessions
    const savedMode = currentMode;
    currentMode = entry.mode;
    resetPipeline();
    currentMode = savedMode;

    runBtn.disabled = false;
    snowflakeRunBtn.disabled = false;
    modeButtons.forEach((b) => { b.disabled = false; });
    pipelinePanel.classList.add('visible');
    robotInstance.setState('idle');

    if (!entry.isError && entry.value) {
      const syntheticDone = entry.mode === 'da'
        ? { status: 'done', stage: 4, workers: {} }
        : entry.mode === 'html-to-da'
          ? { status: 'done', stage: 2 }
          : { status: 'done', stage: 1 };
      dagInstance.update(syntheticDone);

      const isUrl = entry.value.startsWith('http');
      if (isUrl) {
        const chip = el('a', { class: 'result-url-chip', href: entry.value, target: '_blank', rel: 'noopener' }, entry.value);
        const openBtn = el('button', { class: 'btn', type: 'button' }, 'Open preview →');
        openBtn.addEventListener('click', () => window.open(entry.value, '_blank', 'noopener'));
        pipeResultActions.append(chip, openBtn);
      } else {
        pipeResultActions.append(el('span', { class: 'result-url-chip result-url-chip--path' }, entry.value));
      }
      const resetBtn = el('button', { class: 'btn-ghost btn', type: 'button' }, '← New prototype');
      resetBtn.addEventListener('click', resetForm);
      pipeResultActions.append(resetBtn);
      const { summary, blockBranch } = entry;
      if (summary || blockBranch) {
        const text = blockBranch ? `Block branch: ${blockBranch}${summary ? `\n\n${summary}` : ''}` : summary;
        pipeResultActions.append(el('pre', { class: 'result-summary-block' }, text));
      }
      showUsage(entry.usage);
    }

    if (entry.value) {
      previewPanel.showPreview(entry.value, entry.mode, localStorage.getItem(STORAGE_KEY) || '');
    }
  }

  function statCell(label, value) {
    return el('div', { class: 'token-cell' },
      el('span', { class: 'token-cell-value' }, value),
      el('span', { class: 'token-cell-label' }, label));
  }

  function showUsage(usage) {
    if (!usage) return;
    const fmt = (n) => n != null ? n.toLocaleString() : '—';
    const fmtMs = (ms) => ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`;
    const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
    pipeStats.replaceChildren(
      el('span', { class: 'card-label' }, 'Token Usage'),
      el('div', { class: 'token-grid' },
        statCell('Input', fmt(usage.inputTokens)),
        statCell('Output', fmt(usage.outputTokens)),
        statCell('Cache read', fmt(usage.cacheReadTokens)),
        statCell('Cache write', fmt(usage.cacheWriteTokens)),
        statCell('Total', fmt(total)),
        ...(usage.costUsd != null ? [statCell('Cost', `$${usage.costUsd.toFixed(4)}`)] : []),
        ...(usage.numTurns != null ? [statCell('Turns', String(usage.numTurns))] : []),
        ...(usage.durationMs != null ? [statCell('Duration', fmtMs(usage.durationMs))] : []),
      ),
    );
    pipeStats.classList.add('visible');
  }

  function showResult(value, summary, blockBranch, usage, mode, daUrl) {
    runBtn.disabled = false;
    snowflakeRunBtn.disabled = false;
    modeButtons.forEach((b) => { b.disabled = false; });

    const isSnowflake = mode === 'snowflake';
    const isError = !value || value === 'error';
    const isUrl = value?.startsWith('http');

    // Robot celebrate or idle
    robotInstance.setState(isError ? 'idle' : 'done');
    setTimeout(() => { if (robotInstance) robotInstance.setState('idle'); }, 3500);

    pipeResultActions.replaceChildren();

    if (!isError) {
      if (isUrl) {
        const chip = el('a', { class: 'result-url-chip', href: value, target: '_blank', rel: 'noopener' }, value);
        const openBtn = el('button', { class: 'btn', type: 'button' }, 'Open preview →');
        openBtn.addEventListener('click', () => window.open(value, '_blank', 'noopener'));
        pipeResultActions.append(chip, openBtn);

        // Show DA edit link when it differs from the preview URL
        if (daUrl && daUrl !== value) {
          const daChip = el('a', { class: 'result-url-chip result-url-chip--da', href: daUrl, target: '_blank', rel: 'noopener' }, daUrl);
          const daBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, 'Edit in DA →');
          daBtn.addEventListener('click', () => window.open(daUrl, '_blank', 'noopener'));
          pipeResultActions.append(daChip, daBtn);
        }
      } else if (isSnowflake) {
        pipeResultActions.append(el('span', { class: 'result-url-chip result-url-chip--path' }, value));
      }
    }

    const resetBtn = el('button', { class: 'btn-ghost btn', type: 'button' }, '← New prototype');
    resetBtn.addEventListener('click', resetForm);
    pipeResultActions.append(resetBtn);

    showUsage(usage);

    if (summary || blockBranch) {
      const text = blockBranch ? `Block branch: ${blockBranch}${summary ? `\n\n${summary}` : ''}` : summary;
      pipeResultActions.append(el('pre', { class: 'result-summary-block' }, text));
    }
  }

  // ── Polling ──
  async function pollJob(serverUrl, jobId) {
    const MAX_ERRORS = 5;
    let errs = 0;
    let seenMsgCount = 0;
    const activeDag = dagInstance;
    const activeRobot = robotInstance;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${serverUrl}/jobs/${jobId}`);
          if (!res.ok) throw new Error(`Server ${res.status}`);
          const job = await res.json();
          errs = 0;

          // Update DAG
          activeDag.update(job);

          // Update robot state (use captured reference so resetPipeline doesn't affect it)
          if (activeRobot) {
            const stage = job.stage ?? 0;
            const workers = job.workers ?? {};
            const isParallel = job.mode === 'da' && stage === 1
              && (workers['build-blocks'] === 'running' || workers['extract'] === 'running');
            if (job.status === 'done') activeRobot.setState('done');
            else if (isParallel) activeRobot.setState('parallel');
            else activeRobot.setState('working');
          }

          // Append new log messages
          if (Array.isArray(job.messages) && job.messages.length > seenMsgCount) {
            job.messages.slice(seenMsgCount).forEach((text) => {
              logList.append(el('div', { class: 'log-entry' }, text));
            });
            seenMsgCount = job.messages.length;
            logList.scrollTop = logList.scrollHeight;
          }

          if (job.status === 'done') {
            clearInterval(interval);
            resolve({
              value: job.previewUrl || job.filePath,
              summary: job.summary,
              blockBranch: job.blockBranch,
              daUrl: job.daUrl,
              usage: job.usage,
              mode: job.mode ?? currentMode,
            });
          } else if (job.status === 'error') {
            clearInterval(interval);
            reject(new Error(job.error || 'Agent job failed.'));
          }
        } catch (e) {
          errs += 1;
          if (errs >= MAX_ERRORS) { clearInterval(interval); reject(e); }
        }
      }, POLL_INTERVAL);
    });
  }

  // ── Run handler ──
  runBtn.addEventListener('click', async () => {
    clearError();
    const figmaUrl = figmaInput.value.trim();
    const serverUrl = serverInput.value.trim();

    const repoPath = repoPathInput.value.trim();
    const figmaToken = figmaTokenInput.value.trim();

    // Resolve figma source — single URL or multi-breakpoint
    let figmaPayload;
    let primaryFigmaUrl;
    if (bpMultiMode) {
      const bps = breakpointList.getBreakpoints();
      if (!bps.length) { showError('Add at least one valid Figma URL (figma.com/design/…).'); return; }
      figmaPayload = { breakpoints: bps };
      primaryFigmaUrl = bps[0].figmaUrl;
    } else {
      if (!figmaUrl || !figmaUrl.includes('figma.com')) {
        showError('Please enter a valid Figma URL (figma.com/design/… or figma.com/file/…).');
        return;
      }
      figmaPayload = { figmaUrl };
      primaryFigmaUrl = figmaUrl;
    }

    if (!serverUrl) {
      showError('Please enter your agent server URL (e.g. http://localhost:3002).');
      configContent.style.display = '';
      return;
    }
    if (!repoPath) {
      showError('Please enter the Repo Path to your da-playground directory.');
      configContent.style.display = '';
      return;
    }

    currentServerUrl = serverUrl;
    localStorage.setItem(STORAGE_KEY, serverUrl);

    resetPipeline();
    showPipeline();
    robotInstance.setState('working');
    isViewingActiveJob = true;
    sidebarInstance.setPendingEntry({
      mode: currentMode,
      figmaUrl: primaryFigmaUrl,
      slug: 'running…',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    sidebarInstance.markPendingActive();

    let slug = '—';
    let resultMode = currentMode;
    let resultValue = null;

    try {
      const res = await fetch(`${serverUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...figmaPayload,
          daContext: { ...context, token, username },
          mode: currentMode,
          repoPath,
          ...(figmaToken && { figmaToken }),
        }),
      });
      if (!res.ok) throw new Error(`Failed to start job (HTTP ${res.status})`);
      const { jobId } = await res.json();

      const { value, summary, blockBranch, daUrl, usage, mode } = await pollJob(serverUrl, jobId);
      resultValue = value;
      resultMode = mode;

      if (isViewingActiveJob) {
        showResult(value, summary, blockBranch, usage, mode, daUrl);
        previewPanel.showPreview(value, mode, serverUrl);
      }
      isViewingActiveJob = false;
      savedLiveDag = null; savedLiveRobot = null; savedLogChildren = null;
      sidebarInstance.setPendingEntry(null);

      // Derive slug for sidebar
      if (value) {
        if (value.startsWith('http')) {
          try { slug = new URL(value).pathname.split('/').filter(Boolean).at(-1) || value; } catch { slug = value; }
        } else {
          slug = value.split('/').at(-1).replace(/\.html$/, '');
        }
      }

      sidebarInstance.addEntry({
        mode,
        figmaUrl: primaryFigmaUrl,
        value,
        slug,
        summary,
        blockBranch,
        daUrl,
        usage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: false,
        ts: Date.now(),
      });
    } catch (e) {
      if (isViewingActiveJob) showResult('error', e.message, null, null, currentMode);
      isViewingActiveJob = false;
      savedLiveDag = null; savedLiveRobot = null; savedLogChildren = null;
      sidebarInstance.setPendingEntry(null);
      sidebarInstance.addEntry({
        mode: currentMode,
        figmaUrl: primaryFigmaUrl,
        value: null,
        slug: '—',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
        ts: Date.now(),
      });
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  const { context, token } = await DA_SDK;
  let username = 'anonymous';
  try {
    const resp = await fetch('https://ims-na1.adobelogin.com/ims/profile/v1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await resp.json();
    username = profile?.email?.split('@')[0] || profile?.displayName || 'anonymous';
  } catch { /* IMS not available */ }
  buildUI(context, token, username);
}());
