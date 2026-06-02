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

// ── image resolution (port of redesignStardust.js buildAssetUrlMap + rewriteAssetUrls) ──
// stardust prototypes reference local copies (`assets/media/<hashed>` for downloads, or a curated
// `assets/<clean-name>` folder). Relative paths never resolve in a srcdoc iframe (no base URL), so
// rewrite to the live URL. 4-tier recovery, preferring durable live URLs over heavy inlined bytes:
//   1. live URL via exact localPath-basename     (primary, media downloads)
//   2. live URL via exact / strip-hash src-basename
//   3. live URL via prefix match                 (recovers media_* when localPath was null)
//   4. data URI from the on-disk file            (curated assets/, or downloads w/ no recoverable src)
const MIME_BY_EXT = {
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
};
function splitExt(name) { const i = name.lastIndexOf('.'); return i > 0 ? [name.slice(0, i), name.slice(i + 1).toLowerCase()] : [name, '']; }
// Tolerates the download naming `name.png-<hash>` as well as a plain `name.png`.
function imageExtOf(name) { const last = (name.split('.').pop() || '').toLowerCase(); const ext = last.replace(/-[0-9a-f]{4,}$/i, ''); return MIME_BY_EXT[ext] ? ext : null; }
function stripLocalHash(name) { return name.replace(/-[0-9a-f]{4,}(\.[a-z0-9]+)$/i, '$1'); }
// Local stem is a PREFIX of the src stem (equal for human-named; for AEM media_<hash> the local
// name truncates the long hash + appends `-<4hex>`). Recovers the live URL even when localPath is
// null. Requires a single unambiguous match + a minimum stem length to be safe.
function matchByPrefix(name, srcEntries) {
  const [rawStem, ext] = splitExt(name);
  const stem = rawStem.replace(/-[0-9a-f]{4,}$/i, '');
  if (stem.length < 6) return null;
  let hit = null;
  for (const e of srcEntries) {
    if (e.ext !== ext || !e.stem.startsWith(stem)) continue;
    if (hit && hit !== e.url) return null; // ambiguous — don't guess
    hit = e.url;
  }
  return hit;
}
async function buildAssetUrlMap() {
  const byLocalBase = new Map(); const bySrcBase = new Map(); const srcEntries = [];
  const pagesDir = `${workdir}/stardust/current/pages`;
  if (!(await fs.exists(pagesDir))) return { byLocalBase, bySrcBase, srcEntries };
  let files = [];
  try { files = (await fs.readDir(pagesDir)).filter((f) => f.endsWith('.json')); } catch { return { byLocalBase, bySrcBase, srcEntries }; }
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
        const srcBase = src.split('?')[0].split('#')[0].split('/').pop();
        if (srcBase && !bySrcBase.has(srcBase)) {
          bySrcBase.set(srcBase, src);
          const [stem, ext] = splitExt(srcBase);
          srcEntries.push({ stem, ext, url: src });
        }
        if (typeof localPath === 'string' && localPath) {
          const base = localPath.split('/').pop();
          if (base && !byLocalBase.has(base)) byLocalBase.set(base, src);
        }
      }
    }
  }
  return { byLocalBase, bySrcBase, srcEntries };
}
// Inline an on-disk media file as a data URI (last-resort tier). SVG is text → encodeURIComponent.
// Raster needs base64; SLICC has no Buffer, so this is best-effort (fs.readFileBinary may return a
// base64 string or bytes depending on the build) and FULLY guarded — any uncertainty returns null
// and the ref is left untouched (same as before). The live-URL tiers above carry the common case.
async function fileAsDataUri(dir, name) {
  const ext = imageExtOf(name); if (!ext) return null;
  const mime = MIME_BY_EXT[ext]; const path = `${dir}/${name}`;
  try {
    if (!(await fs.exists(path))) return null;
    if (mime === 'image/svg+xml') {
      const text = await fs.readFile(path);
      const body = encodeURIComponent(text).replace(/'/g, '%27').replace(/"/g, '%22');
      return `data:${mime},${body}`;
    }
    if (typeof fs.readFileBinary !== 'function') return null;
    const bin = await fs.readFileBinary(path);
    let b64 = null;
    if (typeof bin === 'string') {
      b64 = bin; // sandboxed runtimes commonly return base64 for binary reads
    } else if (bin && typeof globalThis.btoa === 'function') {
      const bytes = bin instanceof Uint8Array ? bin : new Uint8Array(bin);
      let binary = ''; const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      b64 = globalThis.btoa(binary);
    }
    return b64 ? `data:${mime};base64,${b64}` : null;
  } catch { return null; }
}
// Two-pass (live URLs are sync string ops; data-URIs need async file reads). Only image refs are
// touched; css/js/font refs under assets/ are left alone. Returns { html, stats }.
const ASSET_RE = /(src|href)=("|')([^"']*?assets\/((?:media\/)?[^"'?#]+)[^"']*)\2/gi;
async function rewriteAssetUrls(html, maps, mediaDir, curatedDir) {
  const { byLocalBase, bySrcBase, srcEntries } = maps;
  const stats = { total: 0, byUrl: 0, inlined: 0, unresolved: 0 };
  const resolveLive = (name) => byLocalBase.get(name) || bySrcBase.get(name) || bySrcBase.get(stripLocalHash(name)) || matchByPrefix(name, srcEntries);
  const misses = [];
  // Pass 1 — live URLs (sync); collect misses for data-URI.
  let out = html.replace(ASSET_RE, (whole, attr, q, _full, rest) => {
    const isMedia = rest.startsWith('media/'); const name = isMedia ? rest.slice(6) : rest;
    if (!imageExtOf(name)) return whole;
    stats.total += 1;
    const url = resolveLive(name);
    if (url) { stats.byUrl += 1; return `${attr}=${q}${url}${q}`; }
    misses.push({ isMedia, name });
    return whole;
  });
  // Build data-URIs for the misses (async).
  const dataUris = new Map();
  for (const { isMedia, name } of misses) {
    if (dataUris.has(name)) continue;
    const uri = await fileAsDataUri(isMedia ? mediaDir : curatedDir, name);
    if (uri) dataUris.set(name, uri);
  }
  // Pass 2 — substitute the resolved data-URIs (only the still-`assets/...` refs match now).
  if (dataUris.size) {
    out = out.replace(ASSET_RE, (whole, attr, q, _full, rest) => {
      const isMedia = rest.startsWith('media/'); const name = isMedia ? rest.slice(6) : rest;
      if (!imageExtOf(name)) return whole;
      const uri = dataUris.get(name);
      if (uri) { stats.inlined += 1; return `${attr}=${q}${uri}${q}`; }
      return whole;
    });
  }
  stats.unresolved = stats.total - stats.byUrl - stats.inlined;
  return { html: out, stats };
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

const maps = await buildAssetUrlMap();
const mediaDir = `${workdir}/stardust/current/assets/media`;
const curatedDir = `${protoDir}/assets`;
const sent = [];
for (let i = 0; i < entries.length; i += 1) {
  const e = entries[i];
  const path = `${protoDir}/${e.name}`;
  let html = await fs.readFile(path);
  if (/cinematic/i.test(e.name)) html = await inlineLenis(html, dirname(path));
  const r = await rewriteAssetUrls(html, maps, mediaDir, curatedDir);
  html = r.html;
  // Persist the processed copy for debugging / re-send.
  await fs.writeFile(path.replace(/\.html$/i, '') + '.forge.html', html);
  sent.push({ ...(await sendVariant(html, e.info, baseV + i)), images: r.stats });
}

console.log(JSON.stringify({ emitted: sent.length, variants: sent }));
