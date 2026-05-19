/*
 * Figma → DA Agent Server  (multi-agent pipeline)
 *
 * Setup (Anthropic API key):
 *   ANTHROPIC_API_KEY=sk-...  REPO_PATH=/path/to/da-playground  npm start
 *
 * Setup (AWS Bedrock):
 *   AWS_BEARER_TOKEN_BEDROCK=...  AWS_REGION=us-west-2  \
 *   BEDROCK_MODEL_SMART=us.anthropic.claude-sonnet-4-6   \
 *   REPO_PATH=/path/to/da-playground  npm start
 *
 * Pipeline (DA mode):
 *   0. Analyze agent   — reads Figma, maps sections to Milo blocks or marks NEW
 *   1. PARALLEL:
 *      a. Block builders  — one agent per NEW block, run concurrently
 *      b. Extract agent   — reads each section from Figma, outputs structured JSON
 *   2. Assemble agent  — builds DA HTML from extracted JSON, uploads media + page
 *   3. (within Assemble) Preview + publish
 *
 * Job schema: { status, stage: 0–3, workers?: { 'build-blocks', 'extract' }, messages, ... }
 *
 * Endpoints:
 *   POST /jobs  { figmaUrl, daContext }  → 202 { jobId }
 *   GET  /jobs/:id                       → { status, stage, workers?, previewUrl?, error? }
 *   GET  /snowflake/:file                → static HTML files from SNOWFLAKE_PATH
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename, extname, resolve, sep } from 'path';
import { fileURLToPath } from 'url';
import { query, SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '@anthropic-ai/claude-agent-sdk';

const execFileP = promisify(execFile);
const git = (...args) => execFileP('git', ['-C', REPO_PATH, ...args], { timeout: 15_000 });

const PORT = process.env.PORT || 3001;
const REPO_PATH = process.env.REPO_PATH;

if (!REPO_PATH) {
  console.error('ERROR: Set REPO_PATH env var to the da-playground repo root.');
  process.exit(1);
}

const BLOCKS_PATH = join(REPO_PATH, 'blocks');
const SNOWFLAKE_PATH = join(REPO_PATH, 'snowflake-pages');

if (process.env.AWS_BEARER_TOKEN_BEDROCK) {
  process.env.CLAUDE_CODE_USE_BEDROCK = '1';
  console.log(`Using Bedrock in ${process.env.AWS_REGION || 'us-east-1'}`);
} else {
  console.log('Using Claude Code built-in auth');
}

const SKILL_BASE = join(REPO_PATH, '.claude/skills/build-content-from-figma');
const REF_BASE = join(REPO_PATH, 'tools/figma-to-da/server/references');

const pipelineRefs = {
  blockCreation: readFileSync(join(REF_BASE, 'c1-block-creation.md'), 'utf8'),
  authoringPattern: readFileSync(join(REF_BASE, 'c1-authoring-pattern.md'), 'utf8'),
};
const legacyRefs = {
  tokenMapping: readFileSync(join(SKILL_BASE, 'references/token-mapping.md'), 'utf8'),
  extractor: readFileSync(join(SKILL_BASE, 'agents/figma-content-extractor.md'), 'utf8'),
};
console.log('Pipeline reference files loaded from', REF_BASE);

// ── Block library (JSON) ──────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadBlockLibrary() {
  const dir = join(__dirname, 'library/blocks');
  const library = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const entry = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    library.set(entry.id, entry);
  }
  return library;
}
const blockLibrary = loadBlockLibrary();
console.log(`Block library loaded: ${blockLibrary.size} blocks`);

// ── Catalog extras (from block-knowledge-base skill) ──────────────────────────
//
// Augments the JSON library with per-block "When to use" + "Anti-patterns" prose
// extracted from the markdown catalog at
// `.claude/skills/block-knowledge-base/catalog/<name>.md`. Also exposes the C2
// blocks the JSON library doesn't cover, so the analyze agent at least knows
// they exist.

function loadCatalog() {
  const catalogDir = join(REPO_PATH, '.claude/skills/block-knowledge-base/catalog');
  const manifestPath = join(catalogDir, 'blocks.json');
  let manifest = { blocks: [] };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.warn(`Block knowledge base not found at ${manifestPath}; skipping catalog enrichment.`);
    return { byName: new Map(), prose: new Map() };
  }
  const byName = new Map(manifest.blocks.map((b) => [b.name, b]));
  const prose = new Map();
  for (const name of byName.keys()) {
    try {
      const text = readFileSync(join(catalogDir, `${name}.md`), 'utf8');
      const grab = (heading) => {
        const re = new RegExp(`## ${heading}\\n\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`);
        return text.match(re)?.[1].trim();
      };
      prose.set(name, {
        whenToUse: grab('When to use'),
        antiPatterns: grab('Anti-patterns'),
      });
    } catch { /* missing file is fine; manifest is the source of truth */ }
  }
  return { byName, prose };
}
const catalog = loadCatalog();
const catalogExtraCount = [...catalog.byName.values()].filter((b) => !blockLibrary.has(b.name) && b.status === 'active').length;
console.log(`Catalog loaded: ${catalog.byName.size} entries (${catalogExtraCount} new to this pipeline)`);

function buildCatalogExtrasSection() {
  // Per-block enrichment for blocks both sources know about.
  const known = [...blockLibrary.keys()];
  return known.map((id) => {
    const p = catalog.prose.get(id);
    if (!p || (!p.whenToUse && !p.antiPatterns)) return null;
    return [
      `### ${id} — extra context`,
      p.whenToUse ? `**When to use:**\n${p.whenToUse}` : '',
      p.antiPatterns ? `**Anti-patterns:**\n${p.antiPatterns}` : '',
    ].filter(Boolean).join('\n\n');
  }).filter(Boolean).join('\n\n---\n\n');
}

function buildC2AdvisorySection() {
  // Catalog blocks not in the JSON library — these are Milo C2 blocks the
  // current pipeline cannot author directly. Surface them so analyze can
  // recognize them in Figma and propose them, but mark a clear constraint.
  const advisory = [...catalog.byName.values()]
    .filter((b) => !blockLibrary.has(b.name) && b.status === 'active');
  if (!advisory.length) return '';
  const entries = advisory.map((b) => {
    const variantList = Object.entries(b.variants || {})
      .flatMap(([, vs]) => vs).filter(Boolean).join(', ') || '(none)';
    return [
      `### ${b.name} (${b.generation})`,
      `**Purpose:** ${b.purpose}`,
      `**Variants:** ${variantList}`,
    ].join('\n');
  }).join('\n\n---\n\n');
  return [
    'The following Milo blocks exist in the C2 design system but this pipeline does not yet author them automatically. **Only propose one of these blocks** if it is clearly a better fit than every C1 block above; if you do, name the section with `"NEW: <kebab-name>"` for now (downstream pipeline integration to author C2 blocks is pending).',
    entries,
  ].join('\n\n');
}

function buildBlockInventorySection() {
  return [...blockLibrary.values()].map((b) => [
    `### ${b.id}`,
    `**Use when:** ${b.description}`,
    `**Visual signals:** ${b.visualSignals}`,
    `**Variants:** ${b.variants.length ? b.variants.join(', ') : '(none)'}`,
  ].join('\n')).join('\n\n---\n\n');
}

function buildDomInputRef() {
  return [...blockLibrary.values()].map((b) => {
    const d = b.domInput;
    const contentRow = d.rows.find((r) => r.kind === 'content' || r.kind === 'item' || r.kind === 'tab-labels');
    const colLines = contentRow?.cols?.map((c) =>
      `  Col ${c.index}${c.optional ? ' (optional)' : ''} — ${c.role}: ${c.contains}`,
    ) ?? [];
    const optionalLines = d.optionalRows?.map((r) =>
      `  Optional ${r.kind} row: ${r.shape || r.note || ''}`,
    ) ?? [];
    return [
      `### ${b.id} — DA table`,
      `Name row: \`${d.tableNamePattern}\``,
      ...colLines,
      ...optionalLines,
      d.notes ? `Note: ${d.notes}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

// ── Cached system prompt prefixes (built once at startup) ─────────────────────

const MILO_INVENTORY_HEADER = `These blocks are provided by Milo and are available on any page without creating new block files. Use a Milo block when it genuinely matches the visual pattern. Create a new custom block freely when no Milo block is a good fit.`;

const CATALOG_EXTRAS_SECTION = buildCatalogExtrasSection();
const C2_ADVISORY_SECTION = buildC2AdvisorySection();

const CACHED_PREFIX_ANALYZE = [
  '## Milo Block Inventory',
  MILO_INVENTORY_HEADER,
  buildBlockInventorySection(),
  CATALOG_EXTRAS_SECTION ? '## Block Knowledge Base — extras' : '',
  CATALOG_EXTRAS_SECTION ? 'Authoritative "When to use" and "Anti-patterns" guidance per block, sourced from the block-knowledge-base catalog. Use these to reduce false matches and to choose between visually similar blocks.' : '',
  CATALOG_EXTRAS_SECTION,
  C2_ADVISORY_SECTION ? '## C2 Blocks (advisory — not auto-authorable yet)' : '',
  C2_ADVISORY_SECTION,
].filter(Boolean).join('\n\n');

const CACHED_PREFIX_BLOCK_BUILDER = pipelineRefs.blockCreation;

// Extract agent: only needs Figma-extraction knowledge (no DA authoring refs)
const CACHED_PREFIX_EXTRACT = [
  '## Figma Content Extractor',
  legacyRefs.extractor,
  '## Token Mapping',
  legacyRefs.tokenMapping,
  '## Milo Block Inventory (for context)',
  MILO_INVENTORY_HEADER,
  buildBlockInventorySection(),
].filter(Boolean).join('\n\n');

// Assemble agent: knows DA authoring but does not call Figma tools
const CACHED_PREFIX_ASSEMBLE = [
  '## Milo Block Inventory',
  MILO_INVENTORY_HEADER,
  buildBlockInventorySection(),
  CATALOG_EXTRAS_SECTION ? '## Block Knowledge Base — extras' : '',
  CATALOG_EXTRAS_SECTION,
  '## DA Table Format Reference',
  'Authoritative column/row structure for each Milo block. Use these exact formats when building the DA HTML document.',
  buildDomInputRef(),
  '## Authoring Pattern',
  pipelineRefs.authoringPattern,
  '## Token Mapping',
  legacyRefs.tokenMapping,
].filter(Boolean).join('\n\n');

const FIGMA_TOKEN = process.env.FIGMA_TOKEN || '';
console.log('Figma REST API:', FIGMA_TOKEN ? 'enabled (FIGMA_TOKEN set)' : 'disabled (set FIGMA_TOKEN env var to enable)');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/snowflake', express.static(SNOWFLAKE_PATH));

/** @type {Map<string, { status: string, stage: number, messages: string[], previewUrl?: string, error?: string }>} */
const jobs = new Map();

function pushMsg(jobId, text) {
  const job = jobs.get(jobId);
  if (job) jobs.set(jobId, { ...job, messages: [...(job.messages ?? []), text] });
}

// ── Retry helpers ─────────────────────────────────────────────────────────────

function isRetryableError(err) {
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('503') ||
    msg.includes('529') // anthropic overloaded
  );
}

async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 2000, label = '' } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === maxAttempts) throw err;
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(`[retry] ${label} attempt ${attempt}/${maxAttempts} failed — ${err.message}. Retrying in ${delayMs}ms…`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function parseFigmaUrl(figmaUrl) {
  const fileMatch = figmaUrl.match(/figma\.com\/(?:design|file)\/([^/?#]+)/);
  const nodeMatch = figmaUrl.match(/node-id=([^&]+)/);
  let figmaNodeId = nodeMatch ? decodeURIComponent(nodeMatch[1]) : '';
  // Figma URLs encode node IDs as "123-456"; normalize to colon format "123:456"
  if (figmaNodeId && !figmaNodeId.includes(':')) {
    figmaNodeId = figmaNodeId.replace(/^(\d+)-(\d+)$/, '$1:$2');
  }
  return {
    figmaFileKey: fileMatch ? fileMatch[1] : '',
    figmaNodeId,
  };
}

function buildFigmaAccess(figmaFileKey, figmaNodeId) {
  if (FIGMA_TOKEN) {
    return `### Figma access — REST API (preferred)

A Figma personal access token is available. Use the REST API to extract design content:

  # Get file metadata and top-level frames
  curl -s "https://api.figma.com/v1/files/${figmaFileKey}" \\
    -H "X-Figma-Token: ${FIGMA_TOKEN}" | head -c 8000

  # Get specific node content (text, fills, children)
  curl -s "https://api.figma.com/v1/files/${figmaFileKey}/nodes?ids=${figmaNodeId}" \\
    -H "X-Figma-Token: ${FIGMA_TOKEN}"

  # Export a node as image
  curl -s "https://api.figma.com/v1/images/${figmaFileKey}?ids=<nodeId>&format=png" \\
    -H "X-Figma-Token: ${FIGMA_TOKEN}"

If Figma MCP tools (get_design_context, get_metadata) are available in this session,
prefer them over the REST API for richer output.`;
  }
  return `### Figma access — MCP only

No FIGMA_TOKEN env var is set. Use Figma MCP tools (get_design_context, get_metadata,
get_screenshot). If they are not available, extract what is possible from the URL.`;
}

function buildQueryOptions(jobId, label, cachedPrefix = null) {
  const opts = {
    cwd: REPO_PATH,
    permissionMode: 'bypassPermissions',
    allowedTools: [
      'Bash', 'Read', 'Write', 'Edit', 'WebFetch',
      'mcp__plugin_figma_figma__get_design_context',
      'mcp__plugin_figma_figma__get_screenshot',
      'mcp__plugin_figma_figma__get_metadata',
      'mcp__plugin_figma_figma__use_figma',
    ],
    pathToClaudeCodeExecutable: process.env.CLAUDE_PATH || '/Users/cod87753/.local/bin/claude',
    stderr: (line) => {
      process.stderr.write(`[${jobId.slice(0, 8)} ${label}] ${line}`);
    },
  };
  if (cachedPrefix) opts.systemPrompt = [cachedPrefix, SYSTEM_PROMPT_DYNAMIC_BOUNDARY];
  if (process.env.BEDROCK_MODEL_SMART) opts.model = process.env.BEDROCK_MODEL_SMART;
  return opts;
}

function extractUsage(msg) {
  return {
    inputTokens: msg.usage?.input_tokens ?? 0,
    outputTokens: msg.usage?.output_tokens ?? 0,
    cacheReadTokens: msg.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: msg.usage?.cache_creation_input_tokens ?? 0,
    costUsd: msg.total_cost_usd ?? 0,
    durationMs: msg.duration_ms ?? 0,
    numTurns: msg.num_turns ?? 0,
  };
}

function aggregateUsage(usageArray) {
  const valid = usageArray.filter(Boolean);
  const sum = (key) => valid.reduce((acc, u) => acc + (u[key] ?? 0), 0);
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    cacheReadTokens: sum('cacheReadTokens'),
    cacheWriteTokens: sum('cacheWriteTokens'),
    costUsd: sum('costUsd'),
    durationMs: sum('durationMs'),
    numTurns: sum('numTurns'),
  };
}

// ── Analyze Agent ─────────────────────────────────────────────────────────────

function buildAnalyzePrompt(figmaUrl, figmaFileKey, figmaNodeId) {
  const figmaAccess = buildFigmaAccess(figmaFileKey, figmaNodeId);

  return `## AUTOMATED MODE — non-interactive execution

This agent runs fully automated. Skip every "STOP", "BLOCKING", and "wait for user
confirmation" gate. Do NOT create git branches or commits.

### Inputs

- Figma URL: ${figmaUrl}
- Figma file key: ${figmaFileKey}
- Figma node ID: ${figmaNodeId}

${figmaAccess}

---

## Task: Analyze the Figma Design

Read the full Figma design and produce a JSON page plan that maps each visual section
to a block assignment.

### Steps

1. Call get_design_context (or get_metadata + REST API) on the root frame:
   ${figmaUrl}

2. Examine the top-level children of the root frame — these are the horizontal
   sections/bands of the page, read top-to-bottom.

3. For each section:
   a. Identify the visual pattern: layout shape, number of columns, content types
   b. Record the section's Figma node ID (from the root frame's children list)
   c. Assign a block using the rules below

### Block assignment rules

- **Milo blocks**: Match to a Milo block when it genuinely fits the section's visual
  pattern (see the Milo Block Inventory below for all available blocks and their
  visual signals).
- **New custom blocks**: When no Milo block is a good fit, assign \`"NEW: <kebab-name>"\`
  where the name describes the section's purpose (e.g. "NEW: metric-strip",
  "NEW: app-grid", "NEW: logo-carousel").
- Do NOT force an imperfect Milo block to avoid creating a new one — a purpose-built
  custom block beats a mismatched standard block. New blocks are expected when the
  design calls for something Milo doesn't cover well.

### Deriving the page slug

From the Figma frame/file name: kebab-case, lowercase, no special characters.
Example: "Hub — A.com" → "hub-acom", "Acrobat Product Page" → "acrobat-product-page"

### Output format

After your analysis, output exactly these two lines as the LAST lines of your response
(no other text after them):

PAGE_PLAN=[{"section":"hero","block":"marquee","variants":["large"],"nodeId":"123:456"},{"section":"metrics","block":"NEW: metric-strip","variants":[],"nodeId":"789:012"}]
SLUG=page-slug-here

Each entry in PAGE_PLAN must have:
- "section": human-readable name of the section
- "block": Milo block name (e.g. "marquee", "accordion") OR "NEW: <kebab-name>"
- "variants": array of variant strings, empty array if none
- "nodeId": the Figma node ID for this section

---

## Reference: Milo Block Inventory

The Milo Block Inventory is in your system prompt above. Use it to match each visual section to the appropriate block.
`;
}

async function runAnalyzeAgent(jobId, figmaUrl) {
  const { figmaFileKey, figmaNodeId } = parseFigmaUrl(figmaUrl);
  const prompt = buildAnalyzePrompt(figmaUrl, figmaFileKey, figmaNodeId);
  const options = buildQueryOptions(jobId, 'analyze', CACHED_PREFIX_ANALYZE);

  let finalResult = '';
  let usage = null;

  pushMsg(jobId, 'Analyzing Figma design…');

  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'result') {
      finalResult = msg.result || '';
      usage = extractUsage(msg);
    }
  }

  const planMatch = finalResult.match(/PAGE_PLAN=(\[.*\])/s);
  const slugMatch = finalResult.match(/SLUG=(\S+)/);

  if (!planMatch) throw new Error('Analyze agent did not output a PAGE_PLAN sentinel.');
  if (!slugMatch) throw new Error('Analyze agent did not output a SLUG sentinel.');

  let plan;
  try {
    plan = JSON.parse(planMatch[1]);
  } catch (e) {
    throw new Error(`Analyze agent PAGE_PLAN is not valid JSON: ${e.message}\nRaw: ${planMatch[1].slice(0, 500)}`);
  }

  const slug = slugMatch[1];
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) {
    throw new Error(`Analyze agent returned invalid slug: "${slug}" — must be lowercase alphanumeric + hyphens`);
  }
  console.log(`[${jobId.slice(0, 8)}] analyze done — ${plan.length} sections, slug: ${slug}`);
  plan.forEach((e) => console.log(`  [${jobId.slice(0, 8)}]   ${e.section} → ${e.block}`));

  const newCount = plan.filter((e) => e.block.startsWith('NEW:')).length;
  pushMsg(jobId, `Design analyzed — ${plan.length} section(s), ${newCount} new block(s) to build`);

  return { plan, slug, usage };
}

// ── Block Builder Agent ───────────────────────────────────────────────────────

function buildBlockBuilderPrompt(entry, figmaUrl, figmaFileKey) {
  const blockName = entry.block.replace(/^NEW:\s*/, '').trim();
  const figmaAccess = buildFigmaAccess(figmaFileKey, entry.nodeId);

  return `## AUTOMATED MODE — non-interactive execution

Do NOT create git branches or commits. Use the Write tool (not bash/heredoc) for all
file writes.

### Inputs

- Block to create: ${blockName}
- Section: "${entry.section}"
- Figma URL: ${figmaUrl}
- Figma node ID for this section: ${entry.nodeId}
- REPO_PATH: ${REPO_PATH}

${figmaAccess}

---

## Task: Build a New Block

Create a Helix/Milo block named \`${blockName}\` that matches the "${entry.section}"
section in the Figma design.

### Steps

1. Call get_design_context on node ID \`${entry.nodeId}\` (or use REST API) to
   understand the section's:
   - Column structure and layout
   - Content types (text, images, icons, CTAs, etc.)
   - Visual style (colors, spacing, alignment)

2. If any blocks already exist under ${BLOCKS_PATH}, read one as structural reference.
   Otherwise, proceed directly to step 3 — the Block Creation Guide below is sufficient.
   Your new prototype block must be **self-contained** — no imports, synchronous
   \`decorate(block)\` export — following the Block Creation Guide below.

3. Create the following two files using the Write tool:
   ${BLOCKS_PATH}/${blockName}/${blockName}.js
   ${BLOCKS_PATH}/${blockName}/${blockName}.css

4. Follow the Block Creation Guide below exactly.

### Output

Your FINAL line of output must be:
BLOCK_DONE=${blockName}

---

## Reference: Block Creation Guide

The Block Creation Guide is in your system prompt above. Follow it exactly.
`;
}

async function runBlockBuilderAgent(jobId, entry, figmaUrl) {
  const { figmaFileKey } = parseFigmaUrl(figmaUrl);
  const blockName = entry.block.replace(/^NEW:\s*/, '').trim();
  const prompt = buildBlockBuilderPrompt(entry, figmaUrl, figmaFileKey);
  const options = buildQueryOptions(jobId, `block:${blockName}`, CACHED_PREFIX_BLOCK_BUILDER);

  let finalResult = '';
  let usage = null;

  pushMsg(jobId, `Building block '${blockName}'…`);

  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'result') {
      finalResult = msg.result || '';
      usage = extractUsage(msg);
    }
  }

  const doneMatch = finalResult.match(/BLOCK_DONE=(\S+)/);
  const resolvedName = doneMatch?.[1] ?? blockName;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(resolvedName)) {
    throw new Error(`Block builder returned invalid block name: "${resolvedName}" — must be lowercase alphanumeric + hyphens`);
  }

  console.log(`[${jobId.slice(0, 8)}] block-builder done — ${resolvedName}`);
  pushMsg(jobId, `Block '${resolvedName}' built`);
  return { blockName: resolvedName, originalMarker: entry.block, usage };
}

// ── Extract Agent ─────────────────────────────────────────────────────────────
// Runs in parallel with block builders. Calls Figma tools only; outputs JSON.

function buildExtractPrompt(plan, figmaUrl, figmaFileKey, figmaNodeId) {
  const figmaAccess = buildFigmaAccess(figmaFileKey, figmaNodeId);
  const planJson = JSON.stringify(plan, null, 2);

  return `## AUTOMATED MODE — non-interactive execution

Skip every "STOP" and "wait for user confirmation" gate.
Do NOT create git branches or commits. Do NOT write any files.
Use only Figma MCP tools — do not call Bash or Write.

### Inputs

- Figma URL: ${figmaUrl}
- Page plan (sections already assigned to blocks — do not re-analyze):

\`\`\`json
${planJson}
\`\`\`

${figmaAccess}

---

## Task: Extract authored content from each Figma section

For each entry in the page plan, extract the authored content by reading the Figma design.
Work through sections in plan order.

### For each section:

1. Call get_design_context on the section's \`nodeId\` from the plan.
2. Apply the Figma Content Extractor procedure (in your system prompt above).
3. Extract:
   - **Text**: headings (identify level by visual weight/size — h1 for the largest on the page, h2 elsewhere), body paragraphs, eyebrow labels.
   - **CTAs**: button label text and visual style (primary = filled/dark, secondary = outlined, plain = text-only link).
   - **Media**: background images, product images, icons, logos — capture Figma asset export URLs and node IDs. Use get_screenshot if needed.
   - **Background**: section background color (hex or rgba), only if non-white/non-transparent.
   - **Notes**: any structural observations (e.g. "6-icon grid", "3 column cards", "carousel with 4 slides").

### Output format

After processing ALL sections, output a single sentinel line as the LAST line of your response.
The sentinel value must be a compact JSON array (single line, no internal newlines):

EXTRACTED_CONTENT=[{"section":"...","block":"...","nodeId":"...","heading":"...","headingLevel":"h1","body":"...","eyebrow":null,"ctas":[{"label":"...","style":"primary"}],"media":[{"description":"...","figmaUrl":"...","nodeId":"..."}],"background":null,"notes":"..."}]

Field rules:
- Every field required; use null for absent optional fields (eyebrow, background, notes).
- \`ctas\`: empty array [] if no CTAs; style is "primary", "secondary", or "plain".
- \`media\`: empty array [] if no images; figmaUrl is the exportable URL (or null if unavailable).
- \`headingLevel\`: "h1" for the single most prominent heading across the whole page, "h2" elsewhere.
- JSON must be on one line — no embedded newlines inside the sentinel value.

Do not output any text after the EXTRACTED_CONTENT= line.
`;
}

async function runExtractAgent(jobId, plan, figmaUrl) {
  const { figmaFileKey, figmaNodeId } = parseFigmaUrl(figmaUrl);
  const prompt = buildExtractPrompt(plan, figmaUrl, figmaFileKey, figmaNodeId);
  const options = buildQueryOptions(jobId, 'extract', CACHED_PREFIX_EXTRACT);
  // Restrict to Figma MCP only — no Bash/Write needed for pure extraction
  options.allowedTools = [
    'mcp__plugin_figma_figma__get_design_context',
    'mcp__plugin_figma_figma__get_screenshot',
    'mcp__plugin_figma_figma__get_metadata',
    'WebFetch',
  ];

  let finalResult = '';
  let usage = null;

  pushMsg(jobId, 'Extracting content from design…');

  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'result') {
      finalResult = msg.result || '';
      usage = extractUsage(msg);
    }
  }

  const contentMatch = finalResult.match(/EXTRACTED_CONTENT=(\[.*\])/s);
  if (!contentMatch) {
    throw new Error('Extract agent did not output an EXTRACTED_CONTENT sentinel.');
  }

  let extractedContent;
  try {
    extractedContent = JSON.parse(contentMatch[1]);
  } catch (e) {
    throw new Error(`Extract agent EXTRACTED_CONTENT is not valid JSON: ${e.message}\nRaw: ${contentMatch[1].slice(0, 500)}`);
  }

  console.log(`[${jobId.slice(0, 8)}] extract done — ${extractedContent.length} section(s)`);
  pushMsg(jobId, `Content extracted from ${extractedContent.length} section(s)`);

  return { extractedContent, usage };
}

// ── Assemble Agent ────────────────────────────────────────────────────────────
// Runs after the parallel phase. Takes pre-extracted content JSON; no Figma calls.

function buildAssemblePrompt(plan, extractedContent, builtBlocks, draftSlug, org, site, token, username) {
  const slug = draftSlug;
  const planJson = JSON.stringify(plan, null, 2);
  const contentJson = JSON.stringify(extractedContent, null, 2);
  const builtBlocksList = builtBlocks.length > 0
    ? builtBlocks.map((b) => `- ${b}  →  ${BLOCKS_PATH}/${b}/${b}.js`).join('\n')
    : '(none — all sections use Milo blocks)';

  return `## AUTOMATED MODE — non-interactive execution

Skip every "STOP" and "wait for user confirmation" gate. Do NOT create git branches
or commits. Proceed through all phases without pausing.
Do NOT call any Figma tools — all content has already been extracted.

### Inputs

- Page slug: ${slug}
- DA org: ${org}
- DA site (repo): ${site}
- DA username: ${username}
- DA token: ${token}
- REPO_PATH: ${REPO_PATH}

### Auth override

Never call da-auth-helper. Use the DA token directly:
  curl ... -H "Authorization: Bearer ${token}" ...

### Git override

Do NOT create git branches, do NOT commit, do NOT push.

### Output requirement

Your FINAL line of output must be exactly:
  PREVIEW_URL=<url>

where <url> is:
- The aem.page preview URL if preview succeeded (Phase 2b returns 200)
- The da.live edit URL if preview returned non-200:
  https://da.live/edit#/${org}/${site}/drafts/${username}/${slug}
- The literal string "error" only if the DA HTML upload itself failed

---

## Page plan

\`\`\`json
${planJson}
\`\`\`

## Extracted content (already pulled from Figma — do not call Figma tools)

\`\`\`json
${contentJson}
\`\`\`

## Custom blocks built in this run

${builtBlocksList}

For each block in this list, before authoring its section:
- Read its \`.js\` file to understand the expected column/row structure.
- Derive the DA table name using title-case: \`icon-stats\` → \`Icon Stats\`

---

## Phase 1 — Download & Upload Media Assets

For each item in any section's \`media\` array (iterate all sections):

1. Download:
   mkdir -p /tmp/figma-media/${slug}
   mkdir -p /tmp/da-upload/drafts/${username}
   curl -sL "<figmaUrl>" -o /tmp/figma-media/${slug}/<descriptive-filename>
   file /tmp/figma-media/${slug}/<descriptive-filename>
   Rename with the correct extension (.png, .jpg, .svg).

2. Upload to DA shadow folder (parallelize where possible):
   curl -s -w "\\n%{http_code}" -X POST \\
     "https://admin.da.live/source/${org}/${site}/drafts/${username}/.${slug}/<filename>" \\
     -H "Authorization: Bearer ${token}" \\
     -F "data=@/tmp/figma-media/${slug}/<filename>;type=<mime-type>"
   MIME: .png → image/png  .jpg → image/jpeg  .svg → image/svg+xml
   Expect 201. DA URL: https://content.da.live/${org}/${site}/drafts/${username}/.${slug}/<filename>

---

## Phase 2 — Build & Upload DA Document

### 2a. Build DA HTML

Use the Authoring Pattern (in your system prompt). Key rules:
- One <div> per section inside <main>; each div contains one <table>
- Milo blocks: exact name + variants from plan (e.g. "Marquee (large, light)")
- Custom blocks: title-case the folder name (e.g. "metric-strip" → "Metric Strip")
- Use content.da.live URLs for images (from Phase 1)
- Use https://www.adobe.com/ as placeholder for all link hrefs
- NO foundation:c2 metadata, NO viewport rows
- NO section-metadata EXCEPT for Tabs/Carousel blocks

Write complete HTML to:
  /tmp/da-upload/drafts/${username}/${slug}.html

### 2b. Upload HTML

  curl -s -w "\\n%{http_code}" -X POST \\
    "https://admin.da.live/source/${org}/${site}/drafts/${username}/${slug}.html" \\
    -H "Authorization: Bearer ${token}" \\
    -H "Content-Type: text/html" \\
    --data-binary @/tmp/da-upload/drafts/${username}/${slug}.html

Expect 200 or 201.

---

## Phase 3 — Preview & Publish

### 3a. Preview

  curl -s -w "\\n%{http_code}" -X POST \\
    "https://admin.hlx.page/preview/${org}/${site}/main/drafts/${username}/${slug}" \\
    -H "Authorization: Bearer ${token}"

On 200: PREVIEW_URL=https://main--${site}--${org}.aem.page/drafts/${username}/${slug}
On non-200: PREVIEW_URL=https://da.live/edit#/${org}/${site}/drafts/${username}/${slug}

### 3b. Publish (only if preview succeeded)

  curl -s -w "\\n%{http_code}" -X POST \\
    "https://admin.hlx.page/live/${org}/${site}/main/drafts/${username}/${slug}" \\
    -H "Authorization: Bearer ${token}"

### 3c. Final output

Output a brief summary then as the FINAL line:
  PREVIEW_URL=<url>

---

## References

The Milo Block Inventory, DA Table Format Reference, Authoring Pattern, and Token Mapping
are all in your system prompt above.
`;
}

async function runAssembleAgent(jobId, plan, extractedContent, builtBlocks, draftSlug, org, site, token, username) {
  const prompt = buildAssemblePrompt(plan, extractedContent, builtBlocks, draftSlug, org, site, token, username);

  const stderrLines = [];
  const options = buildQueryOptions(jobId, 'assemble', CACHED_PREFIX_ASSEMBLE);
  // No Figma tools needed — content already extracted
  options.allowedTools = ['Bash', 'Read', 'Write', 'Edit'];
  options.stderr = (line) => {
    stderrLines.push(line.trimEnd());
    process.stderr.write(`[${jobId.slice(0, 8)} assemble] ${line}`);
  };

  // Assemble owns stages 2-3
  jobs.set(jobId, { ...jobs.get(jobId), stage: 2 });

  let finalResult = '';
  let previewUrl;
  let usage = null;

  const pushedMsgs = new Set();
  function maybeMsg(key, text) {
    if (!pushedMsgs.has(key)) { pushedMsgs.add(key); pushMsg(jobId, text); }
  }

  for await (const msg of query({ prompt, options })) {
    if (msg.type === 'assistant') {
      const toolUses = msg.message?.content?.filter((b) => b.type === 'tool_use') ?? [];
      for (const tool of toolUses) {
        const name = tool.name ?? '';
        const input = JSON.stringify(tool.input ?? '');
        const current = jobs.get(jobId);
        let stage = current?.stage ?? 2;

        const isWriteTemp = (name === 'Write' || name === 'Edit') && input.includes('/tmp/');
        const isMediaUpload = name === 'Bash' && input.includes('admin.da.live') && !input.includes('.html');
        const isHtmlUpload = name === 'Bash' && input.includes('admin.da.live') && input.includes('.html');
        const isPreview = name === 'Bash' && input.includes('admin.hlx.page');

        if (isWriteTemp || isMediaUpload) {
          stage = Math.max(stage, 2);
          if (isWriteTemp) maybeMsg('assemble', 'Assembling document structure…');
          if (isMediaUpload) maybeMsg('media', 'Uploading media assets…');
        } else if (isHtmlUpload || isPreview) {
          stage = Math.max(stage, 3);
          if (isHtmlUpload) maybeMsg('html', 'Uploading page document…');
          if (isPreview) maybeMsg('preview', 'Triggering page preview…');
        }

        if (stage !== current?.stage) {
          jobs.set(jobId, { ...current, stage });
        }
      }
    }

    if (msg.type === 'result') {
      finalResult = msg.result || '';
      const explicit = finalResult.match(/PREVIEW_URL=(\S+)/);
      if (explicit) previewUrl = explicit[1];
      if (!previewUrl) {
        const fallback = finalResult.match(/https:\/\/[^\s"')]+\.aem\.(live|page)[^\s"')]+/);
        if (fallback) previewUrl = fallback[0];
      }
      usage = extractUsage(msg);
    }
  }

  console.log(`[${jobId.slice(0, 8)}] assemble done — previewUrl: ${previewUrl}`);

  const stderrTail = stderrLines.slice(-60).join('\n');
  const summary = finalResult.trim()
    || `(no agent text output)\n\nstderr tail:\n${stderrTail || '(empty)'}`;

  return { previewUrl, summary, usage };
}

// ── Snowflake Agent ───────────────────────────────────────────────────────────

function buildSnowflakePrompt(figmaUrl, figmaFileKey, figmaNodeId, uid, customPrompt = '') {
  const figmaAccess = buildFigmaAccess(figmaFileKey, figmaNodeId);

  return `## AUTOMATED MODE — non-interactive execution

This agent runs fully automated. Skip every "STOP", "BLOCKING", and "wait for user
confirmation" gate. Do NOT create git branches or commits.
Use the Write tool (not bash/heredoc) for all file writes.

### Inputs

- Figma URL: ${figmaUrl}
- Figma file key: ${figmaFileKey}
- Figma node ID: ${figmaNodeId}
- Output directory: ${SNOWFLAKE_PATH}

${figmaAccess}

---

## Task: Generate a pixel-perfect standalone HTML page from a Figma design

Your goal is to produce a self-contained HTML file that, when opened in a browser,
looks as close to the Figma design as possible. There is no CMS, no block system,
no DA — just HTML and CSS.

### Step 1: Read the Figma design

Call get_design_context on the root frame (the full page):
  ${figmaUrl}

Also call get_screenshot on the root frame so you have a visual reference.

For each top-level section (top-level children of the root frame, read top-to-bottom):
- Call get_design_context to get exact measurements, colors, typography, and layout
- Call get_screenshot for visual reference

### Step 2: Derive the page slug

From the Figma frame/file name: kebab-case, lowercase, no special characters.
Example: "Hub — A.com" → "hub-acom", "Acrobat Product Page" → "acrobat-product-page"

Then append the run ID to ensure uniqueness: \`<base-slug>-${uid}\`
Example: "hub-acom-${uid}", "acrobat-product-page-${uid}"

Use this full suffixed slug everywhere below — for the output file name, the image subfolder, and all asset paths. Wherever the steps below use \`<slug>\` as a placeholder, substitute \`<base-slug>-${uid}\` (the exact suffix to append is \`-${uid}\`).

### Step 3: Download image assets

Create the output directories first:
  mkdir -p ${SNOWFLAKE_PATH}
  mkdir -p ${SNOWFLAKE_PATH}/<slug>

For each image node (background images, product shots, icons, logos) identified in Step 1:

${FIGMA_TOKEN ? `a. Request the export URL (two-step process):
     curl -s "https://api.figma.com/v1/images/${figmaFileKey}?ids=<nodeId>&format=png" \\
       -H "X-Figma-Token: ${FIGMA_TOKEN}"
     Parse the JSON: { "images": { "<nodeId>": "<download-url>" } }

  b. Download the image to disk:
     curl -sL "<download-url>" -o ${SNOWFLAKE_PATH}/<slug>/<descriptive-name>
     file ${SNOWFLAKE_PATH}/<slug>/<descriptive-name>
     Rename with the correct extension (.png, .jpg, .svg) based on the file output.

  c. Reference in HTML as a relative path: ./<slug>/<descriptive-name>.png

  If the export endpoint returns no URL for a node, use get_screenshot as a fallback
  and embed the result as a data URI: src="data:image/png;base64,<base64>"` : `When FIGMA_TOKEN is not set, use get_screenshot on each image node.
  If the MCP tool returns a base64 image, embed it directly as a data URI:
    src="data:image/png;base64,<base64>"
  As a last resort for decorative images, use a background-color placeholder.`}

If any download fails or produces a non-image file, skip it and use a background-color
placeholder in the CSS instead of a broken image reference.

### Step 4: Generate the HTML file

Write a complete, self-contained HTML document to:
  ${SNOWFLAKE_PATH}/<slug>.html

#### HTML requirements

- \`<!doctype html>\` with a descriptive \`<title>\`
- All CSS in a \`<style>\` block inside \`<head>\` — no external stylesheets
- All JavaScript in a single \`<script>\` block at the bottom of \`<body>\`
- Never use inline event handlers (\`onclick\`, \`onsubmit\`, etc.) — all event binding
  goes in the script block via \`addEventListener\`
- Semantic HTML: \`<header>\`, \`<main>\`, \`<section>\`, \`<footer>\` etc.
- Page max-width matches the Figma canvas width; center with \`margin: 0 auto\`
- All \`<a>\` elements use \`href="#"\` as a placeholder. Every anchor click handler
  must call \`event.preventDefault()\` before any other action.

#### CSS requirements — pixel accuracy

Extract and apply exact values from Figma:
- **Colors**: Use the exact hex or rgba values from Figma fills
- **Typography**: exact font-family (use Google Fonts @import if it's a web font),
  font-size (px), font-weight, line-height, letter-spacing, text-transform
- **Spacing**: exact padding/margin/gap values in px matching Figma spacing
- **Layout**: use CSS Grid or Flexbox mirroring Figma auto-layout direction,
  gap, alignment, and wrapping behavior
- **Borders & radii**: exact border-width, border-color, border-radius
- **Shadows**: exact box-shadow values from Figma effects
- **Images**: reference as relative paths \`./<slug>/<filename>\`
- **Backgrounds**: replicate gradient fills with exact CSS gradient syntax

Define CSS custom properties at \`:root\` for repeated color and spacing values.

#### Section structure

Reproduce each top-level Figma section as a separate \`<section>\` element.
Match the section's background color, min-height, and padding from Figma.
Lay out the section's children using Grid/Flexbox matching the Figma layout.

#### Typography hierarchy

Map Figma text styles to HTML elements by visual weight:
- Largest/heaviest text in a section → \`<h1>\` or \`<h2>\`
- Medium weight headings → \`<h3>\` or \`<h4>\`
- Body copy → \`<p>\`
- Small labels/eyebrows → \`<span class="eyebrow">\` or \`<p class="label">\`
- CTAs: primary → \`<a class="btn-primary">\`, secondary → \`<a class="btn-secondary">\`
  Use \`href="#"\` as a placeholder for all links.

#### Interactivity & animations

Implement interactivity only for elements that have interactive affordances visible in the
design (hover states, toggles, arrows, submit buttons, tabs, menus). Do not add interactivity
to elements with no interactive signals in the Figma design.

**Before writing the file**, enumerate the script block in your head: list every handler,
observer, and animation loop you will include. Then write the entire HTML file — CSS,
markup, and script — in a single Write call.

**Event binding rules**
- Always use \`addEventListener\` in the script block. Never use inline \`on*\` attributes.
- Call \`event.preventDefault()\` at the top of every anchor click handler.
- Wrap all listener setup in \`document.addEventListener('DOMContentLoaded', () => { … })\`.

**Buttons & CTAs** — look at the design and implement what makes sense for each element:
- In-page scroll anchors → smooth scroll to the target section
- Commerce / signup CTAs → a brief modal or loading state
- Accordions / expandable rows → toggle open/closed with a CSS height transition
- Search / AI prompt fields → show a placeholder loading state, then placeholder results
- Carousels / sliders → \`currentIndex\` with prev/next navigation and \`translateX\` on the track
- Tabs → \`aria-selected\` on buttons, \`hidden\` on inactive panels
- Menus / dropdowns → show/hide on mouse or keyboard events
- Dismiss / close buttons → hide the parent container

**Forms** — on submit: \`preventDefault()\`, show a loading state, then a success state.

**Navigation**
- Sticky header: add a class when scrolled past the hero; CSS gives it a slightly deeper shadow
- Active nav item: use IntersectionObserver to track the visible section and highlight its nav link

**Scroll-entrance animations** — use a single shared IntersectionObserver to add an \`in-view\`
class to below-fold elements on first entry (never remove it). Animate \`opacity\` and
\`transform\` for the reveal. Stagger grid children with \`transition-delay\`. Do not animate
hero or above-fold content.

**In-design motion** — implement any element that visually cycles, ticks, counts, scrolls, or
pulses in the design (marquee bands, animated counters, looping gradients, pulsing indicators).
Use CSS animations or \`requestAnimationFrame\` as appropriate.

**Hover micro-interactions** — add CSS transitions for cards, buttons, nav items, and icon-links
where hover states are visible or implied by the design.

${customPrompt ? `### User instructions (override)

The following instructions take precedence over any conflicting guidance above:

<user-instructions>
${customPrompt}
</user-instructions>

` : ''}\
### Step 5: Verify and output sentinel

After writing the file, confirm it exists:
  ls -lh ${SNOWFLAKE_PATH}/<slug>.html

Then output this as the very LAST line of your response, with no text after it:
  FILE_PATH=${SNOWFLAKE_PATH}/<slug>.html

If the Write tool failed, output instead:
  FILE_PATH=error
`;
}

async function runSnowflakeAgent(jobId, figmaUrl, customPrompt = '') {
  const { figmaFileKey, figmaNodeId } = parseFigmaUrl(figmaUrl);
  const uid = jobId.slice(0, 6);
  const prompt = buildSnowflakePrompt(figmaUrl, figmaFileKey, figmaNodeId, uid, customPrompt);

  const opts = buildQueryOptions(jobId, 'snowflake');
  opts.stderr = (line) => {
    process.stderr.write(`[${jobId.slice(0, 8)} snowflake] ${line}`);
  };

  jobs.set(jobId, { ...jobs.get(jobId), stage: 0 });

  let finalResult = '';
  let usage = null;

  for await (const msg of query({ prompt, options: opts })) {
    if (msg.type === 'assistant') {
      const toolUses = msg.message?.content?.filter((b) => b.type === 'tool_use') ?? [];
      for (const tool of toolUses) {
        const name = tool.name ?? '';
        const current = jobs.get(jobId);
        let stage = current?.stage ?? 0;

        const isFigma = name.startsWith('mcp__plugin_figma') || (tool.input && JSON.stringify(tool.input).includes('api.figma.com'));
        if (isFigma) {
          stage = Math.max(stage, 0);
        } else if (name === 'Write' || name === 'Edit' || (name === 'Bash' && JSON.stringify(tool.input ?? '').includes(SNOWFLAKE_PATH))) {
          stage = Math.max(stage, 1);
        }

        if (stage !== current?.stage) {
          jobs.set(jobId, { ...current, stage });
        }
      }
    }

    if (msg.type === 'result') {
      finalResult = msg.result || '';
      usage = extractUsage(msg);
    }
  }

  let filePath = finalResult.match(/FILE_PATH=(\S+)/)?.[1] ?? null;
  if (!filePath) {
    // Fallback: scan result for any .html file under SNOWFLAKE_PATH
    const fallback = finalResult.match(new RegExp(SNOWFLAKE_PATH.replace(/\\/g, '\\\\') + '/[^\\s]+\\.html'));
    if (fallback) filePath = fallback[0];
  }
  if (!filePath) {
    throw new Error('Snowflake agent did not output a FILE_PATH sentinel.');
  }
  if (filePath === 'error') {
    throw new Error('Snowflake agent reported FILE_PATH=error — HTML write failed.');
  }

  const snowflakeRoot = resolve(SNOWFLAKE_PATH) + sep;
  if (!resolve(filePath).startsWith(snowflakeRoot)) {
    throw new Error(`Agent returned path outside SNOWFLAKE_PATH: ${filePath}`);
  }

  // Guarantee the uid suffix regardless of what the agent named the file.
  if (!filePath.endsWith(`-${uid}.html`)) {
    const dir = dirname(filePath);
    const base = basename(filePath, extname(filePath));
    const newFilePath = join(dir, `${base}-${uid}.html`);
    const assetDir = join(dir, base);
    const newAssetDir = join(dir, `${base}-${uid}`);

    let html = readFileSync(filePath, 'utf8');
    if (existsSync(assetDir)) {
      html = html.replaceAll(`./${base}/`, `./${base}-${uid}/`);
      renameSync(assetDir, newAssetDir);
    }
    writeFileSync(newFilePath, html);
    unlinkSync(filePath);
    console.log(`[${jobId.slice(0, 8)}] uid-suffixed: ${base}.html → ${base}-${uid}.html`);
    filePath = newFilePath;
  }

  console.log(`[${jobId.slice(0, 8)}] snowflake done — filePath: ${filePath}`);
  const summary = finalResult.trim();
  return { filePath, summary, usage };
}

async function runSnowflakePipeline(jobId, figmaUrl, customPrompt = '') {
  jobs.set(jobId, { ...jobs.get(jobId), stage: 0, mode: 'snowflake' });
  const { filePath, summary, usage } = await withRetry(
    () => runSnowflakeAgent(jobId, figmaUrl, customPrompt),
    { label: `snowflake ${jobId.slice(0, 8)}` },
  );
  jobs.set(jobId, { status: 'done', filePath, summary: summary.slice(0, 4000), usage, mode: 'snowflake' });
  console.log(`[${jobId.slice(0, 8)}] snowflake pipeline complete — status set to done`);
}

// ── Pipeline Orchestrator ─────────────────────────────────────────────────────

async function commitBuiltBlocks(jobId, builtBlocks, branchName) {
  const { stdout } = await git('rev-parse', '--abbrev-ref', 'HEAD');
  const originalBranch = stdout.trim();

  try {
    await git('checkout', '-b', branchName);
    for (const blockName of builtBlocks) {
      await git('add', `blocks/${blockName}`);
    }
    await git('commit', '-m', `feat: add ${builtBlocks.join(', ')} (figma-da run ${branchName})`);
    try {
      await git('push', '-u', 'origin', branchName);
      console.log(`[${jobId.slice(0, 8)}] ${builtBlocks.length} block(s) → branch ${branchName} (pushed to origin)`);
    } catch (pushErr) {
      console.warn(`[${jobId.slice(0, 8)}] push failed — branch committed locally: ${pushErr.message}`);
    }
  } finally {
    await git('checkout', originalBranch);
  }
}

async function runPipeline(jobId, figmaUrl, daContext) {
  const org = daContext?.org || daContext?.owner || 'adobecom';
  const site = daContext?.repo || daContext?.site || 'da-playground';
  const token = daContext?.token || '';
  const username = daContext?.username || 'anonymous';

  // Stage 0: analyze design → page plan
  jobs.set(jobId, { ...jobs.get(jobId), stage: 0 });
  const { plan, slug, usage: analyzeUsage } = await withRetry(
    () => runAnalyzeAgent(jobId, figmaUrl),
    { label: `analyze ${jobId.slice(0, 8)}` },
  );

  const uid = jobId.slice(0, 6);
  const draftSlug = `${slug}-${uid}`;
  console.log(`[${jobId.slice(0, 8)}] uid: ${uid}, draft slug: ${draftSlug}`);

  // Stage 1: parallel — block builders + content extraction run concurrently
  const newEntries = plan.filter((e) => e.block.startsWith('NEW:'));
  const blockNames = newEntries.map((e) => e.block.replace(/^NEW:\s*/, '').trim());

  jobs.set(jobId, {
    ...jobs.get(jobId),
    stage: 1,
    workers: {
      'build-blocks': newEntries.length > 0 ? 'running' : 'skipped',
      extract: 'running',
    },
  });

  if (newEntries.length > 0) {
    console.log(`[${jobId.slice(0, 8)}] stage 1: building ${newEntries.length} block(s) + extracting content in parallel`);
    pushMsg(jobId, `Building ${blockNames.join(', ')} + extracting content in parallel…`);
  } else {
    pushMsg(jobId, 'Extracting content from design…');
  }

  // Run block builders (inner allSettled always fulfills) and extract agent concurrently
  const [blocksOutcome, extractOutcome] = await Promise.allSettled([
    Promise.allSettled(
      newEntries.map((entry) => withRetry(
        () => runBlockBuilderAgent(jobId, entry, figmaUrl),
        { label: `block:${entry.block.replace(/^NEW:\s*/, '')} ${jobId.slice(0, 8)}` },
      )),
    ),
    withRetry(
      () => runExtractAgent(jobId, plan, figmaUrl),
      { label: `extract ${jobId.slice(0, 8)}` },
    ),
  ]);

  // Process block builder results (non-fatal)
  let builtBlocks = [];
  const buildUsages = [];
  if (blocksOutcome.status === 'fulfilled') {
    for (const outcome of blocksOutcome.value) {
      if (outcome.status === 'fulfilled') {
        const result = outcome.value;
        const entry = plan.find((e) => e.block === result.originalMarker);
        if (entry) entry.block = result.blockName;
        buildUsages.push(result.usage);
        builtBlocks.push(result.blockName);
      } else {
        console.error(`[${jobId.slice(0, 8)}] block-builder failed (non-fatal):`, outcome.reason?.message ?? outcome.reason);
        pushMsg(jobId, `Warning: one block builder failed — ${outcome.reason?.message ?? 'unknown error'}`);
      }
    }
    const blocksStatus = newEntries.length === 0 ? 'skipped' : builtBlocks.length > 0 ? 'done' : 'error';
    jobs.set(jobId, { ...jobs.get(jobId), workers: { ...jobs.get(jobId)?.workers, 'build-blocks': blocksStatus } });
    if (builtBlocks.length > 0) pushMsg(jobId, `Block(s) built: ${builtBlocks.join(', ')}`);
  } else {
    jobs.set(jobId, { ...jobs.get(jobId), workers: { ...jobs.get(jobId)?.workers, 'build-blocks': 'error' } });
    pushMsg(jobId, `Warning: block building failed — ${blocksOutcome.reason?.message ?? 'unknown'}`);
  }

  // Extract result is required — fail fast if it errored
  if (extractOutcome.status === 'rejected') {
    jobs.set(jobId, { ...jobs.get(jobId), workers: { ...jobs.get(jobId)?.workers, extract: 'error' } });
    throw extractOutcome.reason;
  }
  const { extractedContent, usage: extractStageUsage } = extractOutcome.value;
  jobs.set(jobId, { ...jobs.get(jobId), workers: { ...jobs.get(jobId)?.workers, extract: 'done' } });

  // Stages 2-3: assemble agent builds + uploads the DA document
  const { previewUrl, summary, usage: assembleUsage } = await withRetry(
    () => runAssembleAgent(jobId, plan, extractedContent, builtBlocks, draftSlug, org, site, token, username),
    { maxAttempts: 2, baseDelayMs: 5000, label: `assemble ${jobId.slice(0, 8)}` },
  );

  // Commit new blocks to a branch (non-fatal; assemble agent already read them)
  let blockBranch = null;
  if (builtBlocks.length > 0) {
    try {
      pushMsg(jobId, `Committing ${builtBlocks.length} block(s) to branch '${draftSlug}'…`);
      await commitBuiltBlocks(jobId, builtBlocks, draftSlug);
      blockBranch = draftSlug;
      pushMsg(jobId, `Branch '${draftSlug}' ready`);
    } catch (e) {
      console.error(`[${jobId.slice(0, 8)}] git commit failed (non-fatal):`, e.message);
    }
  }

  const usage = aggregateUsage([analyzeUsage, ...buildUsages, extractStageUsage, assembleUsage]);

  if (!previewUrl || previewUrl === 'error') {
    jobs.set(jobId, {
      status: 'done',
      previewUrl: previewUrl || null,
      ...(blockBranch && { blockBranch }),
      summary: summary.slice(0, 4000),
      usage,
    });
    return;
  }

  jobs.set(jobId, { status: 'done', previewUrl, ...(blockBranch && { blockBranch }), usage });
}

// ── Express routes ────────────────────────────────────────────────────────────

app.post('/jobs', async (req, res) => {
  const { figmaUrl, daContext, mode, customPrompt } = req.body;

  if (!figmaUrl || !figmaUrl.includes('figma.com')) {
    return res.status(400).json({ error: 'figmaUrl must be a valid figma.com URL' });
  }
  const { figmaFileKey, figmaNodeId } = parseFigmaUrl(figmaUrl);
  if (!figmaFileKey || !/^[a-zA-Z0-9_-]{10,40}$/.test(figmaFileKey)) {
    return res.status(400).json({ error: 'Could not extract a valid Figma file key from figmaUrl' });
  }
  if (figmaNodeId && !/^\d+:\d+$/.test(figmaNodeId)) {
    return res.status(400).json({ error: 'Invalid Figma node ID in figmaUrl — expected format "123:456"' });
  }

  const jobId = randomUUID();
  jobs.set(jobId, { status: 'pending', stage: 0, mode: mode === 'snowflake' ? 'snowflake' : 'da', messages: [] });
  res.status(202).json({ jobId });

  if (mode === 'snowflake') {
    runSnowflakePipeline(jobId, figmaUrl, customPrompt || '').catch((e) => {
      console.error(`[${jobId.slice(0, 8)}] snowflake pipeline error:`, e);
      jobs.set(jobId, { status: 'error', error: String(e) });
    });
  } else {
    runPipeline(jobId, figmaUrl, daContext).catch((e) => {
      console.error(`[${jobId.slice(0, 8)}] pipeline error:`, e);
      jobs.set(jobId, { status: 'error', error: String(e) });
    });
  }
});

app.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.listen(PORT, () => {
  console.log(`Agent server running on http://localhost:${PORT}`);
  console.log(`Repo path: ${REPO_PATH}`);
  console.log(`Blocks path: ${BLOCKS_PATH}`);
  console.log(`Snowflake path: ${SNOWFLAKE_PATH}`);
});
