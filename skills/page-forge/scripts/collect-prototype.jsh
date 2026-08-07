// collect-prototype.jsh — prepare a single stardust prototype's HTML for the preview iframe.
// SLICC port of redesignStardust.js collectVariants()'s per-file processing:
//   1. Rewrite local image refs to a renderable form (relative paths never resolve inside a
//      srcdoc iframe — no base URL). 4-tier recovery, preferring durable live URLs over heavy
//      inlined bytes (mirror of redesignStardust.js buildAssetUrlMap + rewriteAssetUrls):
//        1. live URL via exact localPath-basename     (primary, media downloads)
//        2. live URL via exact / strip-hash src-basename
//        3. live URL via prefix match                 (recovers media_* when localPath was null)
//        4. data URI from the on-disk file            (curated assets/, or downloads w/ no src)
//      Handles BOTH `assets/media/<hashed>` (downloads) and a curated `assets/<clean-name>` folder.
//   2. Inline lenis.min.{js,css} into a cinematic prototype so the srcdoc iframe is self-contained.
// Writes the processed HTML next to the original as <name>.forge.html and prints JSON
// { out, lenisInlined, images } so the scoop reads `out` and emits it as the preview.
//
// NOTE: the live Reimagine/refine delivery path is `emit-prototypes.jsh`, which carries an
// identical copy of this image logic and also handles discovery + chunked delivery. Keep the two
// in sync (both mirror redesignStardust.js). This script remains for single-file prep / debugging.
//
// SLICC .jsh runtime: async fs API ONLY (fs.exists/readFile/readFileBinary/writeFile/readDir —
// there is NO fs.existsSync/readdirSync/etc) and NO shebang (wrapped in an AsyncFunction).
//
// Usage:  collect-prototype.jsh <prototype-html-path> <workdir>

const protoPath = process.argv[2];
const workdir = process.argv[3];
if (!protoPath || !workdir) { console.error('usage: collect-prototype.jsh <prototype-html> <workdir>'); process.exit(1); }
if (!(await fs.exists(protoPath))) { console.error(`ERROR: prototype not found: ${protoPath}`); process.exit(2); }

function dirname(p) { return (p || '').replace(/\/[^/]*$/, '') || '.'; }

const MIME_BY_EXT = {
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon',
};
function splitExt(name) { const i = name.lastIndexOf('.'); return i > 0 ? [name.slice(0, i), name.slice(i + 1).toLowerCase()] : [name, '']; }
function imageExtOf(name) { const last = (name.split('.').pop() || '').toLowerCase(); const ext = last.replace(/-[0-9a-f]{4,}$/i, ''); return MIME_BY_EXT[ext] ? ext : null; }
function stripLocalHash(name) { return name.replace(/-[0-9a-f]{4,}(\.[a-z0-9]+)$/i, '$1'); }
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

// Build live-URL lookups from every page capture's `media` list.
async function buildAssetUrlMap() {
  const byLocalBase = new Map(); const bySrcBase = new Map(); const srcEntries = [];
  const pagesDir = `${workdir}/stardust/current/pages`;
  if (!(await fs.exists(pagesDir))) return { byLocalBase, bySrcBase, srcEntries };
  let files = [];
  try { files = (await fs.readDir(pagesDir)).filter((f) => f.endsWith('.json')); } catch { return { byLocalBase, bySrcBase, srcEntries }; }
  for (const f of files) {
    let page;
    try { page = JSON.parse(await fs.readFile(`${pagesDir}/${f}`)); } catch { continue; }
    const media = page && page.media;
    if (!media || typeof media !== 'object') continue;
    // `media` is a dict of typed arrays (images/icons/…) or, defensively, a flat array.
    const groups = Array.isArray(media) ? [media] : Object.values(media);
    for (const group of groups) {
      if (!Array.isArray(group)) continue;
      for (const item of group) {
        if (!item || typeof item !== 'object') continue;
        const src = item.src; const localPath = item.localPath;
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

// Last-resort data-URI inline. SVG → encodeURIComponent (text). Raster → best-effort base64 (SLICC
// has no Buffer); fully guarded — any uncertainty returns null and the ref is left untouched.
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

// Two-pass rewrite (live URLs sync; data-URIs async). Only image refs touched. Returns {html,stats}.
const ASSET_RE = /(src|href)=("|')([^"']*?assets\/((?:media\/)?[^"'?#]+)[^"']*)\2/gi;
async function rewriteAssetUrls(html, maps, mediaDir, curatedDir) {
  const { byLocalBase, bySrcBase, srcEntries } = maps;
  const stats = { total: 0, byUrl: 0, inlined: 0, unresolved: 0 };
  const resolveLive = (name) => byLocalBase.get(name) || bySrcBase.get(name) || bySrcBase.get(stripLocalHash(name)) || matchByPrefix(name, srcEntries);
  const misses = [];
  let out = html.replace(ASSET_RE, (whole, attr, q, _full, rest) => {
    const isMedia = rest.startsWith('media/'); const name = isMedia ? rest.slice(6) : rest;
    if (!imageExtOf(name)) return whole;
    stats.total += 1;
    const url = resolveLive(name);
    if (url) { stats.byUrl += 1; return `${attr}=${q}${url}${q}`; }
    misses.push({ isMedia, name });
    return whole;
  });
  const dataUris = new Map();
  for (const { isMedia, name } of misses) {
    if (dataUris.has(name)) continue;
    const uri = await fileAsDataUri(isMedia ? mediaDir : curatedDir, name);
    if (uri) dataUris.set(name, uri);
  }
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

// Inline lenis.min.{js,css} (siblings of the prototype) into a cinematic prototype.
async function inlineLenis(html, protoDir) {
  let out = html;
  if (await fs.exists(`${protoDir}/lenis.min.js`)) {
    const js = await fs.readFile(`${protoDir}/lenis.min.js`);
    out = out.replace(/<script[^>]*src=["'][^"']*lenis\.min\.js["'][^>]*>\s*<\/script>/i, `<script>${js}</script>`);
  }
  if (await fs.exists(`${protoDir}/lenis.min.css`)) {
    const css = await fs.readFile(`${protoDir}/lenis.min.css`);
    out = out.replace(/<link[^>]*href=["'][^"']*lenis\.min\.css["'][^>]*>/i, `<style>${css}</style>`);
  }
  return out;
}

const protoDir = dirname(protoPath);
let html = await fs.readFile(protoPath);
let lenisInlined = false;
if (/cinematic/.test(protoPath)) { const before = html; html = await inlineLenis(html, protoDir); lenisInlined = (html !== before); }
const maps = await buildAssetUrlMap();
const r = await rewriteAssetUrls(html, maps, `${workdir}/stardust/current/assets/media`, `${protoDir}/assets`);

const out = protoPath.replace(/\.html$/i, '') + '.forge.html';
await fs.writeFile(out, r.html);
console.log(JSON.stringify({ out, lenisInlined, images: r.stats }));
