// emit-prototypes.jsh — collect the Stardust prototype files and deliver them to the panel
// WITHOUT routing any HTML through the scoop's context/output budget.
//
// WHY THIS EXISTS (the Reimagine failure it fixes):
//   The scoop is an LLM. If it "reads each prototype and emits a preview lick" itself, it
//   (a) spends its OUTPUT token budget on ~6-7KB × 4 variants of HTML and runs dry mid-batch,
//   and (b) is tempted to *hand-author* HTML when stardust output is missing. Both were observed.
//   This script moves discovery + collection + delivery OUT of the model: the scoop runs ONE
//   command; this deterministic script reads the files stardust wrote and sends them.
//
//   It is ALSO the postcondition guard (DA's "STARDUST_DONE but no prototype HTML" check): if
//   stardust/prototypes/ has no *-proposed.html, stardust did NOT run — exit non-zero so the
//   scoop emits action:"error" instead of fabricating variants.
//
// DELIVERY: each prototype is split into small chunks and pushed to the panel with
//   `sprinkle send page-forge '{"action":"preview-chunk",...}'` (the panel reassembles by id).
//   Verified against SLICC source (packages/webapp): `sprinkle` is a registered supplemental
//   command, and a .jsh's exec/exec.spawn routes through the same shell context that owns it —
//   so a .jsh CAN deliver to the panel. We use **exec.spawn(argv[])**, which bypasses shell
//   parsing/quoting entirely (the SLICC-intended way to build commands programmatically — it
//   "kills the quoting-trap class of bugs", i.e. exactly the awk/JSON-escaping hacks the scoop
//   kept reinventing). Falls back to shell-escaped exec() on older builds. Chunking keeps every
//   message small regardless of transport. Fails loud if a send errors.
//
// SLICC .jsh runtime: async fs API ONLY (fs.exists/readFile/writeFile/readDir — NO *Sync), exec()
// is async → { stdout, stderr, exitCode }, NO shebang (the file is wrapped in an AsyncFunction).
//
// Usage:  emit-prototypes.jsh <workdir> '<meta-json>'
//   <meta-json> = {"stage":"redesigned","intent":"<intent>","baseV":<N>}
//     baseV — version number for the first variant (generate → 1; refine → fromV+1).

const workdir = process.argv[2];
let meta = {};
try { meta = JSON.parse(process.argv[3] || '{}'); } catch { /* defaults below */ }
if (!workdir) { console.error('usage: emit-prototypes.jsh <workdir> \'<meta-json>\''); process.exit(1); }

const stage = meta.stage || 'redesigned';
const intent = meta.intent || '';
const baseV = Number.isFinite(meta.baseV) ? meta.baseV : 1;

const protoDir = `${workdir}/stardust/prototypes`;
const CHUNK = 6000; // chars of raw HTML per message — safely under any plausible frame/arg cap.

// ── deliver one sprinkle message: prefer exec.spawn (no shell quoting); fall back to escaped exec ──
function shArg(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
async function sprinkleSend(name, payload) {
  const json = JSON.stringify(payload);
  if (typeof exec.spawn === 'function') return exec.spawn(['sprinkle', 'send', name, json]);
  return exec('sprinkle send ' + name + ' ' + shArg(json));
}
function dirname(p) { return (p || '').replace(/\/[^/]*$/, '') || '.'; }

// ── classify a prototype filename → { label, order } ──
function classify(name) {
  if (/-cinematic\.html$/i.test(name)) return { label: 'Variant C — cinematic', order: 3 };
  const v = name.match(/-([ABC])-proposed\.html$/i);
  if (v) return { label: `Variant ${v[1].toUpperCase()}`, order: { A: 0, B: 1, C: 2 }[v[1].toUpperCase()] };
  if (/-proposed\.html$/i.test(name)) return { label: 'Redesign', order: 0 };
  return null;
}

// ── media-url rewrite (port of collect-prototype.jsh): local assets/media → absolute src ──
async function buildAssetUrlMap() {
  const map = new Map();
  const pagesDir = `${workdir}/stardust/current/pages`;
  if (!(await fs.exists(pagesDir))) return map;
  let files = [];
  try { files = (await fs.readDir(pagesDir)).filter((f) => f.endsWith('.json')); } catch { return map; }
  for (const f of files) {
    let page; try { page = JSON.parse(await fs.readFile(`${pagesDir}/${f}`)); } catch { continue; }
    const media = page && page.media; if (!media || typeof media !== 'object') continue;
    const groups = Array.isArray(media) ? [media] : Object.values(media);
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (!item || typeof item !== 'object') continue;
        const src = item.src, localPath = item.localPath;
        if (typeof src !== 'string' || !/^https?:\/\//.test(src)) continue;
        if (typeof localPath === 'string' && localPath) {
          const base = localPath.split('/').pop();
          if (base && !map.has(base)) map.set(base, src);
        }
      }
    }
  }
  return map;
}
function rewriteAssetUrls(html, urlMap) {
  if (!urlMap.size) return html;
  return html.replace(/(src|href)=("|')([^"']*?assets\/media\/([^"'?#]+)[^"']*)\2/gi,
    (whole, attr, q, _full, name) => { const orig = urlMap.get(name); return orig ? `${attr}=${q}${orig}${q}` : whole; });
}
async function inlineLenis(html, dir) {
  let out = html;
  if (await fs.exists(`${dir}/lenis.min.js`)) {
    const js = await fs.readFile(`${dir}/lenis.min.js`);
    out = out.replace(/<script[^>]*src=["'][^"']*lenis\.min\.js["'][^>]*>\s*<\/script>/i, `<script>${js}</script>`);
  }
  if (await fs.exists(`${dir}/lenis.min.css`)) {
    const css = await fs.readFile(`${dir}/lenis.min.css`);
    out = out.replace(/<link[^>]*href=["'][^"']*lenis\.min\.css["'][^>]*>/i, `<style>${css}</style>`);
  }
  return out;
}

// ── send one prototype as chunked preview-chunk messages ──
async function sendVariant(html, info, v) {
  const id = `v${v}-${(info.label || 'redesign').replace(/\s+/g, '_')}`;
  const total = Math.max(1, Math.ceil(html.length / CHUNK));
  for (let seq = 0; seq < total; seq += 1) {
    const payload = {
      action: 'preview-chunk', id, seq, total,
      v, stage, intent, label: info.label,
      data: html.slice(seq * CHUNK, (seq + 1) * CHUNK),
    };
    const r = await sprinkleSend('page-forge', payload);
    if (r.exitCode !== 0) {
      throw new Error(`sprinkle send failed (variant ${info.label}, chunk ${seq + 1}/${total}, exit ${r.exitCode}): `
        + (r.stderr || r.stdout || '').slice(-300));
    }
  }
  return { v, label: info.label, id, chunks: total, bytes: html.length };
}

// ── main: discover → guard → prep → send ──
if (!(await fs.exists(protoDir))) {
  console.error(`ERROR: ${protoDir} does not exist — no prototypes were written. Follow the stardust `
    + 'methodology (you ARE the engine) and WRITE each variant to stardust/prototypes/<slug>-*-proposed.html '
    + 'designed to the injected C2 brand, then re-run this. Do NOT stream HTML inline or improvise. Emit action:"error".');
  process.exit(2);
}

let entries = (await fs.readDir(protoDir))
  .map((name) => ({ name, info: classify(name) }))
  .filter((e) => e.info)
  .sort((a, b) => a.info.order - b.info.order);

// Prefer the *.forge.html siblings if a previous collect already wrote them; otherwise use raw.
// (We process raw here, so ignore *.forge.html in discovery to avoid double-emitting.)
entries = entries.filter((e) => !/\.forge\.html$/i.test(e.name));

if (!entries.length) {
  console.error(`ERROR: no *-proposed.html in ${protoDir} — nothing was written there. You (the scoop) `
    + 'ARE the stardust engine: follow the methodology and WRITE each variant to stardust/prototypes/'
    + '<slug>-*-proposed.html (designed to the injected C2 brand surface), then re-run. Emit action:"error".');
  process.exit(3);
}

const urlMap = await buildAssetUrlMap();
const sent = [];
for (let i = 0; i < entries.length; i += 1) {
  const e = entries[i];
  const path = `${protoDir}/${e.name}`;
  let html = await fs.readFile(path);
  if (/cinematic/i.test(e.name)) html = await inlineLenis(html, dirname(path));
  html = rewriteAssetUrls(html, urlMap);
  // Persist the processed copy for debugging / re-send.
  await fs.writeFile(path.replace(/\.html$/i, '') + '.forge.html', html);
  sent.push(await sendVariant(html, e.info, baseV + i));
}

console.log(JSON.stringify({ emitted: sent.length, variants: sent }));
