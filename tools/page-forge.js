// Page Forge — generate / iterate / deploy
//
// New shape (replaces the Build/Prototype tabs reshape):
//   1. Pick a source (Figma / URL / Raw HTML) + optional intent → Generate
//   2. Iterate by refining intents; each refinement is a new version (v2, v3…)
//   3. Deploy: as a prototype to DA (no git) OR ship as Milo blocks (branch + DA draft)
//
// Persistent UI: navigating between sessions or opening settings never hides
// the active run state — the status strip stays visible underneath modals,
// the work-area shell is mounted once.
//
// Architecture plan: /Users/victor/.claude/plans/refactored-enchanting-cat.md

import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_HISTORY = 'page-forge:history';
const STORAGE_KEY_ACTIVE = 'page-forge:activeSession';
const STORAGE_KEY_SOURCE = 'page-forge:lastSource';

// Unified config — shared shape with the Adjustments overlay. One blob,
// one key, one source of truth. Both surfaces read/write the same fields
// so users configure once.
const FORGE_CONFIG_KEY = 'forge.config';

// Legacy per-field keys we migrate from on first load. Read-only — we
// leave them in place for one release so a stale tab doesn't lose data.
const LEGACY_KEYS = {
  serverUrl: 'page-forge:serverUrl',
  repoPath: 'page-forge:repoPath',
  snowflakeSkillPath: 'page-forge:snowflakeSkillPath',
  miloPath: 'page-forge:miloPath',
  figmaToken: 'page-forge:figmaToken',
  stardustSkillPath: 'page-forge:stardustSkillPath',
  impeccableSkillPath: 'page-forge:impeccableSkillPath',
  daUsername: 'page-forge:daUsername',
};

const POLL_INTERVAL_MS = 2000;
const MAX_HISTORY = 30;
const MAX_HTML_IN_HISTORY_BYTES = 500 * 1024;

// Backend base URL. The page-forge UI ships as a DA App — EDS-rendered
// da-playground content iframed into da.live — so inside the App frame
// location.hostname is the EDS *content* origin (e.g. *.aem.live / content.da.live),
// NOT 'da.live'. We therefore DEFAULT TO REMOTE and only fall back to the local
// page-forge server (:3002) when we detect a dev-laptop host. The deployed
// backend lives on the milo-logs Ethos service, mounted under /page-forge. A
// saved forge.config.serverUrl always overrides this (Settings ⚙).
// NOTE: this file is the single source of truth; da-playground/tools/page-forge.js
// is a byte-identical copy kept in sync by forge/scripts/sync-da-tool.mjs.
const FORGE_REMOTE_BACKEND = 'https://milo-core-stage.adobe.io/page-forge';
function resolveDefaultServerUrl() {
  const host = (typeof location !== 'undefined' && location.hostname) || '';
  // Only a real localhost dev host means "use the local server". Empty/opaque
  // origins ('' or 'null' from a sandboxed frame) must default to remote, not local.
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3002';
  return FORGE_REMOTE_BACKEND;
}
const DEFAULT_SERVER_URL = resolveDefaultServerUrl();

// True when the configured backend is a local dev server. Local-only affordances
// (e.g. "Reveal in Finder", which opens a path on the SERVER's machine) must be
// hidden when pointing at the deployed Ethos backend.
function isLocalServer() {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(state.config.serverUrl || '');
}

// The adobe/skills branch page-forge expects stardust + snowflake to be on.
// page-forge runs whatever local clone Settings points at, so the branch the
// clone sits on is the only thing that decides which skill version runs. The
// demo'd quality (feedback-improvements + Milo flavor, PR #166) lives here and
// is NOT in adobe/skills main yet. Keep in sync with the server copy in
// page-forge/server/skillVersion.js (which also warns at runtime on mismatch).
const EXPECTED_SKILLS_BRANCH = 'feat/snowflake-milo-substrate-v2';

const DEFAULT_BREAKPOINTS = [
  { label: 'Desktop', width: 1440, figmaUrl: '' },
  { label: 'Tablet', width: 768, figmaUrl: '' },
  { label: 'Mobile', width: 390, figmaUrl: '' },
];

const SOURCES = [
  {
    id: 'figma',
    label: 'Figma',
    inputKey: 'figmaUrl',
    inputKind: 'text',
    placeholder: 'https://www.figma.com/design/<file>/...?node-id=...',
    hint: 'Paste a Figma frame URL. The Forge extract agent renders it to standalone HTML (this is the slow path — 2–5 min).',
  },
  {
    id: 'eds-url',
    label: 'URL',
    inputKey: 'url',
    inputKind: 'text',
    placeholder: 'https://example.com/page  or  https://main--<site>--<org>.aem.live/<page>',
    hint: 'Paste any live page URL — EDS, adobe.com, competitor site, anything. Fetched headlessly. Choose Match for a 1:1 DA prototype, or Reimagine to redesign it via stardust.',
  },
  {
    id: 'raw-html',
    label: 'Raw HTML',
    inputKey: 'html',
    inputKind: 'textarea',
    placeholder: '<!doctype html><html>…',
    hint: 'Paste self-contained HTML. Choose Match to use it as-is (instant 1:1), or Reimagine to redesign it via stardust.',
  },
];

// ── Config helpers ───────────────────────────────────────────────────────────

// Canonical shape of the forge.config blob. Adjustments overlay reads/writes
// the same shape, so a path the user enters in one surface applies to both.
function emptyForgeConfig() {
  return {
    // Forge surfaces
    serverUrl: DEFAULT_SERVER_URL,            // page-forge server
    adjustmentsServerUrl: '',                  // adjustments server (optional override)
    // Consumer site (any adobecom Milo consumer — da-playground, cc-shared, etc.)
    repoPath: '',                              // local clone path
    consumerPreviewUrl: '',                    // e.g. http://localhost:3000
    // Milo (blocks destination)
    miloPath: '',
    // DA upload
    daOrg: '', daRepo: '', daToken: '', daUsername: '',
    // Skills
    snowflakeSkillPath: '', stardustSkillPath: '', impeccableSkillPath: '',
    // Secrets
    figmaToken: '',
    // Export defaults — overridable per-export from the Deploy confirm step.
    export: {
      shipTarget: 'auto',          // 'auto' | 'da' | 'local'
      sendBlocksToMilo: true,      // honored only when miloPath is set
      pushMiloBranch: false,       // matches FORGE_MILO_PUSH=1 env behavior
    },
  };
}

// Load the forge.config blob, falling back to legacy per-field keys on first
// load (one-time migration). Always returns a fully-populated object — any
// missing fields are filled from emptyForgeConfig() so downstream code can
// access state.config.<field> without `?.` everywhere.
function loadForgeConfig() {
  const base = emptyForgeConfig();
  let blob = null;
  try { blob = JSON.parse(localStorage.getItem(FORGE_CONFIG_KEY) || 'null'); } catch { /* corrupt — fall through */ }
  if (blob && typeof blob === 'object') {
    return { ...base, ...blob, export: { ...base.export, ...(blob.export || {}) } };
  }
  // Migration path: pull every legacy key we know about into the new shape.
  const migrated = { ...base };
  let foundAny = false;
  for (const [field, legacyKey] of Object.entries(LEGACY_KEYS)) {
    const v = localStorage.getItem(legacyKey);
    if (v != null && v !== '') { migrated[field] = v; foundAny = true; }
  }
  if (foundAny) {
    try { localStorage.setItem(FORGE_CONFIG_KEY, JSON.stringify(migrated)); } catch { /* quota */ }
  }
  return migrated;
}

function saveForgeConfig(cfg) {
  try { localStorage.setItem(FORGE_CONFIG_KEY, JSON.stringify(cfg)); } catch { /* quota / blocked */ }
}

// ── State ────────────────────────────────────────────────────────────────────

const state = {
  activeSessionId: null,
  /** @type {Map<string, object>} sessionId → server session object */
  sessions: new Map(),
  history: [],
  config: loadForgeConfig(),
  da: { context: null, token: null, username: null },
  ui: {
    selectedSource: localStorage.getItem(STORAGE_KEY_SOURCE) || 'figma',
    redesignMode: 'match',   // 'match' (1:1 snowflake) | 'reimagine' (stardust). url/raw-html only.
    refineMode: 'tweak',     // 'tweak' (fast single-shot) | 'redesign' (full stardust). refine card.
    viewedV: null,           // version pointer (null = follow currentV)
    settingsOpen: false,
    modal: null,             // null | 'deploy-prototype' | 'ship'
    sidebarCollapsed: false,
    advancedOpen: false,     // Milo ship lives behind this — designers see only the prototype button
  },
  pollHandle: null,
  pollFailureCount: 0,
  /** @type {Map<string, number>} sessionId → ts of the current run's start (for run-scoped elapsed) */
  runStart: new Map(),
  /** @type {Map<string, number>} sessionId → ts when the run settled (frozen wall-clock) */
  runEnd: new Map(),
};

// Record the start of a run so elapsed time is run-scoped, not session-scoped
// (a refine on a 20-min-old session should read "5s", not "1200s").
function markRunStart(sessionId) {
  if (sessionId) { state.runStart.set(sessionId, Date.now()); state.runEnd.delete(sessionId); }
}

// ── Tiny DOM builder ─────────────────────────────────────────────────────────

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k.startsWith('data-')) node.dataset[k.slice(5)] = v;
    else if (k === 'html') node.innerHTML = v;
    else node[k] = v;
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function prototypeDaPath(username, slug) {
  const who = kebab(username, 64);
  const page = kebab(slug || 'untitled');
  return `/drafts/${who}/snowflake/${page}`;
}

function kebab(s, max = 40) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '') || 'untitled';
}

function fmtAge(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtElapsed(secs) {
  if (secs == null) return '';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function fmtMs(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return fmtElapsed(Math.floor(ms / 1000));
}

function fmtTokens(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Breakpoint list (Figma) ───────────────────────────────────────────────────

function buildBreakpointList(initial = DEFAULT_BREAKPOINTS) {
  const rows = [];
  const list = el('div', { class: 'pf-bp-list' });

  function updateRemoveButtons() {
    rows.forEach((r) => { r.removeBtn.style.visibility = rows.length > 1 ? '' : 'hidden'; });
  }

  function addRow(data = { label: '', width: null, figmaUrl: '' }) {
    const labelInput = el('input', { type: 'text', class: 'pf-input', placeholder: 'Label', value: data.label });
    const widthInput = el('input', { type: 'number', class: 'pf-input', placeholder: 'px', value: data.width ?? '', min: '1', max: '9999' });
    const urlInput = el('input', { type: 'text', class: 'pf-input', placeholder: 'https://www.figma.com/design/…', value: data.figmaUrl });
    const removeBtn = el('button', { class: 'pf-bp-remove', type: 'button', title: 'Remove' }, '×');
    const row = el('div', { class: 'pf-bp-row' }, labelInput, widthInput, urlInput, removeBtn);
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
  const addBtn = el('button', { class: 'pf-bp-add', type: 'button' }, '+ Add breakpoint');
  addBtn.addEventListener('click', () => addRow());

  const wrap = el('div', { class: 'pf-bp-wrap' },
    el('div', { class: 'pf-bp-header' },
      el('span', { class: 'pf-label' }, 'Breakpoints'),
      el('span', { class: 'pf-bp-hint' }, 'Label · Width · Figma URL'),
    ),
    list,
    addBtn,
  );

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

function deleteHistoryEntry(sessionId) {
  const idx = state.history.findIndex((e) => e.sessionId === sessionId);
  if (idx === -1) return;
  state.history.splice(idx, 1);
  saveHistory();
  state.sessions.delete(sessionId);
  if (state.activeSessionId === sessionId) {
    clearActiveSession();
    renderWorkArea();
  } else {
    renderSidebar();
  }
}

function renderUsageStrip(usage, { runs } = {}) {
  if (!usage) return null;
  const total = (usage.inputTokens || 0) + (usage.outputTokens || 0);
  const cells = [
    el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, fmtTokens(usage.inputTokens)),
      el('span', { class: 'pf-token-label' }, 'In'),
    ),
    el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, fmtTokens(usage.outputTokens)),
      el('span', { class: 'pf-token-label' }, 'Out'),
    ),
    el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, fmtTokens(total)),
      el('span', { class: 'pf-token-label' }, 'Total'),
    ),
  ];
  if (usage.costUsd != null) {
    cells.push(el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, `$${usage.costUsd.toFixed(4)}`),
      el('span', { class: 'pf-token-label' }, 'Cost',
    )));
  }
  if (usage.numTurns != null) {
    cells.push(el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, String(usage.numTurns)),
      el('span', { class: 'pf-token-label' }, 'Turns',
    )));
  }
  if (usage.durationMs != null) {
    cells.push(el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, fmtMs(usage.durationMs)),
      el('span', { class: 'pf-token-label' }, 'Agent Time',
    )));
  }
  if (runs != null) {
    cells.push(el('div', { class: 'pf-token-cell' },
      el('span', { class: 'pf-token-value' }, String(runs)),
      el('span', { class: 'pf-token-label' }, 'Runs',
    )));
  }
  return el('div', { class: 'pf-token-strip' }, ...cells);
}

// Conversion report card — per-section breakdown of the matcher's decisions.
// Replaces the old chip-strip of blocks/snowflakes with a 5-column table
// pinned to shared/data/<sessionId>/match-report.json's sections[]. This is
// the forcing function the user asked for: a row each for hero / capabilities
// / firefly / ... so "0/8 matched" is visible at a glance.
//
// `result` shape (merged from shipped + matchReport):
//   { slug?, branchUrl?, branchName?, sha?, daPreviewUrl?,
//     sections?:    [{ index, block, decision, score, variantClasses?, action?, issues? }],
//     newBlockTasks?: [{ index, blockName }],     // generated forge-* blocks
//     judgeVerdicts?: [{ index, verdict, error? }] // judge audit (PR-6)
//   }
function renderConversionReport(result) {
  const card = el('div', { class: 'pf-report-card' });
  card.append(el('h3', { class: 'pf-report-title' }, 'Conversion report'));
  if (!result) {
    card.append(el('p', { class: 'pf-report-empty' }, 'No conversion data yet.'));
    return card;
  }

  // Header meta — slug / branch / commit / DA preview. Kept as a small
  // strip above the table so the table itself is the focal point.
  const meta = el('div', { class: 'pf-conversion-report' });
  if (result.slug) {
    meta.append(el('div', { class: 'pf-conv-field' },
      el('span', { class: 'pf-conv-label' }, 'Slug'),
      el('code', { class: 'pf-conv-value pf-conv-value--code' }, result.slug),
    ));
  }
  if (result.branchUrl) {
    meta.append(el('div', { class: 'pf-conv-field' },
      el('span', { class: 'pf-conv-label' }, 'Branch'),
      el('a', { class: 'pf-conv-value', href: result.branchUrl, target: '_blank', rel: 'noopener' }, `${result.branchName || 'branch'} ↗`),
    ));
  }
  if (result.sha) {
    meta.append(el('div', { class: 'pf-conv-field' },
      el('span', { class: 'pf-conv-label' }, 'Commit'),
      el('code', { class: 'pf-conv-value pf-conv-value--code' }, result.sha.slice(0, 7)),
    ));
  }
  if (result.daPreviewUrl) {
    meta.append(el('div', { class: 'pf-conv-field' },
      el('span', { class: 'pf-conv-label' }, 'DA preview'),
      el('a', { class: 'pf-conv-value', href: result.daPreviewUrl, target: '_blank', rel: 'noopener' }, result.daPreviewUrl),
    ));
  }
  if (meta.children.length) card.append(meta);

  // Demo headline counters — "X reused / Y new" + reuse %, plus a bespoke /
  // pending chip. Sourced from match-report.json's authoritative `counters`
  // object (Owner G P0#4). The two big numbers are the co-worker demo's anchor.
  const counters = result.counters;
  if (counters) card.append(renderMatchCounters(counters, result));

  // The 5-column per-section table — Section | Decision | Block + score |
  // Action | Issues. Each row is one entry in match-report.json's
  // sections[] (the shape exported by shared/match/negotiate.js). Rows expand
  // into a side-by-side panel + override/refactor controls.
  card.append(renderSectionTable(result));
  return card;
}

// "X reused / Y new" headline counters. Three number cards reusing the
// .pf-token-cell visual language, plus a "K bespoke / J pending" chip and the
// ?milolibs preview link (surfaced for both lanes). Reads only from the
// authoritative counters object so the demo numbers match the source of truth.
function renderMatchCounters(counters, result) {
  const reused = counters.reusableBlocksUsed ?? 0;
  const created = counters.newBlocksCreated ?? 0;
  const total = counters.totalSections ?? (reused + created);
  // Prefer the source's reuseRate; otherwise derive from reused/total.
  let pct = result.reuseRate ?? counters.reuseRate;
  if (pct == null && total) pct = reused / total;
  const pctLabel = pct != null ? `${Math.round(pct * 100)}%` : '—';

  const numCard = (value, label, mod) => el('div', { class: `pf-match-count ${mod || ''}` },
    el('span', { class: 'pf-match-count-value' }, String(value)),
    el('span', { class: 'pf-match-count-label' }, label),
  );

  const wrap = el('div', { class: 'pf-match-counters' },
    numCard(reused, 'Reused', 'pf-match-count--reused'),
    numCard(created, 'New', 'pf-match-count--new'),
    numCard(pctLabel, 'Reuse rate', 'pf-match-count--rate'),
  );

  // Secondary chip: bespoke (snowflake/ambiguous shipped via host block, no
  // forge-*) and pending (unpromoted ambiguous awaiting review).
  const bespoke = counters.bespokeHostSections ?? 0;
  const pending = counters.pendingReview ?? 0;
  if (bespoke || pending) {
    wrap.append(el('div', { class: 'pf-match-count pf-match-count--aux' },
      el('span', { class: 'pf-match-count-value pf-match-count-value--sm' }, `${bespoke} / ${pending}`),
      el('span', { class: 'pf-match-count-label' }, 'Bespoke / Pending'),
    ));
  }

  // ?milolibs preview link — both lanes ship to a Milo branch the page renders
  // against via ?milolibs=<branch>. Surface it here so the demo can click through.
  if (result.milolibsUrl) {
    wrap.append(el('a', {
      class: 'pf-match-milolibs',
      href: result.milolibsUrl, target: '_blank', rel: 'noopener',
      title: 'Open the live preview rendered against the shipped Milo branch',
    }, 'Preview ?milolibs ↗'));
  }
  return wrap;
}

// Decision → pill colour. Per master plan §4.9: green for tight, yellow for
// loose, pink for the snowflake/ambiguous/below-threshold cluster. Anything
// else (errors, unknown) renders neutral so we never lie about a match.
function pillForDecision(d) {
  if (d === 'tight-variant' || d === 'tight') return { cls: 'pf-pill pf-pill--tight', label: 'Tight' };
  if (d === 'loose-variant' || d === 'loose') return { cls: 'pf-pill pf-pill--loose', label: 'Loose' };
  // Distinguish ambiguous from snowflake — same pink cluster, different labels
  // so the demo can tell "the matcher wasn't sure" (ambiguous, a review signal)
  // from "no match, shipped bespoke" (snowflake).
  if (d === 'ambiguous') return { cls: 'pf-pill pf-pill--ambiguous', label: 'Ambiguous' };
  if (d === 'snowflake' || d === 'below-threshold') {
    return { cls: 'pf-pill pf-pill--snowflake', label: d === 'snowflake' ? 'Snowflake' : 'Below threshold' };
  }
  return { cls: 'pf-pill', label: d || '—' };
}

// Decide the "Action" cell text. Generated forge-* blocks are noted from
// newBlockTasks[] when present; tight/loose stay "Matched to <block>";
// raw snowflake stays "Host (snowflake)" — the libs/c2/blocks/snowflake/
// host block renders bespoke content at runtime.
function deriveAction(section, generatedBlockNames) {
  const d = section.decision;
  if (d === 'tight-variant' || d === 'tight') return `Matched to ${section.block || '—'}`;
  if (d === 'loose-variant' || d === 'loose') return `Matched to ${section.block || '—'} (+ CSS delta)`;
  if (generatedBlockNames && generatedBlockNames[section.index]) {
    return `Generated new (${generatedBlockNames[section.index]})`;
  }
  if (d === 'snowflake' || d === 'below-threshold' || d === 'ambiguous') return 'Host (snowflake)';
  return '—';
}

function renderSectionTable(result) {
  const sections = Array.isArray(result.sections) ? result.sections : [];
  if (!sections.length) {
    return el('p', { class: 'pf-section-empty' },
      'No per-section data yet. Match report appears after the matcher runs.');
  }

  // Map index → generated block name so the Action cell can show
  // "Generated new (forge-pricing)" for the rows that produced one.
  const generatedBlockNames = {};
  if (Array.isArray(result.newBlockTasks)) {
    for (const t of result.newBlockTasks) {
      if (t && t.index != null && t.blockName) generatedBlockNames[t.index] = t.blockName;
    }
  }

  // Map index → judge note ("judge → tight-match" or "judge → snowflake",
  // or the error message if the judge fell back).
  const judgeNotes = {};
  if (Array.isArray(result.judgeVerdicts)) {
    for (const v of result.judgeVerdicts) {
      if (!v || v.index == null) continue;
      if (v.error) judgeNotes[v.index] = `judge fell back (${v.error.slice(0, 60)})`;
      else if (v.verdict) judgeNotes[v.index] = `judge → ${v.verdict}`;
    }
  }

  const table = el('table', { class: 'pf-section-table' });
  const head = el('tr', null,
    el('th', { class: 'pf-section-th-expand' }, ''),
    el('th', null, 'Section'),
    el('th', null, 'Decision'),
    el('th', null, 'Block + score'),
    el('th', null, 'Action'),
    el('th', null, 'Issues'),
  );
  table.append(el('thead', null, head));

  const tbody = el('tbody', null);
  for (const sec of sections) {
    const pill = pillForDecision(sec.decision);
    const score = typeof sec.score === 'number' ? sec.score.toFixed(2) : '—';
    const variants = Array.isArray(sec.variantClasses) && sec.variantClasses.length
      ? ` (${sec.variantClasses.join(',')})` : '';
    const blockCell = sec.block
      ? el('span', null,
          el('span', { class: 'pf-section-block' }, sec.block),
          ' ',
          el('span', { class: 'pf-section-score' }, score),
          variants ? el('span', { class: 'pf-section-variants' }, variants) : null,
        )
      : el('span', { class: 'pf-section-score' }, score);

    // Issues — surface judge notes, error messages, and per-section lint
    // warnings. Caller is free to pre-populate sec.issues with whatever the
    // post-compose lint emitted; we also fold in the judge audit trail.
    const issuesParts = [];
    if (sec.error) issuesParts.push(sec.error);
    if (judgeNotes[sec.index]) issuesParts.push(judgeNotes[sec.index]);
    if (Array.isArray(sec.issues)) issuesParts.push(...sec.issues);
    else if (typeof sec.issues === 'string' && sec.issues) issuesParts.push(sec.issues);

    // Expand toggle — opens the side-by-side panel + override/refactor controls
    // in a full-width row beneath. The caret glyph swaps ▸/▾ on toggle.
    const caret = el('span', { class: 'pf-section-caret' }, '▸');
    const detailRow = el('tr', { class: 'pf-section-detail-row', hidden: true });
    // colSpan is the DOM property name (the el() builder assigns node[k]=v, and
    // node.colspan would be ignored — only node.colSpan maps to the attribute).
    const detailCell = el('td', { class: 'pf-section-detail-cell', colSpan: 6 });
    detailRow.append(detailCell);
    let built = false;
    const toggle = () => {
      const opening = detailRow.hidden;
      detailRow.hidden = !opening;
      caret.textContent = opening ? '▾' : '▸';
      // Lazy-build the panel on first open so we don't fetch HTML/catalog for
      // every collapsed row up front.
      if (opening && !built) { built = true; buildSectionDetail(detailCell, sec, result); }
    };

    const row = el('tr', { class: 'pf-section-row' },
      el('td', { class: 'pf-section-expand' },
        el('button', { class: 'pf-section-expand-btn', title: 'Expand — side-by-side + override', onclick: toggle }, caret)),
      el('td', { class: 'pf-section-num' }, String(sec.index ?? '—')),
      el('td', null, el('span', { class: pill.cls }, pill.label)),
      el('td', null, blockCell),
      el('td', { class: 'pf-section-action' }, sec.action || deriveAction(sec, generatedBlockNames)),
      el('td', { class: 'pf-section-issues' }, issuesParts.join('; ')),
    );
    tbody.append(row);
    tbody.append(detailRow);
  }
  table.append(tbody);
  return table;
}

// Build the expanded per-section panel: a 2-up side-by-side (source section on
// the left, matched Milo block / generated forge-* on the right), an override
// <select>, and a refactor prompt. Lazily invoked on first row expand. All
// network reads degrade gracefully when Owner G's endpoints aren't deployed yet.
function buildSectionDetail(host, sec, result) {
  const sessionId = result.sessionId;
  clear(host);

  // ── Side-by-side panel ──────────────────────────────────────────────────
  const panel = el('div', { class: 'pf-sbs' });
  // LEFT: the source section, rendered from its outerHTML in a sandboxed iframe.
  const left = el('div', { class: 'pf-sbs-pane' },
    el('div', { class: 'pf-sbs-pane-head' }, 'Source section'));
  const leftBody = el('div', { class: 'pf-sbs-pane-body' },
    el('div', { class: 'pf-sbs-loading' }, 'Loading source HTML…'));
  left.append(leftBody);
  // RIGHT: the matched Milo block reference, or the generated forge-* name.
  const right = el('div', { class: 'pf-sbs-pane' },
    el('div', { class: 'pf-sbs-pane-head' }, 'Matched / generated'));
  right.append(buildSbsRight(sec));
  panel.append(left, right);
  host.append(panel);

  // Fetch the section HTML for the LEFT pane (sessionId may be absent on a
  // history-only synthetic session — then we just show a hint).
  if (sessionId) {
    api.sectionHtml(sessionId, sec.index).then((r) => {
      clear(leftBody);
      const html = r?.html || r?.outerHTML || '';
      if (!html) { leftBody.append(el('div', { class: 'pf-sbs-loading' }, 'No HTML for this section.')); return; }
      const iframe = el('iframe', { class: 'pf-sbs-frame', sandbox: 'allow-same-origin' });
      leftBody.append(iframe);
      iframe.srcdoc = injectPreviewBaseHref(html);
    }).catch(() => {
      clear(leftBody);
      leftBody.append(el('div', { class: 'pf-sbs-loading' }, 'Section HTML endpoint not available yet.'));
    });
  } else {
    clear(leftBody);
    leftBody.append(el('div', { class: 'pf-sbs-loading' }, 'Reopen this session live to view source HTML.'));
  }

  // ── Override + refactor controls ────────────────────────────────────────
  if (sessionId) {
    host.append(buildOverrideControls(sec, result));
    host.append(buildRefactorControls(sec, result));
  }
}

// RIGHT pane content: matched Milo block (name + block-source links when the
// report carries them) or the generated forge-* block name + lint status.
function buildSbsRight(sec) {
  const wrap = el('div', { class: 'pf-sbs-pane-body pf-sbs-ref' });
  const isMatched = ['tight-variant', 'tight', 'loose-variant', 'loose'].includes(sec.decision);
  if (isMatched && sec.block) {
    wrap.append(el('div', { class: 'pf-sbs-blockname' }, sec.block));
    const vc = Array.isArray(sec.variantClasses) && sec.variantClasses.length
      ? sec.variantClasses.join(' ') : null;
    if (vc) wrap.append(el('div', { class: 'pf-sbs-variants' }, `variants: ${vc}`));
    // Block-source click-through when the matcher threaded citations into the
    // report (Owner G/D P1#3): blockSource:{js,css}.
    const src = sec.blockSource || {};
    const links = el('div', { class: 'pf-sbs-srclinks' });
    if (src.js) links.append(el('code', { class: 'pf-sbs-srclink' }, shortenPath(src.js)));
    if (src.css) links.append(el('code', { class: 'pf-sbs-srclink' }, shortenPath(src.css)));
    if (links.children.length) wrap.append(links);
  } else if (sec.generatedBlockName || sec.blockName) {
    const name = sec.generatedBlockName || sec.blockName;
    wrap.append(el('div', { class: 'pf-sbs-blockname pf-sbs-blockname--new' }, name));
    const lint = sec.lintStatus || sec.lint;
    if (lint) {
      const ok = lint === 'ok' || lint === 'pass' || lint?.ok;
      wrap.append(el('span', { class: `pf-sbs-lint ${ok ? 'pf-sbs-lint--ok' : 'pf-sbs-lint--fail'}` },
        ok ? '✓ lint ok' : '✗ lint failed'));
    }
  } else {
    wrap.append(el('div', { class: 'pf-sbs-loading' },
      sec.decision === 'snowflake' || sec.decision === 'below-threshold'
        ? 'Shipped bespoke via the snowflake host block.'
        : 'No matched block.'));
  }
  return wrap;
}

// Override <select>: choose a target block (make-variant-of) or a sentinel
// (keep-snowflake / promote-to-new-block). On change, POST the override and
// re-render the counters + table from the returned report (matcher replays the
// override agent-free, so this is fast). Populated from /catalog/blocks.
function buildOverrideControls(sec, result) {
  const sessionId = result.sessionId;
  const row = el('div', { class: 'pf-override-row' });
  const label = el('label', { class: 'pf-override-label' }, 'Override decision');
  const select = el('select', { class: 'pf-override-select' });
  select.append(el('option', { value: '' }, '— keep matcher decision —'));
  // Sentinels first, then the catalog blocks (filled async).
  select.append(el('option', { value: '__keep-snowflake' }, 'Keep as snowflake'));
  select.append(el('option', { value: '__promote-to-new-block' }, 'Promote to new block'));
  const blockGroup = el('optgroup', { label: 'Make a variant of…' });
  select.append(blockGroup);

  const status = el('span', { class: 'pf-override-status' });

  getCatalogBlocks().then((blocks) => {
    for (const b of blocks) {
      const name = typeof b === 'string' ? b : b.name;
      if (!name) continue;
      blockGroup.append(el('option', { value: `block:${name}` }, name));
    }
    if (!blocks.length) blockGroup.append(el('option', { value: '', disabled: true }, '(catalog unavailable)'));
  });

  select.addEventListener('change', async () => {
    const v = select.value;
    if (!v) return;
    let decision, block;
    if (v === '__keep-snowflake') decision = 'keep-snowflake';
    else if (v === '__promote-to-new-block') decision = 'promote-to-new-block';
    else if (v.startsWith('block:')) { decision = 'make-variant-of'; block = v.slice(6); }
    else return;
    select.disabled = true; status.textContent = 'Applying…';
    try {
      const r = await api.overrideSection(sessionId, { index: sec.index, decision, block });
      const report = r?.report || r;
      // Cache the recomputed report onto the live session + re-render so the
      // counters move immediately.
      const s = state.sessions.get(sessionId);
      if (s && report) { s.matchReport = report; s._matchReportMissing = false; }
      status.textContent = '✓ applied';
      if (state.activeSessionId === sessionId) renderActiveSession();
    } catch (err) {
      status.textContent = `✗ ${err.message?.slice(0, 80) || 'failed'}`;
      select.disabled = false;
    }
  });

  row.append(label, select, status);
  return row;
}

// Refactor prompt: a textarea + "Re-ship section" button → scoped single-section
// re-ship seeded by the prompt. Reuses the busy/markRunStart/startPolling flow
// so the status strip + activity log surface the run like any other.
function buildRefactorControls(sec, result) {
  const sessionId = result.sessionId;
  const wrap = el('div', { class: 'pf-refactor-row' });
  const ta = el('textarea', {
    class: 'pf-input pf-input--ta pf-refactor-ta',
    rows: 2,
    placeholder: `Re-ship section ${sec.index} — e.g. "use the dark variant and tighten the heading scale"`,
  });
  const errEl = el('div', { class: 'pf-form-error', hidden: true });
  const btn = el('button', {
    class: 'pf-secondary pf-refactor-btn',
    onclick: async () => {
      const prompt = ta.value.trim();
      if (!prompt) return;
      errEl.hidden = true;
      btn.disabled = true; btn.textContent = 'Re-shipping…';
      try {
        await api.refactorSection(sessionId, { index: sec.index, prompt });
        markRunStart(sessionId);
        startPolling();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
        btn.disabled = false; btn.textContent = 'Re-ship section';
      }
    },
  }, 'Re-ship section');
  wrap.append(el('div', { class: 'pf-refactor-head' }, 'Refactor this section'), ta, btn, errEl);
  return wrap;
}

// Format USD cost to 2 dp; null/0 → "—".
function fmtCost(usd) {
  if (usd == null || usd === 0) return '—';
  return `$${usd.toFixed(2)}`;
}

// Replace $HOME with ~ for readability — paths are long in macOS Documents.
// Client-side guess: /Users/<name>/ on macOS, /home/<name>/ on Linux.
function shortenPath(p) {
  if (!p) return p;
  const m = p.match(/^(\/Users\/[^/]+|\/home\/[^/]+)(\/.*)?$/);
  if (m) return `~${m[2] || ''}`;
  return p;
}

// Build a path-row with copy-to-clipboard + reveal-in-Finder icon buttons.
function pathRow(label, path) {
  if (!path) return null;
  const valueCode = el('code', { class: 'pf-path-value' }, shortenPath(path));
  const copyBtn = el('button', {
    class: 'pf-path-iconbtn',
    title: 'Copy path to clipboard',
    onclick: async () => {
      try {
        await navigator.clipboard.writeText(path);
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '📋'; }, 1200);
      } catch { copyBtn.textContent = '✗'; }
    },
  }, '📋');
  // "Reveal in Finder" opens the path on the SERVER's machine — only meaningful
  // against a local dev server. Hidden when pointing at the deployed backend.
  const rowChildren = [
    el('span', { class: 'pf-path-label' }, label),
    valueCode,
    copyBtn,
  ];
  if (isLocalServer()) {
    const revealBtn = el('button', {
      class: 'pf-path-iconbtn',
      title: 'Reveal in Finder',
      onclick: async () => {
        try {
          await apiFetch('/reveal-path', {
            method: 'POST',
            body: JSON.stringify({ path }),
          });
        } catch (e) { toast(`Reveal failed: ${e.message}`); }
      },
    }, '📁');
    rowChildren.push(revealBtn);
  }
  return el('div', { class: 'pf-path-row' }, ...rowChildren);
}

// Completion report card for a finished Deploy Prototype attempt.
// Shows: status, duration, cost, turns, token totals; clickable Preview/DA/Branch URLs;
// collapsible Local artifacts with copy + reveal icon buttons per path.
function renderDeployReport(s) {
  const shipped = s.shipped || {};
  const status = shipped.deployStatus || 'success';
  const statusIcon = status === 'success' ? '✓' : status === 'partial' ? '◐' : '✗';
  const statusClass = `pf-deploy-status--${status}`;
  const duration = shipped.deployFinishedAt && shipped.deployStartedAt
    ? shipped.deployFinishedAt - shipped.deployStartedAt
    : null;
  const usage = shipped.deployUsage || s.totalUsage || {};

  // Non-success deploys (e.g. a pre-agent gate like the snowflake branch gate)
  // may never have run the agent, so any Duration/Cost/Turns/Tokens are
  // misleadingly inherited from the prior extraction — pure noise that buries
  // the one thing that matters. On this path we lead with the actionable error
  // and suppress the success scaffolding.
  const failed = status !== 'success' || !!shipped.deployError;
  // Suppress the stat row only when the agent never really ran (a hard
  // pre-agent failure). A 'partial' deploy DID run, so its stats are real —
  // keep them.
  const hideStats = failed && status !== 'partial';

  const card = el('div', { class: 'pf-deploy-report' });

  // Header strip: status badge + title.
  card.append(el('div', { class: 'pf-deploy-report-head' },
    el('span', { class: `pf-deploy-status ${statusClass}` }, `${statusIcon} ${status}`),
    el('span', { class: 'pf-deploy-report-title' }, 'Deploy report'),
  ));

  // Failure path: lead with the error as the headline, right under the header.
  if (failed && shipped.deployError) {
    card.append(el('div', { class: 'pf-deploy-error pf-deploy-error--headline' }, shipped.deployError));
  }

  // Stat row: duration · cost · turns · tokens. Suppressed on a hard failure —
  // the agent didn't run, so these numbers are stale noise.
  const stats = [];
  if (duration != null) stats.push(['Duration', fmtMs(duration)]);
  if (usage.costUsd != null) stats.push(['Cost', fmtCost(usage.costUsd)]);
  if (usage.numTurns) stats.push(['Turns', String(usage.numTurns)]);
  if (usage.inputTokens || usage.outputTokens) {
    stats.push(['Tokens', `${fmtTokens(usage.inputTokens)} in / ${fmtTokens(usage.outputTokens)} out`]);
  }
  if (!hideStats && stats.length) {
    const statsRow = el('div', { class: 'pf-deploy-stats' });
    stats.forEach(([k, v]) => statsRow.append(el('div', { class: 'pf-deploy-stat' },
      el('span', { class: 'pf-deploy-stat-label' }, k),
      el('span', { class: 'pf-deploy-stat-value' }, v),
    )));
    card.append(statsRow);
  }

  // URL rows — preview, DA edit, branch.
  const urls = el('div', { class: 'pf-deploy-urls' });
  function urlRow(label, href, displayText) {
    if (!href) return;
    urls.append(el('div', { class: 'pf-deploy-url-row' },
      el('span', { class: 'pf-deploy-url-label' }, label),
      el('a', { class: 'pf-deploy-url-value', href, target: '_blank', rel: 'noopener' }, displayText || href),
    ));
  }
  urlRow('Preview', shipped.prototypeUrl || shipped.localPreviewUrl);
  urlRow('DA edit', shipped.daUrl);
  if (shipped.prototypeBranchUrl) {
    const sha = shipped.prototypeSha ? ` (${shipped.prototypeSha.slice(0, 7)})` : '';
    urlRow('Branch', shipped.prototypeBranchUrl, `${shipped.prototypeBranchName}${sha}`);
  }
  // Extraction handoff (decision #2): deep-link into forge-adjustments so a
  // human can audit + graduate each section. Only when the adjustments server
  // URL is configured (it's optional) and we have a session to pick up.
  const adjUrl = (state.config.adjustmentsServerUrl || '').trim().replace(/\/+$/, '');
  if (adjUrl && s.sessionId) {
    urlRow('Refine in forge-adjustments', `${adjUrl}/?pickup=${encodeURIComponent(s.sessionId)}`, 'Open audit + graduation ↗');
  }
  if (urls.children.length) card.append(urls);

  // PR-B: stranded-blocks panel. When forge-block-lint rejected one or
  // more generated blocks, the Milo copy was skipped but the consumer
  // worktree is preserved on disk and on the branch. Surface the recovery
  // command so the user can inspect and fix without re-running the entire
  // extract→match→ship session.
  if (shipped.lintBlockedCount) {
    const repoPath = shipped.consumerRepoPath || '';
    const branch = shipped.prototypeBranchName || '';
    const recoverCmd = repoPath && branch
      ? `git -C ${repoPath} worktree add ../forge-recover-${branch.slice(-12)} ${branch}`
      : '(branch/repo not captured — check activity log)';
    const failures = shipped.lintFailures || [];
    const summary = failures.length
      ? failures.map((f) => `${f.name} (${(f.blocking || []).map((b) => b.rule).join(', ')})`).join(', ')
      : '';
    const warn = el('div', { class: 'pf-deploy-lint-warning' },
      el('div', { class: 'pf-deploy-lint-title' },
        `⚠ ${shipped.lintBlockedCount} block(s) stranded by forge-block-lint`),
      el('div', { class: 'pf-deploy-lint-body' },
        `The agent's code didn't pass Milo-grade rules; the Milo copy was skipped. Files are preserved on branch ${branch || '(unknown)'}. Recover with:`),
      el('code', { class: 'pf-deploy-lint-recover' }, recoverCmd),
    );
    if (summary) {
      warn.append(el('div', { class: 'pf-deploy-lint-detail' }, `Failures: ${summary}`));
    }
    card.append(warn);
  }

  // Local artifacts — collapsible list of paths with copy + reveal buttons.
  const paths = [
    ['Snowflake HTML', shipped.snowflakePagePath],
    ['Assets dir', shipped.snowflakeAssetsDir],
    ['Consumer worktree', shipped.consumerWorktree],
    ['Milo worktree', shipped.miloWorktree],
    ['Local ship path', shipped.localPath],
  ].filter(([, p]) => !!p);
  if (paths.length || shipped.miloBlocks?.length) {
    const details = el('details', { class: 'pf-deploy-artifacts' });
    details.append(el('summary', { class: 'pf-deploy-artifacts-summary' },
      `▸ Local artifacts (${paths.length + (shipped.miloBlocks?.length ? 1 : 0)})`));
    paths.forEach(([label, p]) => details.append(pathRow(label, p)));
    if (shipped.miloBlocks?.length) {
      const blockTags = el('div', { class: 'pf-deploy-block-tags' });
      shipped.miloBlocks.forEach((n) => blockTags.append(el('span', { class: 'pf-block-tag' }, n)));
      details.append(el('div', { class: 'pf-path-row' },
        el('span', { class: 'pf-path-label' }, `Milo blocks (${shipped.miloBlocks.length})`),
        blockTags,
      ));
    }
    card.append(details);
  }

  return card;
}

// One-shot fetch of the disk match-report when the poll payload doesn't carry
// it (the common case — saveMatchReport writes the file but the session object
// often lacks it on reload/restart). Caches onto the session so we don't refetch
// every render, then triggers one re-render to surface the table+counters.
// Guarded by a per-session flag so a 404 (endpoint not deployed yet, or no
// report) doesn't loop. Owner G owns GET /sessions/:id/match-report.
async function ensureMatchReport(s) {
  if (!s || s._matchReportFetching || s.matchReport || s.shipped?.matchReport) return;
  if (s._matchReportMissing) return; // already tried, nothing there
  s._matchReportFetching = true;
  try {
    const report = await api.matchReport(s.sessionId);
    if (report && (report.sections || report.counters)) {
      s.matchReport = report;
      if (state.activeSessionId === s.sessionId) renderActiveSession();
    } else {
      s._matchReportMissing = true;
    }
  } catch {
    s._matchReportMissing = true; // endpoint not up / no file — stop trying
  } finally {
    s._matchReportFetching = false;
  }
}

function renderSessionReport(s, viewedVersion) {
  const card = el('div', { class: 'pf-report-section' });
  const shipped = s.shipped || {};
  // Match report comes from shared/data/<sessionId>/match-report.json once
  // PR-3 wires negotiate into the orchestrator. We accept it on either
  // s.matchReport (post-match, pre-ship) or shipped.matchReport (rolled into
  // the ship report) so this card renders the moment data is available.
  const matchReport = s.matchReport || shipped.matchReport || null;
  // P0#3 client wiring: if the run is settled and the report isn't on the
  // session object yet, fetch it from disk once (it always reflects the
  // post-ship enriched file). The fetch caches + re-renders when it lands.
  if (!matchReport && s.status === 'done') ensureMatchReport(s);
  const hasShipReport = shipped.slug || shipped.blocks?.length || shipped.snowflakes?.length
    || (matchReport?.sections?.length);
  if (hasShipReport) {
    card.append(renderConversionReport({
      slug: shipped.slug,
      branchUrl: shipped.branchUrl,
      branchName: shipped.branchName,
      sha: shipped.sha,
      daPreviewUrl: shipped.daPreviewUrl,
      // ?milolibs preview URL for BOTH lanes — surfaced in the counters header.
      milolibsUrl: shipped.remotePreviewUrl || shipped.milolibsUrl || matchReport?.preview?.remotePreviewUrl,
      counters: matchReport?.counters,
      reuseRate: matchReport?.stats?.reuseRate ?? matchReport?.counters?.reuseRate,
      sections: matchReport?.sections,
      newBlockTasks: matchReport?.newBlockTasks,
      judgeVerdicts: matchReport?.judgeVerdicts,
      sessionId: s.sessionId,
    }));
  }
  const summary = viewedVersion?.summary || s.lastSummary;
  const usage = viewedVersion?.usage;
  if (summary || usage) {
    const genCard = el('div', { class: 'pf-report-card' });
    genCard.append(el('h3', { class: 'pf-report-title' }, hasShipReport ? 'Generation summary' : 'Session report'));
    if (summary) {
      genCard.append(el('pre', { class: 'pf-report-summary' }, summary.slice(0, 8000)));
    }
    const usageEl = renderUsageStrip(usage);
    if (usageEl) {
      genCard.append(el('div', { class: 'pf-usage-label' }, `This version (v${viewedVersion?.v ?? '—'})`));
      genCard.append(usageEl);
    }
    // Session total — sums every run (reimagine, tweaks, refines, deploys). Only
    // shown once more than one run has happened, so it doesn't just duplicate the
    // single-version strip on a fresh generation.
    if (s.totalUsage && s.totalUsage.runs > 1) {
      genCard.append(el('div', { class: 'pf-usage-label' }, `Session total · ${s.totalUsage.runs} runs`));
      genCard.append(renderUsageStrip(s.totalUsage, { runs: s.totalUsage.runs }));
    }
    card.append(genCard);
  } else if (!hasShipReport && s.status === 'done') {
    card.append(el('div', { class: 'pf-report-card' },
      el('h3', { class: 'pf-report-title' }, 'Session report'),
      el('p', { class: 'pf-report-empty' }, s.source === 'figma'
        ? 'Ship as Milo blocks to see the conversion report.'
        : 'Generation complete. Ship as Milo blocks to see block mapping, or refine to iterate.'),
    ));
  }
  return card.children.length ? card : null;
}

// ── History (sidebar) persistence ────────────────────────────────────────────

function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY) || '[]');
    // Filter pre-reshape entries that don't have the new `versions` field.
    return raw.filter((e) => Array.isArray(e?.versions) && e.sessionId);
  } catch { return []; }
}

function saveHistory() {
  try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(state.history.slice(0, MAX_HISTORY))); } catch { /* quota etc. */ }
}

function upsertHistoryEntry(session) {
  const idx = state.history.findIndex((e) => e.sessionId === session.sessionId);
  // Keep at most ~500KB total of HTML inline; drop oldest version's html if over.
  const versionsMeta = session.versions.map((v) => ({
    v: v.v, intent: v.intent, basedOnV: v.basedOnV, producedAt: v.producedAt, html: v.html,
    summary: v.summary, usage: v.usage,
  }));
  let total = versionsMeta.reduce((acc, v) => acc + (v.html?.length || 0), 0);
  while (total > MAX_HTML_IN_HISTORY_BYTES && versionsMeta.length > 1) {
    // Drop earliest version's html (keep metadata, drop body)
    const first = versionsMeta.find((v) => v.html);
    if (!first) break;
    total -= first.html.length;
    first.html = null;
  }
  // Persist a truncated tail of the activity log so a history reload (or a
  // post-restart reopen) still shows WHY a run did what it did, not a blank
  // log. Cap at the last ~200 lines to stay well inside the localStorage quota.
  const MAX_LOG_TAIL = 200;
  const msgs = Array.isArray(session.messages) ? session.messages : [];
  const messagesTail = msgs.slice(-MAX_LOG_TAIL).map((m) => ({ text: m.text || String(m) }));
  // Keep a small match-report summary (counters + sections) on the history
  // entry so the conversion report survives a reload without re-fetching.
  const mr = session.matchReport || session.shipped?.matchReport || null;
  const matchReportSummary = mr
    ? { counters: mr.counters, stats: mr.stats, sections: mr.sections, newBlockTasks: mr.newBlockTasks }
    : null;
  const entry = {
    sessionId: session.sessionId,
    source: session.source,
    label: deriveLabel(session),
    versionCount: session.versions.length,
    currentV: session.currentV,
    versions: versionsMeta,
    shipped: session.shipped || {},
    status: session.status,
    messagesTail,
    matchReportSummary,
    ts: Date.now(),
  };
  if (idx >= 0) state.history[idx] = entry;
  else state.history.unshift(entry);
  state.history = state.history.slice(0, MAX_HISTORY);
  saveHistory();
}

// Strip stardust variant-label decoration so a blank-intent Reimagine doesn't
// surface in the sidebar as "Variant A". The server names each variant's intent
// either "<intent> · Variant B", a bare "Variant B"/"Variant C — cinematic", or
// "Redesign" (single plain variant). None of those are a useful session label.
function cleanVariantIntent(intent) {
  let s = (intent || '').replace(/\s*·\s*Variant\s+[ABC](?:\s*—\s*cinematic)?$/i, '').trim();
  if (/^Variant\s+[ABC](?:\s*—\s*cinematic)?$/i.test(s) || /^Redesign$/i.test(s)) s = '';
  return s;
}

function deriveLabel(session) {
  const intent = cleanVariantIntent(session.versions[0]?.intent);
  if (intent) return intent.slice(0, 60);
  const src = session.sourceInput || {};
  if (src.url) return src.url.replace(/^https?:\/\//, '').slice(0, 60);
  if (src.figmaUrl) return src.figmaUrl.replace(/^https?:\/\/(www\.)?figma\.com\//, '').slice(0, 60);
  if (src.html) return '(raw HTML)';
  return '(untitled)';
}

// ── API client ───────────────────────────────────────────────────────────────

// DA mints DA_SDK access tokens under this IMS client_id. The deployed backend's
// requireAuth validates the bearer token against this client_id and the user's
// @adobe.com profile (see da-live/scripts/scripts.js imsClientId). Local dev
// (LOCAL=true) bypasses auth and ignores both the header and the param.
const DA_IMS_CLIENT_ID = 'darkalley';

async function apiFetch(path, init = {}) {
  // Send the DA_SDK IMS token + its client_id so the deployed backend can
  // authenticate the already-signed-in DA user — no separate sign-in. A boot
  // snapshot is used; a stale token surfaces as a 401 (auto-refresh: Phase 2).
  const token = state.da?.token;
  let qualifiedPath = path;
  const authHeaders = {};
  if (token) {
    const sep = path.includes('?') ? '&' : '?';
    qualifiedPath = `${path}${sep}clientId=${encodeURIComponent(DA_IMS_CLIENT_ID)}`;
    authHeaders.authorization = `Bearer ${token}`;
  }
  const url = `${state.config.serverUrl}${qualifiedPath}`;
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', ...authHeaders, ...(init.headers || {}) },
    });
  } catch (netErr) {
    const err = new Error(`Couldn't reach the page-forge server at ${state.config.serverUrl} — is it running? (${netErr.message})`);
    err.status = 0;
    throw err;
  }
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { _raw: text }; }
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

// Server-facing slice of forge.config. The server reads the canonical fields
// it knows about (repoPath, miloPath, skill paths, etc.) and ignores the rest.
// New fields added here (consumerPreviewUrl, da org/repo/token, export defaults)
// are accepted by the server in phases 3 + 5 server-side changes.
function buildServerConfig() {
  return {
    repoPath: state.config.repoPath,
    consumerPreviewUrl: state.config.consumerPreviewUrl,
    miloPath: state.config.miloPath,
    figmaToken: state.config.figmaToken,
    snowflakeSkillPath: state.config.snowflakeSkillPath,
    stardustSkillPath: state.config.stardustSkillPath,
    impeccableSkillPath: state.config.impeccableSkillPath,
    daOrg: state.config.daOrg,
    daRepo: state.config.daRepo,
    daToken: state.config.daToken,
    daUsername: state.config.daUsername,
    export: state.config.export,
  };
}

const api = {
  async createSession({ source, sourceInput }) {
    // Refresh the DA_SDK token before kicking off a 5-60min extract — a tab left
    // open for hours would otherwise authenticate the long job with a stale,
    // 401-prone boot snapshot.
    await refreshDaSdk();
    return apiFetch('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        source,
        sourceInput,
        daContext: state.da.context,
        serverConfig: buildServerConfig(),
      }),
    });
  },
  restoreSession({ source, sourceInput, versions }) {
    return apiFetch('/sessions/restore', {
      method: 'POST',
      body: JSON.stringify({
        source,
        sourceInput,
        versions,
        daContext: state.da.context,
        serverConfig: buildServerConfig(),
      }),
    });
  },
  getSession(sessionId) {
    return apiFetch(`/sessions/${sessionId}`);
  },
  refine(sessionId, { intent, fromV, mode }) {
    return apiFetch(`/sessions/${sessionId}/refine`, {
      method: 'POST',
      body: JSON.stringify({ intent, ...(fromV != null && { fromV }), ...(mode && { mode }) }),
    });
  },
  cancel(sessionId) {
    return apiFetch(`/sessions/${sessionId}/cancel`, { method: 'POST' });
  },
  // Resume a tweak that paused at its turn limit (the agent keeps its context).
  continueTweak(sessionId) {
    return apiFetch(`/sessions/${sessionId}/continue`, { method: 'POST' });
  },
  // Abandon a paused tweak, staying on the current version.
  discardTweak(sessionId) {
    return apiFetch(`/sessions/${sessionId}/discard`, { method: 'POST' });
  },
  async deployPrototype(sessionId, { slug, username, mode, animations, exportOpts }) {
    // Re-await DA_SDK so we send the freshest token. The boot-time snapshot
    // can be ~hours stale on a tab left open; DA's underlying IMS lib
    // refreshes its session lazily, so a fresh await gives us whatever
    // DA currently considers valid.
    await refreshDaSdk();
    return apiFetch(`/sessions/${sessionId}/deploy-prototype`, {
      method: 'POST',
      body: JSON.stringify({
        slug,
        username,
        mode, // 'blocks' (editable forge-* blocks) | 'overlay' (1:1 frozen) — Milo repos only
        animations, // 'default' | 'preserve' | 'off' — block mode only
        daContext: state.da.context,
        token: state.da.token,
        repoPath: state.config.repoPath,
        snowflakeSkillPath: state.config.snowflakeSkillPath,
        consumerPreviewUrl: state.config.consumerPreviewUrl,
        // Per-export overrides — defaults to state.config.export when null.
        export: exportOpts || state.config.export,
      }),
    });
  },
  async ship(sessionId, { exportOpts } = {}) {
    await refreshDaSdk();
    return apiFetch(`/sessions/${sessionId}/ship`, {
      method: 'POST',
      body: JSON.stringify({
        daContext: state.da.context,
        token: state.da.token,
        repoPath: state.config.repoPath,
        consumerPreviewUrl: state.config.consumerPreviewUrl,
        export: exportOpts || state.config.export,
      }),
    });
  },
  // Refresh the in-flight worktree's pre-staged DA token. Heartbeat path
  // for long deploys — keeps .snowflake/da-token.json warm so the agent's
  // child scripts always read a non-stale token from --token-file.
  refreshToken(sessionId, token) {
    return apiFetch(`/sessions/${sessionId}/refresh-token`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
  // Re-run v1 generation after an error, sending the (possibly just-fixed) config.
  retry(sessionId) {
    return apiFetch(`/sessions/${sessionId}/retry`, {
      method: 'POST',
      body: JSON.stringify({
        serverConfig: buildServerConfig(),
        daContext: state.da.context,
        token: state.da.token,
      }),
    });
  },
  // ── Conversion report / override surfaces (Owner G endpoints) ────────────
  // The match-report is written to disk by the matcher (shared/data/<sid>/
  // match-report.json) and exposed by GET /sessions/:id/match-report. The
  // client fetches it once when the poll payload doesn't already carry it.
  matchReport(sessionId) {
    return apiFetch(`/sessions/${sessionId}/match-report`);
  },
  // Replay an operator override against the matcher (agent-free, fast) and get
  // back the recomputed report. decision is one of make-variant-of /
  // keep-snowflake / promote-to-new-block; `block` names the target on a
  // make-variant-of override.
  overrideSection(sessionId, { index, decision, block }) {
    return apiFetch(`/sessions/${sessionId}/override-section`, {
      method: 'POST',
      body: JSON.stringify({ index, decision, ...(block && { block }) }),
    });
  },
  // Scoped single-section re-ship seeded by a freeform prompt.
  refactorSection(sessionId, { index, prompt }) {
    return apiFetch(`/sessions/${sessionId}/refactor-section`, {
      method: 'POST',
      body: JSON.stringify({ index, prompt }),
    });
  },
  // The C2 block catalog — populates the override <select> and the side-by-side
  // RIGHT pane's matched-block reference.
  catalogBlocks() {
    return apiFetch('/catalog/blocks');
  },
  // Raw outerHTML of one section, for the side-by-side LEFT pane iframe srcdoc.
  sectionHtml(sessionId, index) {
    return apiFetch(`/sessions/${sessionId}/section/${index}/html`);
  },
  // On-disk session list, so reviewers can reopen any past session's report
  // after a server restart (not just the last MAX_HISTORY in this browser).
  sessionsHistory() {
    return apiFetch('/sessions/history');
  },
};

// In-memory cache of GET /catalog/blocks (small, stable for the process). The
// override <select> reads this; populated lazily on first expand.
let _catalogBlocksCache = null;
async function getCatalogBlocks() {
  if (_catalogBlocksCache) return _catalogBlocksCache;
  try {
    const r = await api.catalogBlocks();
    _catalogBlocksCache = Array.isArray(r?.blocks) ? r.blocks : [];
  } catch {
    _catalogBlocksCache = []; // endpoint not up yet — degrade to sentinels only
  }
  return _catalogBlocksCache;
}

// Probe the server for the session; if 404 (server restart wiped it),
// restore it from the local cache and return the new server-assigned id.
// On success, returns the current sessionId unchanged.
async function ensureServerSession(s) {
  try {
    await api.getSession(s.sessionId);
    return s.sessionId;
  } catch (err) {
    if (err.status !== 404) throw err;
  }
  const versions = (s.versions || []).filter((v) => v?.html).map((v) => ({
    html: v.html, intent: v.intent || null, basedOnV: v.basedOnV ?? null,
  }));
  if (versions.length === 0) {
    throw new Error('No cached versions to restore — generate a new session.');
  }
  const { sessionId: newId } = await api.restoreSession({
    source: s.source || 'raw-html',
    sourceInput: s.sourceInput || {},
    versions,
  });
  // Move the cached session to the new sessionId so subsequent calls work.
  const oldId = s.sessionId;
  s.sessionId = newId;
  state.sessions.delete(oldId);
  state.sessions.set(newId, s);
  if (state.activeSessionId === oldId) {
    state.activeSessionId = newId;
    localStorage.setItem(STORAGE_KEY_ACTIVE, newId);
  }
  const histIdx = state.history.findIndex((e) => e.sessionId === oldId);
  if (histIdx >= 0) {
    state.history[histIdx].sessionId = newId;
    saveHistory();
  }
  return newId;
}

// ── Polling ──────────────────────────────────────────────────────────────────

function startPolling() {
  stopPolling();
  if (!state.activeSessionId) return;
  state.pollHandle = setInterval(pollTick, POLL_INTERVAL_MS);
  pollTick(); // immediate fetch
}

function stopPolling() {
  if (state.pollHandle) clearInterval(state.pollHandle);
  state.pollHandle = null;
}

// Heartbeat cadence for the DA token refresh. With POLL_INTERVAL_MS=2000 this
// fires every 60s — well inside DA's ~1h token validity. Long enough not to
// hammer DA_SDK; short enough to recover from a tab-was-open-overnight stale
// token before the deploy attempts a DA push.
const TOKEN_REFRESH_EVERY_N_TICKS = 30;

async function pollTick() {
  const id = state.activeSessionId;
  if (!id) return;
  try {
    const fresh = await api.getSession(id);
    state.pollFailureCount = 0;
    const prev = state.sessions.get(id);
    state.sessions.set(id, fresh);
    // Token refresh heartbeat: while a deploy is mid-flight, periodically
    // re-await DA_SDK and post the freshest token to the worktree. The
    // server no-ops if no deploy is actually in flight, so a stray fire
    // is harmless.
    if (fresh.status === 'deploying' || fresh.status === 'shipping') {
      state._tokenTick = (state._tokenTick || 0) + 1;
      if (state._tokenTick % TOKEN_REFRESH_EVERY_N_TICKS === 0) {
        refreshDaSdk().then(() => {
          if (state.da.token) {
            api.refreshToken(id, state.da.token).catch((e) => console.warn('refreshToken failed', e));
          }
        });
      }
    } else if (state._tokenTick) {
      state._tokenTick = 0;
    }
    // Anchor run-scoped elapsed when a run starts server-side or after a reload
    // mid-run (explicit markRunStart at action points already covers the rest).
    if ((!prev || !isBusy(prev)) && isBusy(fresh) && !state.runStart.has(id)) markRunStart(id);
    // Freeze the wall clock when the run settles so the status bar shows the final time.
    if (prev && isBusy(prev) && !isBusy(fresh)) state.runEnd.set(id, Date.now());
    if (state.ui.viewedV === null
        || (prev && fresh.currentV !== prev.currentV)) {
      state.ui.viewedV = fresh.currentV;
    }
    upsertHistoryEntry(fresh);
    // Skip full work-area re-render when only the log/messages changed —
    // re-creating the preview iframe resets scroll position. Material
    // changes that DO warrant a re-render: new version, version switch,
    // status/phase change, shipped payload change.
    const materialChange = !prev
      || prev.versions.length !== fresh.versions.length
      || prev.currentV !== fresh.currentV
      || prev.status !== fresh.status
      || prev.phase !== fresh.phase
      || prev.lastSummary !== fresh.lastSummary
      || JSON.stringify(prev.shipped || {}) !== JSON.stringify(fresh.shipped || {});
    if (materialChange) {
      renderActiveSession();
    } else {
      // Log/elapsed update only — no work-area rebuild (rebuilding resets the
      // preview iframe scroll). status/phase stay constant for the whole
      // multi-minute stardust run, so without this the Activity log panel would
      // freeze at its run-start snapshot while the server's messages keep
      // growing. Reconcile the log + inline progress in place instead.
      renderStatusStrip();
      const logGrew = (prev?.messages?.length || 0) !== (fresh.messages?.length || 0);
      // Refresh on log growth OR while a live elapsed indicator is mounted (the
      // generating-card elapsed must tick every poll, not only when a new log
      // line happens to land — otherwise the elapsed timer freezes between
      // activity bursts).
      if (logGrew || (isBusy(fresh) && dom.workArea.querySelector('.pf-gen-elapsed'))) {
        refreshLiveLog(fresh);
      }
    }
    renderSidebar();
    if (fresh.status === 'done' || fresh.status === 'error' || fresh.status === 'paused') {
      // Slow the poll to once every 5s after settling; still useful for deploy/ship
      // status changes and for picking up a Continue/Discard the user just triggered.
      stopPolling();
      state.pollHandle = setInterval(pollTick, 5000);
    }
  } catch (err) {
    // 404 = server restart wiped the in-memory session. Fall back to the
    // cached synthetic session loaded from localStorage; stop polling silently.
    if (err.status === 404) {
      stopPolling();
      const hasCached = state.sessions.has(id);
      if (hasCached) {
        setStatusBanner('Loaded from local cache — server restarted since this session ran. Generate a new one to keep iterating.', 'info');
      } else {
        setStatusBanner('Session not on server — try starting a new one.', 'info');
      }
      return;
    }
    state.pollFailureCount++;
    console.warn('poll failed', err.message);
    if (state.pollFailureCount >= 5) {
      stopPolling();
      setStatusBanner(`Lost connection to server: ${err.message}`, 'error');
    }
  }
}

// ── Persistent layout ────────────────────────────────────────────────────────

const dom = {
  shell: null,
  topbar: null,
  sidebar: null,
  workArea: null,
  statusStrip: null,
  modalRoot: null,
  toast: null,
};

function buildShell() {
  document.body.innerHTML = '';
  dom.topbar = el('div', { class: 'pf-topbar' });
  dom.sidebar = el('aside', { class: 'pf-sidebar' });
  dom.workArea = el('main', { class: 'pf-work' });
  dom.statusStrip = el('div', { class: 'pf-status-strip', hidden: true });
  dom.modalRoot = el('div', { class: 'pf-modal-root' });
  dom.toast = el('div', { class: 'pf-toast', hidden: true });

  dom.shell = el('div', { class: 'pf-shell' },
    dom.topbar,
    el('div', { class: 'pf-body' },
      dom.sidebar,
      el('div', { class: 'pf-work-wrap' }, dom.workArea, dom.statusStrip),
    ),
    dom.modalRoot,
    dom.toast,
  );
  document.body.append(dom.shell);
}

function renderTopBar() {
  clear(dom.topbar);
  dom.topbar.append(
    el('div', { class: 'pf-brand' },
      el('span', { class: 'pf-brand-dot' }),
      el('span', { class: 'pf-brand-name' }, 'Page Forge'),
    ),
    el('div', { class: 'pf-topbar-actions' },
      el('button', {
        class: 'pf-iconbtn',
        title: 'Settings',
        onclick: () => { state.ui.settingsOpen = true; renderModal(); },
      }, '⚙'),
    ),
  );
}

function renderSidebar() {
  clear(dom.sidebar);
  const header = el('div', { class: 'pf-side-head' },
    el('span', { class: 'pf-side-title' }, 'Sessions'),
    el('button', {
      class: 'pf-newbtn',
      title: 'Start a new session',
      onclick: () => {
        if (state.activeSessionId) {
          const cur = state.sessions.get(state.activeSessionId);
          if (cur && isBusy(cur)) {
            showConfirm('A run is in progress. Start a new session anyway? (the in-flight one keeps running)', () => {
              clearActiveSession();
              renderWorkArea();
            });
            return;
          }
        }
        clearActiveSession();
        renderWorkArea();
      },
    }, '+ New'),
  );

  const list = el('ul', { class: 'pf-side-list' });
  if (state.history.length === 0) {
    list.append(el('li', { class: 'pf-side-empty' }, 'No sessions yet.'));
  } else {
    for (const entry of state.history) {
      const isActive = entry.sessionId === state.activeSessionId;
      const versionsTotal = entry.versionCount ?? entry.versions?.length ?? 0;
      const liveSession = state.sessions.get(entry.sessionId);
      const liveBusy = liveSession ? isBusy(liveSession) : false;
      const vLabel = versionsTotal > 0 ? `v${entry.currentV ?? versionsTotal}` : '—';
      const removeBtn = el('button', {
        class: 'pf-side-remove',
        type: 'button',
        title: 'Remove session',
        onclick: (e) => {
          e.stopPropagation();
          deleteHistoryEntry(entry.sessionId);
        },
      }, '×');
      const item = el('li', {
        class: `pf-side-item ${isActive ? 'pf-side-item--active' : ''}`,
        onclick: () => loadHistoryEntry(entry),
      },
        el('div', { class: 'pf-side-item-row' },
          el('span', { class: `pf-side-chip pf-side-chip--${entry.source}` }, sourceLabel(entry.source)),
          el('span', { class: 'pf-side-item-label' }, entry.label || '(untitled)'),
        ),
        el('div', { class: 'pf-side-item-meta' },
          liveBusy ? el('span', { class: 'pf-side-running', title: liveSession?.status }) : null,
          el('span', { class: 'pf-side-vlabel' }, vLabel),
          entry.shipped?.prototypeUrl ? el('span', { class: 'pf-shipped pf-shipped--proto', title: entry.shipped.prototypeUrl }, '🌐') : null,
          entry.shipped?.branchUrl ? el('span', { class: 'pf-shipped pf-shipped--ship', title: entry.shipped.branchUrl }, '🏷') : null,
          el('span', { class: 'pf-side-item-age' }, fmtAge(entry.ts)),
          removeBtn,
        ),
      );
      list.append(item);
    }
  }
  dom.sidebar.append(header, list);

  // Server-side history (P2#8): a footer button to pull on-disk sessions under
  // shared/data/<sid>/ so reviewers can reopen any past session's report after
  // a restart — not just the last MAX_HISTORY in this browser. The endpoint is
  // Owner G's; if it isn't deployed yet the button reports that and no-ops.
  const loadMoreBtn = el('button', {
    class: 'pf-side-loadmore',
    type: 'button',
    title: 'List past sessions stored on the server (survives restarts + the browser cap)',
    onclick: async () => {
      loadMoreBtn.disabled = true; loadMoreBtn.textContent = 'Loading…';
      try {
        const added = await loadServerHistory();
        loadMoreBtn.textContent = added > 0 ? `Loaded ${added} more` : 'No more on disk';
        if (added > 0) renderSidebar();
      } catch (err) {
        loadMoreBtn.textContent = 'Server history unavailable';
      }
      setTimeout(() => { if (loadMoreBtn.isConnected) { loadMoreBtn.disabled = false; loadMoreBtn.textContent = '↻ Load past sessions'; } }, 1600);
    },
  }, '↻ Load past sessions');
  dom.sidebar.append(loadMoreBtn);
}

// Fetch the on-disk session list and merge any not already in local history
// into state.history (so they appear in the sidebar and can be reopened). The
// server returns lightweight descriptors; we synthesize a minimal history entry
// (no inline HTML — a click re-polls the live session). Returns the count added.
async function loadServerHistory() {
  const r = await api.sessionsHistory();
  const items = Array.isArray(r?.sessions) ? r.sessions : (Array.isArray(r) ? r : []);
  const known = new Set(state.history.map((e) => e.sessionId));
  let added = 0;
  for (const it of items) {
    const sid = it.sessionId || it.id;
    if (!sid || known.has(sid)) continue;
    state.history.push({
      sessionId: sid,
      source: it.source || 'raw-html',
      label: it.label || it.slug || sid,
      versionCount: it.versionCount ?? 0,
      currentV: it.currentV ?? it.versionCount ?? 0,
      versions: [],                 // hydrated on click via the live re-poll
      shipped: it.shipped || {},
      status: it.status || 'done',
      messagesTail: [],
      matchReportSummary: it.matchReportSummary || null,
      ts: it.ts || it.finishedAt || Date.now(),
      _fromServer: true,
    });
    known.add(sid);
    added++;
  }
  if (added > 0) {
    state.history.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    saveHistory();
  }
  return added;
}

function sourceLabel(id) {
  const s = SOURCES.find((x) => x.id === id);
  return s ? s.label : id;
}

// ── Work area ────────────────────────────────────────────────────────────────

function renderWorkArea() {
  if (state.activeSessionId) {
    renderActiveSession();
  } else {
    renderInputPanel();
  }
  renderSidebar();
}

function renderInputPanel() {
  clear(dom.workArea);
  dom.statusStrip.hidden = true;

  const segmented = el('div', { class: 'pf-segmented' },
    ...SOURCES.map((s) => el('button', {
      class: `pf-seg ${state.ui.selectedSource === s.id ? 'pf-seg--active' : ''}`,
      onclick: () => {
        state.ui.selectedSource = s.id;
        localStorage.setItem(STORAGE_KEY_SOURCE, s.id);
        renderInputPanel();
      },
    }, s.label)),
  );

  const src = SOURCES.find((s) => s.id === state.ui.selectedSource);
  const isFigma = src.id === 'figma';
  // Match (1:1 snowflake) vs Reimagine (stardust redesign). Figma is always 1:1.
  const reimagine = !isFigma && state.ui.redesignMode === 'reimagine';
  const modeToggle = isFigma ? null : el('div', { class: 'pf-segmented pf-segmented--mode' },
    ...[['match', 'Match · 1:1'], ['reimagine', 'Reimagine']].map(([id, label]) => el('button', {
      class: `pf-seg ${state.ui.redesignMode === id ? 'pf-seg--active' : ''}`,
      onclick: () => { state.ui.redesignMode = id; renderInputPanel(); },
    }, label)),
  );

  const input = src.inputKind === 'textarea'
    ? el('textarea', { class: 'pf-input pf-input--ta', placeholder: src.placeholder, rows: 10 })
    : el('input', { class: 'pf-input', type: 'text', placeholder: src.placeholder });

  let breakpointList = buildBreakpointList();
  breakpointList.el.style.display = 'none';
  let bpMultiMode = false;

  const figmaUrlFieldWrap = el('div', { class: 'pf-figma-url-wrap' });

  function setBpMultiMode(on) {
    bpMultiMode = on;
    figmaUrlFieldWrap.hidden = on;
    breakpointList.el.style.display = on ? '' : 'none';
    bpToggle.textContent = on ? '× Single URL' : '＋ Add breakpoints';
    if (on) {
      const seedUrl = input.value.trim();
      const seed = seedUrl.includes('figma.com')
        ? [{ label: 'Desktop', width: 1440, figmaUrl: seedUrl }, ...DEFAULT_BREAKPOINTS.slice(1)]
        : DEFAULT_BREAKPOINTS;
      const nl = buildBreakpointList(seed);
      breakpointList.el.replaceWith(nl.el);
      breakpointList = nl;
    }
  }

  const bpToggle = el('button', {
    class: 'pf-bp-toggle',
    type: 'button',
    hidden: !isFigma,
    onclick: () => setBpMultiMode(!bpMultiMode),
  }, '＋ Add breakpoints');

  const intentPlaceholder = isFigma
    ? 'Optional — guides the v1 snowflake generation, and seeds Refine afterward'
    : 'Optional — leave blank for 3 auto variants, or describe a direction (e.g. "more editorial") for one targeted redesign';
  const intent = el('textarea', {
    class: 'pf-input pf-input--intent',
    placeholder: intentPlaceholder,
    rows: 3,
  });

  const errorEl = el('div', { class: 'pf-form-error', hidden: true });
  const submitLabel = isFigma ? 'Generate' : (reimagine ? 'Reimagine' : 'Generate · 1:1');

  const submit = el('button', {
    class: 'pf-primary',
    onclick: async () => {
      errorEl.hidden = true;
      const sourceInput = {};
      const val = input.value.trim();

      if (isFigma && bpMultiMode) {
        const bps = breakpointList.getBreakpoints();
        if (bps.length === 0) {
          errorEl.textContent = 'Add at least one breakpoint with a valid figma.com URL';
          errorEl.hidden = false;
          return;
        }
        sourceInput.breakpoints = bps;
        sourceInput.figmaUrl = bps[0].figmaUrl;
      } else {
        if (!val) {
          errorEl.textContent = `${src.label} input is required`;
          errorEl.hidden = false;
          return;
        }
        sourceInput[src.inputKey] = val;
      }

      // Match vs Reimagine (url/raw-html). Intent only matters for Figma refine
      // or Reimagine; under Match it's ignored (1:1).
      if (!isFigma) sourceInput.mode = state.ui.redesignMode;
      if (intent.value.trim() && (isFigma || reimagine)) {
        sourceInput.intent = intent.value.trim();
      }

      submit.disabled = true;
      submit.textContent = 'Starting…';
      try {
        const { sessionId } = await api.createSession({ source: src.id, sourceInput });
        markRunStart(sessionId);
        setActiveSession(sessionId);
        renderActiveSession();
        renderSidebar();
        startPolling();
      } catch (err) {
        submit.disabled = false;
        submit.textContent = submitLabel;
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
    },
  }, submitLabel);

  const fields = [
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Source'),
      segmented,
      el('div', { class: 'pf-help' }, src.hint),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, src.label),
      isFigma
        ? (figmaUrlFieldWrap.append(input), figmaUrlFieldWrap)
        : input,
      isFigma ? bpToggle : null,
      isFigma ? breakpointList.el : null,
    ),
  ];

  // Mode (url / raw-html only): Match (1:1 snowflake) vs Reimagine (stardust).
  if (!isFigma) {
    fields.push(el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Mode'),
      modeToggle,
      el('div', { class: 'pf-help' }, reimagine
        ? 'Reimagine — redesign with stardust (impeccable-backed). Runs several minutes. Blank intent → 3 auto variants; an intent → one targeted redesign. Pick a result, then Deploy as Prototype.'
        : 'Match — recreate the page 1:1 in DA via snowflake (fast). Switch to Reimagine to redesign instead.'),
    ));
  }

  // Intent only applies to Figma (refine seed) or Reimagine.
  if (isFigma || reimagine) {
    fields.push(el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Intent', el('span', { class: 'pf-label-opt' }, ' (optional)')),
      intent,
    ));
  }

  fields.push(
    errorEl,
    el('div', { class: 'pf-form-actions' }, submit),
  );

  dom.workArea.append(
    el('div', { class: 'pf-input-card' },
      el('h2', { class: 'pf-input-title' }, 'New session'),
      el('p', { class: 'pf-input-sub' }, 'Choose a source and generate a v1. Iterate from there — deploy only when you\'re happy.'),
      ...fields,
    ),
  );
}

function renderActiveSession() {
  const s = state.sessions.get(state.activeSessionId);
  if (!s) {
    clear(dom.workArea);
    dom.workArea.append(el('div', { class: 'pf-loading' }, 'Loading session…'));
    return;
  }

  const viewedV = state.ui.viewedV ?? s.currentV ?? (s.versions[s.versions.length - 1]?.v);
  const viewedVersion = s.versions.find((v) => v.v === viewedV);
  const busy = isBusy(s);
  const hasVersions = s.versions.length > 0;

  clear(dom.workArea);

  dom.workArea.append(renderSessionHeader(s));

  // Versions strip — only when at least one version exists. A "ghost" chip
  // appears at the end while refining/generating so the user can see what's
  // about to be added.
  if (hasVersions || busy) {
    dom.workArea.append(renderVersionsStrip(s, viewedV, busy));
  }

  // Preview / generating area
  dom.workArea.append(renderPreviewArea(s, viewedVersion, busy));

  if (hasVersions) {
    dom.workArea.append(renderRefineCard(s, viewedV));
    const hist = renderVersionHistory(s);
    if (hist) dom.workArea.append(hist);
    dom.workArea.append(renderDeployCard(s, viewedV));
  }

  const report = renderSessionReport(s, viewedVersion);
  if (report) dom.workArea.append(report);

  // When a preview is already showing (refine-in-progress or a finished run),
  // the generating card isn't on screen — surface the full activity log here so
  // the long two-phase runs are inspectable. Collapsed by default.
  if (hasVersions && (s.messages?.length)) {
    const log = renderActivityLog(s, { open: false });
    if (log) dom.workArea.append(log);
  }

  renderStatusStrip();
}

function isBusy(s) {
  return ['queued', 'generating', 'refining', 'shipping', 'deploying'].includes(s.status);
}

function renderSessionHeader(s) {
  const intent = cleanVariantIntent(s.versions[0]?.intent) || s.sourceInput?.intent;
  const sourceVal = s.sourceInput?.url
    || s.sourceInput?.figmaUrl
    || (s.sourceInput?.html ? `(${s.sourceInput.html.length} bytes of HTML)` : '(no source)');
  return el('div', { class: 'pf-session-head' },
    el('div', { class: 'pf-session-head-row' },
      el('span', { class: `pf-side-chip pf-side-chip--${s.source}` }, sourceLabel(s.source)),
      el('span', { class: 'pf-session-source' }, sourceVal),
    ),
    intent ? el('div', { class: 'pf-session-intent' },
      el('span', { class: 'pf-session-intent-label' }, 'Intent'),
      el('span', { class: 'pf-session-intent-text' }, '"', intent, '"'),
    ) : null,
  );
}

function renderVersionsStrip(s, viewedV, busy) {
  const strip = el('div', { class: 'pf-versions' });
  for (const v of s.versions) {
    const isActive = v.v === viewedV;
    strip.append(el('button', {
      class: `pf-vchip ${isActive ? 'pf-vchip--active' : ''}`,
      title: v.intent ? `v${v.v}: ${v.intent}${v.basedOnV ? ` (from v${v.basedOnV})` : ''}` : `v${v.v}`,
      onclick: () => { state.ui.viewedV = v.v; renderActiveSession(); },
    }, `v${v.v}`));
  }
  if (busy) {
    const ghostV = s.versions.length + 1;
    // Reimagine with no intent → uplift emits 3–4 variants at once, so "generating v1"
    // would be a lie. Detect that path and label it honestly.
    const multiVariant = s.status === 'generating'
      && s.sourceInput?.mode === 'reimagine' && !s.sourceInput?.intent;
    const label = s.status === 'generating' ? (multiVariant ? 'generating variants…' : `generating v${ghostV}…`)
      : s.status === 'refining' ? `refining → v${ghostV}…`
      : s.status === 'shipping' ? 'shipping…'
      : s.status === 'deploying' ? 'deploying…'
      : `${s.status}…`;
    strip.append(el('span', { class: 'pf-vchip pf-vchip--ghost' }, label));
  }
  return strip;
}

// srcdoc iframes use `about:srcdoc` as the document base, so relative URLs
// (`./media_*.png`) cannot resolve. Inject a <base> pointing at the local
// page-forge server's /snowflake/ route so the extracted HTML's relative
// image paths resolve to on-disk files served from snowflake-pages/.
// target="_blank" keeps stray link clicks from clobbering the iframe.
function injectPreviewBaseHref(html) {
  const serverUrl = (state?.config?.serverUrl || DEFAULT_SERVER_URL).replace(/\/+$/, '');
  const baseTag = `<base href="${serverUrl}/snowflake/" target="_blank">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  }
  return `${baseTag}${html}`;
}

function renderPreviewArea(s, viewedVersion, busy) {
  const wrap = el('div', { class: 'pf-preview-wrap' });
  if (viewedVersion?.html) {
    const iframe = el('iframe', { class: 'pf-preview', sandbox: 'allow-same-origin allow-scripts' });
    wrap.append(iframe);
    iframe.srcdoc = injectPreviewBaseHref(viewedVersion.html);
    // While busy refining on top of an existing version, overlay a thin
    // banner so the user knows a new version is coming.
    if (busy && s.versions.length > 0) {
      wrap.append(el('div', { class: 'pf-preview-overlay' }, renderProgressInline(s)));
    }
    if (s.status === 'paused') wrap.append(renderTweakPausedBanner(s));
    return wrap;
  }
  if (busy || s.status === 'queued') {
    // While the agent is alive and waiting on Figma OAuth, surface the
    // sign-in card ABOVE the generating spinner. The agent is doing its
    // sleep-then-retry loop; the SDK's listener is alive for the callback.
    if (s.figmaAuthUrl) wrap.append(renderFigmaReauthCard(s, { busy: true }));
    wrap.append(renderGeneratingCard(s));
    return wrap;
  }
  // Pre-v1 errors take over the whole pane — there's nothing to preview, so
  // the error card is the entire surface. Post-v1 errors (e.g. a Deploy that
  // failed AFTER v1 was generated) fall through to the normal render path
  // so the user keeps their preview AND the Deploy button — the failure is
  // surfaced in the deploy report card (renderDeployReport reads
  // shipped.deployError + shipped.deployStatus='failed' / 'partial').
  // Without this scope-tightening, status='error' from a Deploy failure
  // dead-ended the UI: no Retry (canRetry guarded on versions.length===0),
  // no Deploy button (renderDeployCard never reached). "Button goes away
  // for good."
  if (s.status === 'error' && (s.versions?.length || 0) === 0) {
    // Figma MCP needs re-auth — surface a dedicated card with a one-click
    // Sign in. The plugin's OAuth listener is alive on localhost:54987; when
    // the browser completes the redirect there, the token caches and the
    // next Retry uses it. No CLI, no file editing, no .claude poking.
    if (s.figmaAuthUrl) {
      wrap.append(renderFigmaReauthCard(s));
      return wrap;
    }
    const canRetry = true; // by definition — versions.length === 0 here
    const rawErr = s.error || 'unknown';
    // The server runs one agent at a time; a concurrent start lands here with a
    // raw "another agent is already running" message. Make it actionable.
    const errMsg = /already running/i.test(rawErr)
      ? 'The server runs one generation at a time, and another run is in progress. Wait for it to finish, then Retry.'
      : rawErr;
    const errCard = el('div', { class: 'pf-preview-placeholder pf-preview-placeholder--err' },
      el('div', { class: 'pf-err-title' }, 'Error'),
      el('div', { class: 'pf-err-msg' }, errMsg),
    );
    if (canRetry) {
      errCard.append(el('div', { class: 'pf-err-actions' },
        el('button', { class: 'pf-secondary', onclick: () => { state.ui.settingsOpen = true; renderModal(); } }, 'Open Settings'),
        el('button', {
          class: 'pf-primary',
          onclick: async (e) => {
            const btn = e.currentTarget;
            btn.disabled = true; btn.textContent = 'Retrying…';
            try {
              await api.retry(s.sessionId);
              markRunStart(s.sessionId);
              startPolling();
              renderActiveSession();
            } catch (err) {
              btn.disabled = false; btn.textContent = 'Retry';
              toast(`Retry failed: ${err.message}`);
            }
          },
        }, 'Retry'),
      ));
    }
    wrap.append(errCard);
    return wrap;
  }
  if (s.status === 'paused') {
    wrap.append(renderTweakPausedBanner(s));
    return wrap;
  }
  wrap.append(el('div', { class: 'pf-preview-placeholder' }, '(no preview)'));
  return wrap;
}

// Card shown when the Figma MCP server expired its OAuth session mid-extract.
//
// IMPORTANT mechanic: the Figma MCP server is remote (https://mcp.figma.com/mcp).
// The Agent SDK opens an ephemeral local listener at `localhost:<port>/callback`
// to receive the OAuth code. That listener stays alive ONLY while the agent's
// query() is running. The extract agent therefore sleep-and-retries the MCP
// tool — staying alive — so the listener catches the redirect when the user
// completes sign-in. The forge UI just bridges the "open the URL" step.
//
// Two render modes:
//   busy:  agent is mid-run, listener is alive — user clicks Sign in, browser
//          completes OAuth, the SDK silently re-authenticates, the agent's
//          next retry succeeds, the banner disappears on its own.
//   error: agent already exited (sign-in window timed out or other failure).
//          Sign-in opens but the listener is dead; user has to Retry to
//          spawn a new agent (which spawns a new listener).
function renderFigmaReauthCard(s, { busy = false } = {}) {
  const card = el('div', { class: 'pf-preview-placeholder pf-preview-placeholder--err' },
    el('div', { class: 'pf-err-title' }, 'Figma sign-in required'),
    el('div', { class: 'pf-err-msg' },
      busy
        ? 'Sign in to refresh your Figma authentication. The agent is waiting — '
          + 'your design will resume automatically once you complete sign-in.'
        : 'Your Figma authentication has expired. Click Retry first to spawn '
          + 'a fresh sign-in session, then click Sign in to Figma in the new card.',
    ),
  );
  const signedInHint = el('div', { class: 'pf-err-msg', style: 'opacity:0.7;margin-top:8px;display:none' },
    busy
      ? 'Tab opened. Complete sign-in — the run will resume in a few seconds.'
      : 'Tab opened. Complete sign-in, then click Retry.');
  card.append(signedInHint);
  const actions = el('div', { class: 'pf-err-actions' });
  actions.append(el('button', {
    class: 'pf-primary',
    onclick: () => {
      const w = window.open(s.figmaAuthUrl, '_blank', 'noopener,noreferrer');
      if (!w) window.location.href = s.figmaAuthUrl;
      signedInHint.style.display = '';
    },
  }, 'Sign in to Figma'));
  // Retry only makes sense when the agent has exited. During a live run, the
  // sleep-retry loop inside the agent handles re-attempts automatically.
  if (!busy) {
    actions.append(el('button', {
      class: 'pf-secondary',
      onclick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true; btn.textContent = 'Retrying…';
        try {
          await api.retry(s.sessionId);
          markRunStart(s.sessionId);
          startPolling();
          renderActiveSession();
        } catch (err) {
          btn.disabled = false; btn.textContent = 'Retry';
          toast(`Retry failed: ${err.message}`);
        }
      },
    }, 'Retry'));
  }
  card.append(actions);
  return card;
}

// Banner shown when a tweak paused at its turn limit. Continue resumes the same
// agent session (keeps its context); Discard abandons it and stays on the
// current version. The user can Continue any number of times.
function renderTweakPausedBanner(s) {
  const banner = el('div', { class: 'pf-preview-overlay pf-preview-overlay--paused' });
  banner.append(el('span', { class: 'pf-paused-msg' },
    s.pausedReason || 'The tweak paused at its turn limit before finishing.'));
  const continueBtn = el('button', {
    class: 'pf-banner-btn',
    onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = 'Continuing…';
      try {
        await api.continueTweak(s.sessionId);
        markRunStart(s.sessionId);
        startPolling();
        renderActiveSession();
      } catch (err) {
        b.disabled = false; b.textContent = 'Continue';
        toast(`Continue failed: ${err.message}`);
      }
    },
  }, 'Continue');
  const discardBtn = el('button', {
    class: 'pf-banner-btn pf-banner-btn--ghost',
    onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true; b.textContent = 'Discarding…';
      try {
        await api.discardTweak(s.sessionId);
        startPolling();
        renderActiveSession();
      } catch (err) {
        b.disabled = false; b.textContent = 'Discard';
        toast(`Discard failed: ${err.message}`);
      }
    },
  }, 'Discard');
  banner.append(el('div', { class: 'pf-paused-actions' }, discardBtn, continueBtn));
  return banner;
}

// Canonical ordered phases of the figma→Milo pipeline. Drives the "Step N of M"
// counter on the generating card. Excludes done/error/partial/cancelled and the
// separate redesign/tweak flows (those show no step counter). Legacy aliases
// (snowflake→extracting, convert→matching, da-push→shipping) are folded to their
// canonical phase via PHASE_ALIAS so they don't double-count.
const PIPELINE_PHASES = [
  'queued', 'fetch', 'extracting', 'converging', 'matching',
  'composing', 'generating-blocks', 'linting', 'shipping',
];
const PHASE_ALIAS = {
  snowflake: 'extracting',
  convert: 'matching',
  'da-push': 'shipping',
};

// Phase labels — the 11-state table from forge-findings-and-plan.md §4.9.
// During a run we show ONE calm pulse (no anxious ring), the phase label, and
// the truncated activity ticker. No chip strip ticking through sections (that's
// anxious; it lives on the post-run report card per C3 §8).
function renderGeneratingCard(s) {
  const card = el('div', { class: 'pf-gen-card' });
  const phase = s.phase || s.status;
  const phaseLabel = ({
    queued: 'Getting ready',
    fetch: 'Fetching the page',
    redesign: 'Redesigning with your brand',
    tweak: 'Applying your edit',
    // 11-state phase table per master plan §4.9 — replaces the old
    // snowflake/convert/da-push trio with the full pipeline.
    extracting: 'Reading the Figma design',
    snowflake: 'Reading the Figma design', // legacy alias
    converging: 'Matching the reference',
    matching: 'Matching against the catalog',
    composing: 'Composing the page',
    'generating-blocks': 'Authoring new blocks',
    linting: 'Checking Milo-grade rules',
    shipping: 'Shipping to Milo and DA',
    convert: 'Matching against the catalog', // legacy alias
    'da-push': 'Shipping to Milo and DA', // legacy alias
    done: 'Done',
    error: 'Run failed',
    partial: 'Partial deploy — some artifacts shipped',
    cancelled: 'Cancelled by user',
  })[phase] || phase;

  // Dot state per master plan §4.9: green=done, red=error, yellow=partial,
  // gray=cancelled. Settled states use a static colored dot. In-flight states
  // show the calm pulse from the start of the run — no anxious ring.
  const settledDot = ({
    done: 'pf-gen-dot pf-gen-dot--done',
    error: 'pf-gen-dot pf-gen-dot--err',
    partial: 'pf-gen-dot pf-gen-dot--partial',
    cancelled: 'pf-gen-dot pf-gen-dot--cancelled',
  })[phase];
  const indicator = settledDot
    ? el('div', { class: settledDot })
    : el('div', { class: 'pf-gen-pulse' });

  // "Step N of M" — only for in-flight pipeline phases (not settled states, not
  // the redesign/tweak flows). Legacy aliases fold to their canonical phase so
  // they don't double-count. Small muted line above the phase title.
  const canonicalPhase = PHASE_ALIAS[phase] || phase;
  const stepIdx = settledDot ? -1 : PIPELINE_PHASES.indexOf(canonicalPhase);
  const stepLine = stepIdx >= 0
    ? el('div', { class: 'pf-gen-step' }, `Step ${stepIdx + 1} of ${PIPELINE_PHASES.length}`)
    : null;

  card.append(indicator);
  if (stepLine) card.append(stepLine);
  card.append(
    el('div', { class: 'pf-gen-phase' }, phaseLabel),
    renderProgressInline(s),
  );
  const log = renderActivityLog(s, { open: true });
  if (log) card.append(log);
  return card;
}

// Run-scoped elapsed (not session-scoped) — see markRunStart.
// Returns null when no run has been recorded (e.g. history-loaded session with no live run).
// Freezes at runEnd when the run has settled, so the wall clock doesn't keep ticking post-done.
function runElapsedSec(s) {
  const end = state.runEnd.get(s.sessionId);
  const start = state.runStart.get(s.sessionId);
  if (!start) return null;
  return Math.floor(((end ?? Date.now()) - start) / 1000);
}

function renderProgressInline(s) {
  const last = s.messages?.[s.messages.length - 1]?.text || '(no activity yet)';
  return el('div', { class: 'pf-gen-progress' },
    el('div', { class: 'pf-gen-elapsed' }, `${fmtElapsed(runElapsedSec(s)) || '0s'} elapsed`),
    // Label is a SEPARATE sibling of .pf-gen-msg so refreshLiveLog's in-place
    // msgEl.textContent update never clobbers it.
    el('div', { class: 'pf-gen-msg-row' },
      el('span', { class: 'pf-gen-msg-label' }, 'Latest activity'),
      el('div', { class: 'pf-gen-msg', title: last }, last),
    ),
    isBusy(s) ? renderCancelButton(s) : null,
  );
}

// Cancel the in-flight run. The server aborts the agent (terminating its child
// process); polling then picks up the cancelled state. Lives in the progress
// strip, so it shows both in the generating card and the refine overlay.
function renderCancelButton(s) {
  const btn = el('button', {
    class: 'pf-cancel-btn',
    title: 'Stop the running agent',
    onclick: async () => {
      btn.disabled = true; btn.textContent = 'Cancelling…';
      // Tell the server to abort, but don't depend on it: clear the local busy
      // state immediately so the UI unsticks at once — even if the run was
      // orphaned by a restart (no live agent for the server to abort). Stop
      // polling first so a stale in-flight tick can't revert the status.
      try { await api.cancel(s.sessionId); } catch (err) { /* clear locally regardless */ }
      stopPolling();
      const cached = state.sessions.get(s.sessionId);
      if (cached && ['generating', 'refining', 'shipping', 'deploying'].includes(cached.status)) {
        cached.status = 'error';
        cached.phase = 'cancelled';
        cached.error = 'cancelled by user';
      }
      state.runEnd.set(s.sessionId, Date.now());
      state.runStart.delete(s.sessionId);
      renderActiveSession();
      renderSidebar();
    },
  }, 'Cancel');
  return btn;
}

function mdLine(text) {
  const s = String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Auto-link bare URLs in activity-log lines — important for the Figma
    // OAuth URL fallback (when the Sign-in button doesn't appear for any
    // reason, the user can still click the link directly from the log).
    // Boundary stops at whitespace; trailing punctuation (. , ) ] ) is
    // trimmed by the lookbehind on the matched suffix.
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

// Scrollable activity log of every server message for the run. The long
// two-phase stardust runs only ever showed the last line otherwise, so you
// couldn't see phase 1 → inject → phase 2 progress (or confirm uplift didn't
// re-extract). Collapsible; auto-scrolls to the newest line.
function renderActivityLog(s, { open = false } = {}) {
  const msgs = s.messages || [];
  if (!msgs.length) return null;
  const list = el('div', { class: 'pf-log' });
  for (const m of msgs) list.append(el('div', { class: 'pf-log-line', html: mdLine(m.text || String(m)) }));
  requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  return el('details', { class: 'pf-log-details', open },
    el('summary', { class: 'pf-log-summary' }, `Activity log (${msgs.length})`),
    list,
  );
}

// Reconcile the already-mounted Activity log + generating-card progress with
// fresh messages, WITHOUT rebuilding the work area (which would reset the
// preview iframe's scroll). Called from the poll's non-material branch so the
// log keeps streaming during the long, status-constant stardust runs.
function refreshLiveLog(s) {
  const msgs = s.messages || [];
  // Activity log panel (generating card uses open=true; versions view open=false).
  const list = dom.workArea.querySelector('.pf-log');
  if (list) {
    // Append only the lines not yet rendered, then autoscroll.
    for (let i = list.childElementCount; i < msgs.length; i++) {
      list.append(el('div', { class: 'pf-log-line', html: mdLine(msgs[i].text || String(msgs[i])) }));
    }
    const summary = dom.workArea.querySelector('.pf-log-summary');
    if (summary) summary.textContent = `Activity log (${msgs.length})`;
    requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
  }
  // Generating-card inline progress (last line + run-scoped elapsed).
  const msgEl = dom.workArea.querySelector('.pf-gen-msg');
  if (msgEl) {
    const last = msgs[msgs.length - 1]?.text || '(no activity yet)';
    msgEl.textContent = last;
    msgEl.title = last;
  }
  const elapsedEl = dom.workArea.querySelector('.pf-gen-elapsed');
  if (elapsedEl) elapsedEl.textContent = `${fmtElapsed(runElapsedSec(s)) || '0s'} elapsed`;
}

// Readable history of each version's intent. The version chip only shows the
// intent on hover (title attr); this surfaces it as a scannable list. Newest
// first; click a row to view that version. Collapsible, collapsed by default.
function renderVersionHistory(s) {
  const vs = s.versions || [];
  if (vs.length <= 1) return null; // nothing to "history" with a single version
  const viewedV = state.ui.viewedV ?? s.currentV;
  const list = el('div', { class: 'pf-vhist' });
  for (const v of [...vs].reverse()) {
    const intent = (v.intent || '').trim();
    const label = intent || (v.basedOnV ? `Refined from v${v.basedOnV}` : 'Initial version');
    const meta = `${v.basedOnV ? `from v${v.basedOnV} · ` : ''}${fmtAge(v.producedAt)}`;
    list.append(el('button', {
      class: `pf-vhist-row ${v.v === viewedV ? 'pf-vhist-row--active' : ''}`,
      onclick: () => { state.ui.viewedV = v.v; renderActiveSession(); },
    },
      el('span', { class: 'pf-vhist-v' }, `v${v.v}`),
      el('span', { class: 'pf-vhist-intent', title: label }, label),
      el('span', { class: 'pf-vhist-meta' }, meta),
    ));
  }
  return el('details', { class: 'pf-vhist-details' },
    el('summary', { class: 'pf-log-summary' }, `Version history (${vs.length})`),
    list,
  );
}

function renderRefineCard(s) {
  const card = el('div', { class: 'pf-refine-card' });
  const busy = isBusy(s);
  if (s.versions.length === 0) return card;
  const fromV = state.ui.viewedV ?? s.currentV;
  const mode = state.ui.refineMode || 'tweak';

  const ta = el('textarea', {
    class: 'pf-input pf-input--ta',
    rows: 2,
    placeholder: `Refine v${fromV} — e.g. "make the hero darker and increase the type scale"`,
    disabled: busy,
  });
  const errorEl = el('div', { class: 'pf-form-error', hidden: true });

  // Tweak (fast single-shot, default) vs Redesign (full stardust pass). The
  // server self-escalates a tweak to a redesign if the change is structural.
  const modeBtn = (value, label, title) => el('button', {
    class: `pf-mode-btn ${mode === value ? 'pf-mode-btn--on' : ''}`,
    disabled: busy,
    title,
    onclick: () => { state.ui.refineMode = value; renderActiveSession(); },
  }, label);
  const modeToggle = el('div', { class: 'pf-refine-mode' },
    modeBtn('tweak', 'Tweak · fast', 'Edits this variant in place (~1–2 min). Auto-escalates to a full redesign if the change is structural.'),
    modeBtn('redesign', 'Redesign · full', 'Full stardust pass (~10–30 min) — re-runs extract → brand → design from this variant.'),
  );

  const submit = el('button', {
    class: 'pf-primary',
    disabled: busy,
    onclick: async () => {
      const intent = ta.value.trim();
      if (!intent) return;
      errorEl.hidden = true;
      submit.disabled = true; submit.textContent = mode === 'redesign' ? 'Redesigning…' : 'Tweaking…';
      try {
        await api.refine(s.sessionId, { intent, fromV, mode });
        markRunStart(s.sessionId);
        ta.value = '';
        startPolling();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submit.disabled = busy;
        submit.textContent = 'Refine';
      }
    },
  }, 'Refine');

  card.append(
    modeToggle,
    el('div', { class: 'pf-refine-row' }, ta, submit),
    errorEl,
  );
  return card;
}

function renderDeployCard(s) {
  const card = el('div', { class: 'pf-deploy-card' });
  if (s.versions.length === 0) return card;
  const busy = isBusy(s);
  const viewedV = state.ui.viewedV ?? s.currentV;

  const protoBtn = el('button', {
    class: 'pf-deploy-btn',
    disabled: busy,
    onclick: () => { state.ui.modal = 'deploy-prototype'; renderModal(); },
  },
    el('div', { class: 'pf-deploy-btn-row' },
      el('span', { class: 'pf-deploy-icon' }, '🌐'),
      el('span', {}, 'Deploy as prototype'),
    ),
    el('span', { class: 'pf-deploy-sub' }, `Turn v${viewedV} into a 1:1 DA page on a fresh branch — authorable, shareable, ready for A/B testing.`),
  );

  card.append(protoBtn);

  // Completion report — renders only after a deploy attempt has finished
  // (succeeded, failed, or partial). Replaces the old single-line prototype
  // URL row with a full breakdown of cost, duration, every URL, and every
  // local path the deploy produced.
  if (s.shipped?.deployFinishedAt) {
    card.append(renderDeployReport(s));
  } else if (s.shipped?.prototypeUrl) {
    // Backwards-compat: if a session was deployed before this version
    // landed it won't have deployFinishedAt — fall back to the legacy row.
    card.append(el('div', { class: 'pf-shipped-row' },
      el('span', {}, '🌐 prototype: '),
      el('a', { href: s.shipped.prototypeUrl, target: '_blank' }, s.shipped.prototypeUrl),
    ));
  }

  // Advanced: Milo block conversion (north-star path — not the designer-facing flow).
  const advOpen = !!state.ui.advancedOpen;
  const advToggle = el('button', {
    class: 'pf-advanced-toggle',
    onclick: () => { state.ui.advancedOpen = !state.ui.advancedOpen; renderActiveSession(); },
  }, `${advOpen ? '▾' : '▸'} Advanced`);
  card.append(advToggle);

  if (advOpen) {
    const shipBtn = el('button', {
      class: 'pf-deploy-btn pf-deploy-btn--advanced',
      disabled: busy,
      onclick: () => { state.ui.modal = 'ship'; renderModal(); },
    },
      el('div', { class: 'pf-deploy-btn-row' },
        el('span', { class: 'pf-deploy-icon' }, '🧪'),
        el('span', {}, 'Ship via deterministic engine (experimental)'),
      ),
      el('span', { class: 'pf-deploy-sub' }, `Legacy deterministic converter (no agent, ~1 min). Does NOT rebuild section DOM, so bespoke layouts can render broken on Milo. For editable, 1:1 blocks use "Deploy as prototype" → Output: Editable blocks above.`),
    );
    card.append(shipBtn);

    if (s.shipped?.daPreviewUrl) {
      card.append(el('div', { class: 'pf-shipped-row' },
        el('span', {}, '🏷 shipped: '),
        el('a', { href: s.shipped.daPreviewUrl, target: '_blank' }, s.shipped.daPreviewUrl),
        s.shipped.branchUrl ? el('a', { href: s.shipped.branchUrl, target: '_blank', class: 'pf-shipped-branch' }, `branch: ${s.shipped.branchName}`) : null,
      ));
    }
  }

  return card;
}

function renderStatusStrip() {
  const s = state.sessions.get(state.activeSessionId);
  if (!s) { dom.statusStrip.hidden = true; return; }
  dom.statusStrip.hidden = false;
  clear(dom.statusStrip);
  const lastMsg = s.messages?.[s.messages.length - 1]?.text || '';
  const cls = s.status === 'error' ? 'pf-status--err' : s.status === 'done' ? 'pf-status--ok' : 'pf-status--run';
  dom.statusStrip.className = `pf-status-strip ${cls}`;
  const elapsed = runElapsedSec(s);
  dom.statusStrip.append(
    el('span', { class: 'pf-status-dot' }),
    el('span', { class: 'pf-status-state' }, s.status, s.phase && s.phase !== s.status ? ` · ${s.phase}` : ''),
    el('span', { class: 'pf-status-msg', title: lastMsg }, lastMsg.slice(0, 200)),
    // Wall clock: ticks while busy, freezes when done. Only shown when a run was recorded.
    elapsed != null ? el('span', { class: 'pf-status-elapsed' }, fmtElapsed(elapsed)) : null,
  );
}

function setStatusBanner(text, kind = 'info') {
  dom.statusStrip.hidden = false;
  clear(dom.statusStrip);
  dom.statusStrip.className = `pf-status-strip pf-status--${kind === 'error' ? 'err' : 'info'}`;
  dom.statusStrip.append(el('span', { class: 'pf-status-msg' }, text));
}

// ── Session activation / restore ─────────────────────────────────────────────

function setActiveSession(sessionId) {
  state.activeSessionId = sessionId;
  state.ui.viewedV = null;
  localStorage.setItem(STORAGE_KEY_ACTIVE, sessionId);
}

function clearActiveSession() {
  state.activeSessionId = null;
  state.ui.viewedV = null;
  stopPolling();
  localStorage.removeItem(STORAGE_KEY_ACTIVE);
}

function loadHistoryEntry(entry) {
  if (state.activeSessionId && state.activeSessionId !== entry.sessionId) {
    const cur = state.sessions.get(state.activeSessionId);
    if (cur && isBusy(cur)) {
      showConfirm('A run is in progress. Switch sessions anyway? (the in-flight one keeps running)', () => doLoad());
      return;
    }
  }
  doLoad();
  function doLoad() {
    // Hydrate from history first so the UI shows something immediately while we re-poll.
    const versions = entry.versions.filter((v) => v.html).map((v) => ({ ...v }));
    const currentV = entry.currentV ?? entry.versionCount;
    const synthetic = {
      sessionId: entry.sessionId,
      source: entry.source,
      sourceInput: {},
      versions,
      currentV,
      status: entry.status || 'done',
      phase: 'done',
      // Restore the persisted activity-log tail (P2#8) so a reload/post-restart
      // reopen still shows the run's reasoning, not a blank log.
      messages: Array.isArray(entry.messagesTail) ? entry.messagesTail.map((m) => ({ ...m })) : [],
      shipped: entry.shipped || {},
      // Restore the cached match-report summary so the conversion report renders
      // immediately; a live re-poll (or ensureMatchReport) refreshes it if the
      // server still has the session.
      matchReport: entry.matchReportSummary || null,
      lastSummary: versions.find((v) => v.v === currentV)?.summary || null,
      createdAt: entry.ts,
    };
    state.sessions.set(entry.sessionId, synthetic);
    setActiveSession(entry.sessionId);
    renderActiveSession();
    renderSidebar();
    startPolling(); // re-hydrate from server (may 404 if server restarted; that's fine, sidebar still works)
  }
}

// ── In-app confirm dialog ─────────────────────────────────────────────────────

function showConfirm(message, onConfirm) {
  // Prevent stacking — discard any existing confirm before showing a new one.
  dom.modalRoot.querySelector('.pf-confirm-backdrop')?.remove();
  const close = () => dom.modalRoot.querySelector('.pf-confirm-backdrop')?.remove();
  const backdrop = el('div', { class: 'pf-modal-backdrop pf-confirm-backdrop',
    onclick: (e) => { if (e.target === e.currentTarget) close(); } });
  const card = el('div', { class: 'pf-modal-card' },
    el('p', { class: 'pf-modal-sub' }, message),
    el('div', { class: 'pf-form-actions' },
      el('button', { class: 'pf-secondary', onclick: close }, 'Cancel'),
      el('button', { class: 'pf-primary', onclick: () => { close(); onConfirm(); } }, 'Continue'),
    ),
  );
  backdrop.append(card);
  dom.modalRoot.append(backdrop);
}

// ── Modals ───────────────────────────────────────────────────────────────────

function renderModal() {
  clear(dom.modalRoot);
  if (state.ui.settingsOpen) {
    dom.modalRoot.append(buildSettingsSlideover());
    return;
  }
  if (state.ui.modal === 'deploy-prototype') {
    dom.modalRoot.append(buildDeployPrototypeModal());
    return;
  }
  if (state.ui.modal === 'ship') {
    dom.modalRoot.append(buildShipModal());
    return;
  }
}

function closeModal() {
  state.ui.modal = null;
  state.ui.settingsOpen = false;
  renderModal();
}

function buildBackdrop(onClick) {
  return el('div', { class: 'pf-modal-backdrop', onclick: (e) => { if (e.target === e.currentTarget) onClick(); } });
}

// Per-export "Override for this export" expandable. Pre-filled from the saved
// state.config.export defaults; the user can tweak just for this run without
// touching the defaults. Returns { element, read } — `read()` returns the
// current values, or null if the user didn't expand the panel (caller should
// fall back to state.config.export server-side).
function buildExportOverridePanel(defaults = {}) {
  const d = {
    shipTarget: defaults.shipTarget || state.config.export?.shipTarget || 'auto',
    sendBlocksToMilo: defaults.sendBlocksToMilo ?? state.config.export?.sendBlocksToMilo ?? true,
    pushMiloBranch: defaults.pushMiloBranch ?? state.config.export?.pushMiloBranch ?? false,
  };
  function radioRow(name, value, label, checked) {
    const r = el('input', { type: 'radio', name, value });
    if (checked) r.checked = true;
    return el('label', { class: 'pf-radio' }, r, el('span', {}, label));
  }
  const tAuto  = radioRow('pf-deploy-ship-target', 'auto',  'Auto (DA when token set, else local)',  d.shipTarget === 'auto');
  const tDa    = radioRow('pf-deploy-ship-target', 'da',    'DA upload',                              d.shipTarget === 'da');
  const tLocal = radioRow('pf-deploy-ship-target', 'local', 'Local (consumer/content/, ?milolibs=local)', d.shipTarget === 'local');
  const sendBlocksCb = el('input', { type: 'checkbox' }); sendBlocksCb.checked = d.sendBlocksToMilo;
  const pushMiloCb = el('input', { type: 'checkbox' }); pushMiloCb.checked = d.pushMiloBranch;

  const details = el('details', { class: 'pf-export-override' },
    el('summary', { class: 'pf-export-override-summary' }, 'Override export options for this run'),
    el('div', { class: 'pf-help', style: { marginTop: '8px' } },
      'Defaults come from Settings → Export defaults. Changes here apply only to this export.'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Ship target'),
      el('div', { class: 'pf-radio-group' }, tAuto, tDa, tLocal),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-checkbox' }, sendBlocksCb, el('span', {}, 'Send generated forge-* blocks to Milo')),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-checkbox' }, pushMiloCb, el('span', {}, 'Push the Milo session branch to origin (adobecom/milo)')),
    ),
  );

  function read() {
    const target = [tAuto, tDa, tLocal].map((r) => r.querySelector('input')).find((i) => i.checked);
    return {
      shipTarget: target ? target.value : d.shipTarget,
      sendBlocksToMilo: sendBlocksCb.checked,
      pushMiloBranch: pushMiloCb.checked,
    };
  }
  return { element: details, read };
}

function buildDeployPrototypeModal() {
  const s = state.sessions.get(state.activeSessionId);
  if (!s) return el('div');
  const viewedV = state.ui.viewedV ?? s.currentV;
  // Pick a sensible slug seed: prefer the user's intent (a human phrase); for
  // URL sources, use the URL's last path segment rather than the whole URL —
  // kebabizing a full URL yields garbage like `https-main-da-playground-…`.
  let slugSeed = s.versions[0]?.intent;
  if (!slugSeed && s.sourceInput?.url) {
    try {
      const u = new URL(s.sourceInput.url);
      const tail = u.pathname.split('/').filter(Boolean).pop();
      slugSeed = tail || u.hostname.split('.')[0] || 'page';
    } catch { slugSeed = 'page'; }
  }
  if (!slugSeed && s.sourceInput?.figmaUrl) slugSeed = 'figma';
  const defaultSlug = kebab(slugSeed || 'untitled') + '-' + s.sessionId.replace(/-/g, '').slice(0, 6);
  const slugInput = el('input', { type: 'text', class: 'pf-input', value: defaultSlug });
  const errorEl = el('div', { class: 'pf-form-error', hidden: true });
  // URL pattern: snowflake skill publishes to DA at /drafts/<username>/snowflake/<slug>
  // on a fresh forge-* branch. Preview hostname is .aem.page (not
  // .aem.live — proto flow does not publish).
  const ctx = state.da.context || {};
  const org = ctx.org || ctx.owner || '<org>';
  const site = ctx.repo || ctx.site || '<repo>';
  const deployUser = state.config.daUsername || state.da.username || ctx.username || '<username>';
  const urlFor = (slugVal) => {
    const path = prototypeDaPath(deployUser, slugVal || defaultSlug);
    return `https://forge-*--${site}--${org}.aem.page${path}`;
  };
  const urlPreview = el('div', { class: 'pf-help pf-modal-url' }, urlFor(defaultSlug));
  slugInput.addEventListener('input', () => {
    urlPreview.textContent = urlFor(slugInput.value);
  });

  // Output mode (Milo repos): 'blocks' = editable forge-* block tables (default,
  // 1:1 + live chrome + authorable), 'overlay' = legacy 1:1 frozen snapshot.
  let selectedMode = 'blocks';
  const modeOptions = [
    ['blocks', 'Editable blocks (recommended)', 'Each section becomes an editable DA block table — rendered 1:1, with the live Milo nav/footer. Authors & designers can edit the content.'],
    ['overlay', 'Frozen overlay', 'A 1:1 snapshot of the design. Faithful, but the body is not editable in DA.'],
  ].map(([val, title, desc]) => {
    const input = el('input', {
      type: 'radio', name: 'pf-deploy-mode', value: val, checked: val === selectedMode,
      style: { marginRight: '8px', marginTop: '3px' },
      onchange: () => { if (input.checked) selectedMode = val; },
    });
    return el('label', {
      style: { display: 'flex', alignItems: 'flex-start', gap: '4px', margin: '6px 0', cursor: 'pointer' },
    }, input, el('span', {}, el('strong', {}, title), el('div', { class: 'pf-help' }, desc)));
  });
  const modeField = el('div', { class: 'pf-field' },
    el('label', { class: 'pf-label' }, 'Output'),
    modeOptions,
  );

  // Animations (block mode only): tasteful default reveal | preserve source motion | off.
  // Emitted as adjustable --pa-* sidecar blocks the page-animator panel can tweak.
  let selectedAnimations = 'default';
  const animSelect = el('select', {
    class: 'pf-input',
    onchange: () => { selectedAnimations = animSelect.value; },
  },
    el('option', { value: 'default' }, 'Tasteful default reveal'),
    el('option', { value: 'preserve' }, 'Preserve source motion'),
    el('option', { value: 'off' }, 'No animations'),
  );
  const animField = el('div', { class: 'pf-field' },
    el('label', { class: 'pf-label' }, 'Animations'),
    animSelect,
    el('div', { class: 'pf-help' }, 'Block mode only. Emitted as adjustable --pa-* sidecars you can tune in the sidekick Animator.'),
  );
  // Animations only apply to the editable-blocks path; hide for the frozen overlay.
  const syncAnimVisibility = () => { animField.hidden = selectedMode !== 'blocks'; };
  modeOptions.forEach((label) => label.querySelector('input')
    .addEventListener('change', syncAnimVisibility));

  const exportOverride = buildExportOverridePanel();

  const deployBtn = el('button', {
    class: 'pf-primary',
    onclick: async () => {
      errorEl.hidden = true;
      const overrides = exportOverride.read();
      // Only the local ship target writes to a consumer repo on disk; the DA
      // target ships purely via the DA admin API, so a deployed user (no local
      // checkout) must not be blocked on repoPath.
      if (overrides.shipTarget === 'local' && !state.config.repoPath) {
        errorEl.textContent = 'Local ship target needs a consumer site repo path. Open Settings (⚙) and set the consumer site repo path.';
        errorEl.hidden = false;
        return;
      }
      // Only DA target needs DA_SDK context/token.
      if (overrides.shipTarget !== 'local') {
        if (!state.da.token || !state.da.context) {
          errorEl.textContent = 'DA context/token not available yet. Open the app from DA so DA_SDK injects them, or switch ship target to Local.';
          errorEl.hidden = false;
          return;
        }
      }
      if (overrides.shipTarget !== 'local' && !state.config.consumerPreviewUrl) {
        // Not strictly required for DA target, but warn — the preview-link panel uses it.
      }
      if (overrides.shipTarget === 'local' && !state.config.consumerPreviewUrl) {
        errorEl.textContent = 'Local ship target needs a Consumer preview URL. Open Settings (⚙) and set it (e.g. http://localhost:3000).';
        errorEl.hidden = false;
        return;
      }
      const deployUser = state.config.daUsername || state.da.username || state.da.context?.username;
      if (overrides.shipTarget !== 'local' && (!deployUser || deployUser === 'anonymous')) {
        errorEl.textContent = 'DA username not set. Open Settings (⚙) and set your DA username (LDAP) — DA_SDK does not provide it automatically.';
        errorEl.hidden = false;
        return;
      }
      deployBtn.disabled = true; deployBtn.textContent = 'Deploying…';
      try {
        const sessionId = await ensureServerSession(s);
        await api.deployPrototype(sessionId, {
          slug: slugInput.value.trim() || defaultSlug,
          username: deployUser,
          mode: selectedMode,
          animations: selectedMode === 'blocks' ? selectedAnimations : undefined,
          exportOpts: overrides,
        });
        markRunStart(sessionId);
        closeModal();
        startPolling();
        toast(selectedMode === 'blocks'
          ? 'Deploying as editable blocks — Forge ship agent runs ~3–6 min. Status strip shows progress.'
          : 'Deploying overlay — Forge ship agent runs ~2–4 min. Status strip shows progress.');
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        deployBtn.disabled = false; deployBtn.textContent = 'Deploy';
      }
    },
  }, 'Deploy');

  const card = el('div', { class: 'pf-modal-card' },
    el('h3', { class: 'pf-modal-title' }, 'Deploy v', String(viewedV), ' as prototype'),
    el('p', { class: 'pf-modal-sub' }, 'Runs the snowflake skill on the bespoke HTML on a new forge-* branch and uploads a DA page at /drafts/<you>/snowflake/<slug>. 1:1 visual match, shareable URL. Choose whether the body is editable block tables or a frozen overlay.'),
    modeField,
    animField,
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Slug'),
      slugInput,
      urlPreview,
    ),
    exportOverride.element,
    errorEl,
    el('div', { class: 'pf-form-actions' },
      el('button', { class: 'pf-secondary', onclick: closeModal }, 'Cancel'),
      deployBtn,
    ),
  );
  const backdrop = buildBackdrop(closeModal);
  backdrop.append(card);
  return backdrop;
}

function buildShipModal() {
  const s = state.sessions.get(state.activeSessionId);
  if (!s) return el('div');
  const viewedV = state.ui.viewedV ?? s.currentV;
  const errorEl = el('div', { class: 'pf-form-error', hidden: true });
  const exportOverride = buildExportOverridePanel();
  const shipBtn = el('button', {
    class: 'pf-primary',
    onclick: async () => {
      errorEl.hidden = true;
      if (!state.config.repoPath) {
        errorEl.textContent = 'Consumer site repo path is not configured. Open Settings (⚙) and set the consumer site repo path.';
        errorEl.hidden = false;
        return;
      }
      const overrides = exportOverride.read();
      if (overrides.shipTarget === 'local' && !state.config.consumerPreviewUrl) {
        errorEl.textContent = 'Local ship target needs a Consumer preview URL. Open Settings (⚙) and set it (e.g. http://localhost:3000).';
        errorEl.hidden = false;
        return;
      }
      shipBtn.disabled = true; shipBtn.textContent = 'Shipping…';
      try {
        const sessionId = await ensureServerSession(s);
        await api.ship(sessionId, { exportOpts: overrides });
        markRunStart(sessionId);
        closeModal();
        startPolling();
        toast('Shipping — this takes 2–5 minutes. Status strip shows progress.');
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
        shipBtn.disabled = false; shipBtn.textContent = 'Ship';
      }
    },
  }, 'Ship');

  const card = el('div', { class: 'pf-modal-card' },
    el('h3', { class: 'pf-modal-title' }, 'Ship v', String(viewedV), ' as editable blocks'),
    el('p', { class: 'pf-modal-sub' }, 'Runs deterministic block-aware conversion: each section becomes an authorable DA block (real Milo blocks where labeled, otherwise bespoke forge-* blocks carrying the section\'s own CSS so it looks as designed). Creates a GitHub branch under your name and pushes a DA draft. ~1 minute.'),
    exportOverride.element,
    errorEl,
    el('div', { class: 'pf-form-actions' },
      el('button', { class: 'pf-secondary', onclick: closeModal }, 'Cancel'),
      shipBtn,
    ),
  );
  const backdrop = buildBackdrop(closeModal);
  backdrop.append(card);
  return backdrop;
}

function buildSettingsSlideover() {
  const cfg = state.config;
  const serverInput = el('input', { type: 'text', class: 'pf-input', value: cfg.serverUrl });
  const repoInput = el('input', { type: 'text', class: 'pf-input', value: cfg.repoPath, placeholder: '/Users/you/path/to/your-consumer-site' });
  const previewUrlInput = el('input', { type: 'text', class: 'pf-input', value: cfg.consumerPreviewUrl, placeholder: 'http://localhost:3000' });
  const miloInput = el('input', { type: 'text', class: 'pf-input', value: cfg.miloPath, placeholder: '/Users/you/path/to/milo' });
  const daOrgInput = el('input', { type: 'text', class: 'pf-input', value: cfg.daOrg, placeholder: 'adobecom' });
  const daRepoInput = el('input', { type: 'text', class: 'pf-input', value: cfg.daRepo, placeholder: 'da-playground' });
  const daTokenInput = el('input', { type: 'password', class: 'pf-input', value: cfg.daToken, placeholder: '••••••••' });
  const daUsernameInput = el('input', { type: 'text', class: 'pf-input', value: cfg.daUsername, placeholder: 'your-ldap (e.g. jdoe)' });
  const figmaInput = el('input', { type: 'password', class: 'pf-input', value: cfg.figmaToken, placeholder: 'Figma personal access token (optional)' });
  const skillInput = el('input', { type: 'text', class: 'pf-input', value: cfg.snowflakeSkillPath, placeholder: '/Users/you/path/to/skills/plugins/aem/edge-delivery-services/skills/snowflake' });
  const stardustInput = el('input', { type: 'text', class: 'pf-input', value: cfg.stardustSkillPath, placeholder: '/Users/you/path/to/skills/plugins/stardust' });
  const impeccableInput = el('input', { type: 'text', class: 'pf-input', value: cfg.impeccableSkillPath, placeholder: '/Users/you/path/to/impeccable' });

  // Export defaults — radio for shipTarget, two checkboxes.
  const shipTargetVal = cfg.export?.shipTarget || 'auto';
  function radioRow(name, value, label, checked) {
    const r = el('input', { type: 'radio', name, value });
    if (checked) r.checked = true;
    return el('label', { class: 'pf-radio' }, r, el('span', {}, label));
  }
  const shipTargetAuto  = radioRow('pf-ship-target', 'auto',  'Auto (DA when token set, else local)', shipTargetVal === 'auto');
  const shipTargetDa    = radioRow('pf-ship-target', 'da',    'DA upload (admin.da.live)',            shipTargetVal === 'da');
  const shipTargetLocal = radioRow('pf-ship-target', 'local', 'Local (write to consumer/content/, preview via ?milolibs=local)', shipTargetVal === 'local');
  const sendBlocksCb = el('input', { type: 'checkbox' });
  sendBlocksCb.checked = cfg.export?.sendBlocksToMilo !== false;
  const pushMiloCb = el('input', { type: 'checkbox' });
  pushMiloCb.checked = !!cfg.export?.pushMiloBranch;

  function readShipTarget() {
    const checked = [shipTargetAuto, shipTargetDa, shipTargetLocal]
      .map((row) => row.querySelector('input'))
      .find((i) => i.checked);
    return checked ? checked.value : 'auto';
  }

  const card = el('div', { class: 'pf-slideover' },
    el('div', { class: 'pf-slideover-head' },
      el('h3', { class: 'pf-modal-title' }, 'Settings'),
      el('button', { class: 'pf-iconbtn', onclick: closeModal }, '✕'),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Server URL'),
      serverInput,
      el('div', { class: 'pf-help' }, 'Where the page-forge server is running. Default: http://localhost:3002'),
    ),

    el('h4', { class: 'pf-section-title' }, 'Consumer site'),
    el('div', { class: 'pf-help pf-section-intro' }, 'The adobecom Milo consumer this tool will ship to (any consumer running on AEM EDS + Milo — da-playground, cc-shared, your-site, etc.). Required for Ship and Deploy as Prototype.'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Consumer site repo path'),
      repoInput,
      el('div', { class: 'pf-help' }, 'Local clone of your consumer site (e.g. adobecom/da-playground). The snowflake worktree lands at <repo>/.forge-worktrees/session-<id>/ — add .forge-worktrees/ to that repo\'s .git/info/exclude or .gitignore.'),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Consumer preview URL'),
      previewUrlInput,
      el('div', { class: 'pf-help' }, 'Where your consumer\'s local dev server is reachable, e.g. http://localhost:3000 for `aem up` on da-playground. Used to build the preview URL `<host>/<slug>?milolibs=local` after Ship/Deploy.'),
    ),

    el('h4', { class: 'pf-section-title' }, 'Milo (blocks destination)'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Milo path'),
      miloInput,
      el('div', { class: 'pf-help' }, 'Local clone of adobecom/milo. Required when "send blocks to Milo" is on — generated forge-* blocks land at <milo>/.forge-worktrees/session-<id>/libs/c2/blocks/ and the matching milolibs server (`npm run libs` from this clone) serves them when the consumer is opened with ?milolibs=local.'),
    ),

    el('h4', { class: 'pf-section-title' }, 'DA upload'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'DA org'),
      daOrgInput,
      el('div', { class: 'pf-help' }, 'Your DA organization (e.g. adobecom). Used by admin.da.live uploads.'),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'DA site/repo'),
      daRepoInput,
      el('div', { class: 'pf-help' }, 'Your DA site/repo (typically matches the consumer repo name, e.g. da-playground).'),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'DA token'),
      daTokenInput,
      el('div', { class: 'pf-help' }, 'Bearer token for admin.da.live. Required when ship target is "DA upload".'),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'DA username (LDAP)'),
      daUsernameInput,
      el('div', { class: 'pf-help' }, 'Required for "Deploy as Prototype". Sets the prototype folder: /drafts/<username>/snowflake/<slug>. DA_SDK does not expose your LDAP, so set it here.'),
    ),

    el('h4', { class: 'pf-section-title' }, 'Export defaults'),
    el('div', { class: 'pf-help pf-section-intro' }, 'Defaults applied to every Ship / Deploy as Prototype. The Deploy confirm step lets you override these per-export.'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Ship target'),
      el('div', { class: 'pf-radio-group' }, shipTargetAuto, shipTargetDa, shipTargetLocal),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-checkbox' }, sendBlocksCb, el('span', {}, 'Send generated forge-* blocks to Milo')),
      el('div', { class: 'pf-help' }, 'When on (and Milo path is set), forge-* blocks are copied into <milo>/.forge-worktrees/session-<id>/libs/c2/blocks/ and registered in C2_BLOCKS. Off = blocks stay in the consumer worktree only.'),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label pf-checkbox' }, pushMiloCb, el('span', {}, 'Push the Milo session branch to origin (adobecom/milo)')),
      el('div', { class: 'pf-help' }, 'Off by default — local branch only. Turn on to push the per-session branch (forge/session-<id>) to your Milo remote (mirrors FORGE_MILO_PUSH=1).'),
    ),

    el('h4', { class: 'pf-section-title' }, 'Skill paths (optional)'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Snowflake skill path'),
      skillInput,
      el('div', { class: 'pf-help' }, `Optional. Leave blank and page-forge auto-provisions the pinned snowflake version (branch ${EXPECTED_SKILLS_BRANCH} — feedback-improvements + Milo flavor, PR #166). Set this only to override with your own adobe/skills clone (…/plugins/aem/edge-delivery-services/skills/snowflake); the server warns in the activity log if that clone is on a different branch.`),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Stardust skill path'),
      stardustInput,
      el('div', { class: 'pf-help' }, `Optional. Leave blank and page-forge auto-provisions stardust from the same pinned checkout as snowflake (branch ${EXPECTED_SKILLS_BRANCH}). Set this only to override with the plugins/stardust folder of your own adobe/skills clone. Falls back to STARDUST_SKILL_PATH env var.`),
    ),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Impeccable skill path'),
      impeccableInput,
      el('div', { class: 'pf-help' }, 'Optional. Auto-provisioned alongside stardust (its hard dependency). Set this only to override with your own pbakaus/impeccable clone. Falls back to IMPECCABLE_SKILL_PATH env var.'),
    ),

    el('h4', { class: 'pf-section-title' }, 'Secrets'),
    el('div', { class: 'pf-field' },
      el('label', { class: 'pf-label' }, 'Figma token'),
      figmaInput,
      el('div', { class: 'pf-help' }, 'Optional. Used to download Figma image assets at full resolution. Falls back to the server\'s FIGMA_TOKEN env var.'),
    ),

    el('div', { class: 'pf-form-actions' },
      el('button', { class: 'pf-primary', onclick: () => {
        state.config.serverUrl = serverInput.value.trim() || DEFAULT_SERVER_URL;
        state.config.repoPath = repoInput.value.trim();
        state.config.consumerPreviewUrl = previewUrlInput.value.trim();
        state.config.miloPath = miloInput.value.trim();
        state.config.daOrg = daOrgInput.value.trim();
        state.config.daRepo = daRepoInput.value.trim();
        state.config.daToken = daTokenInput.value.trim();
        state.config.daUsername = daUsernameInput.value.trim();
        state.config.figmaToken = figmaInput.value.trim();
        state.config.snowflakeSkillPath = skillInput.value.trim();
        state.config.stardustSkillPath = stardustInput.value.trim();
        state.config.impeccableSkillPath = impeccableInput.value.trim();
        state.config.export = {
          shipTarget: readShipTarget(),
          sendBlocksToMilo: sendBlocksCb.checked,
          pushMiloBranch: pushMiloCb.checked,
        };
        saveForgeConfig(state.config);
        closeModal();
        toast('Settings saved');
      } }, 'Save'),
    ),
  );
  const backdrop = buildBackdrop(closeModal);
  backdrop.append(card);
  return backdrop;
}

function toast(text, ms = 3000) {
  dom.toast.textContent = text;
  dom.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { dom.toast.hidden = true; }, ms);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

// Re-read DA_SDK's current context/token into state. Safe to call any time —
// DA_SDK is a singleton thenable; the first await runs the IMS handshake, and
// subsequent awaits resolve cheaply with whatever DA's session lib considers
// current. Failures are swallowed so a transient SDK hiccup doesn't take
// down a deploy click.
async function refreshDaSdk() {
  try {
    const { context, token } = await DA_SDK;
    if (context) state.da.context = context;
    if (token) state.da.token = token;
  } catch (err) {
    console.warn('DA_SDK refresh failed', err);
  }
}

(async function boot() {
  try {
    const { context, token } = await DA_SDK;
    state.da.context = context;
    state.da.token = token;
    // DA_SDK does not expose the signed-in user's LDAP: `context` carries only
    // org/repo/ref/path, and the token is stored raw (no decode, no accessor).
    // So this is almost always null — the real source is the DA username in
    // Settings (state.config.daUsername). Kept as a graceful upgrade path in
    // case DA ever adds the field to context.
    state.da.username = context?.username || null;
  } catch (err) {
    console.warn('DA_SDK init failed', err);
  }

  state.history = loadHistory();
  buildShell();
  renderTopBar();

  // Status strip ticks every second so elapsed time updates even when polling is slow.
  setInterval(() => { if (state.activeSessionId) renderStatusStrip(); }, 1000);

  // Escape closes any open modal / settings slideover.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (state.ui.modal || state.ui.settingsOpen)) closeModal();
  });

  // Restore last active session from localStorage if present and still recent.
  const lastActive = localStorage.getItem(STORAGE_KEY_ACTIVE);
  if (lastActive) {
    const entry = state.history.find((e) => e.sessionId === lastActive);
    if (entry) {
      loadHistoryEntry(entry);
      return;
    }
  }
  renderWorkArea();
})();
