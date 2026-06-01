#!/usr/bin/env jsh
// collect-prototype.jsh — prepare a stardust prototype's HTML for the preview iframe.
// SLICC port of redesignStardust.js collectVariants()'s per-file processing:
//   1. Rewrite local `assets/media/<name>` refs to the original ABSOLUTE source URL
//      (from the page capture's media map). stardust prototypes reference the downloaded
//      local copies, but (a) extract sometimes skips the media download and (b) relative
//      paths never resolve inside a srcdoc iframe (no base URL). Either way the images
//      vanish — rewriting to the live URL fixes both.
//   2. Inline lenis.min.{js,css} into a cinematic prototype so the srcdoc iframe is
//      self-contained.
// Writes the processed HTML next to the original as <name>.forge.html and prints JSON
// { out, rewritten, lenisInlined } so the scoop reads `out` and emits it as the preview.
//
// Usage:  collect-prototype.jsh <prototype-html-path> <workdir>

const protoPath = process.argv[2];
const workdir = process.argv[3];
if (!protoPath || !workdir) { console.error('usage: collect-prototype.jsh <prototype-html> <workdir>'); process.exit(1); }
if (!fs.existsSync(protoPath)) { console.error(`ERROR: prototype not found: ${protoPath}`); process.exit(2); }

function dirname(p) { return (p || '').replace(/\/[^/]*$/, '') || '.'; }

// Build basename(localPath) -> absolute src from every page capture's `media` list.
function buildAssetUrlMap() {
  const map = new Map();
  const pagesDir = `${workdir}/stardust/current/pages`;
  if (!fs.existsSync(pagesDir)) return map;
  let files = [];
  try { files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.json')); } catch { return map; }
  for (const f of files) {
    let page;
    try { page = JSON.parse(fs.readFileSync(`${pagesDir}/${f}`, 'utf8')); } catch { continue; }
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
        if (typeof localPath === 'string' && localPath) {
          const base = localPath.split('/').pop();
          if (base && !map.has(base)) map.set(base, src);
        }
      }
    }
  }
  return map;
}

// Rewrite local assets/media refs → absolute src. Unmapped refs left untouched (nothing
// silently disappears). Covers src= and href=.
function rewriteAssetUrls(html, urlMap) {
  if (!urlMap.size) return { html, rewritten: 0 };
  let rewritten = 0;
  const out = html.replace(
    /(src|href)=("|')([^"']*?assets\/media\/([^"'?#]+)[^"']*)\2/gi,
    (whole, attr, q, _full, name) => {
      const orig = urlMap.get(name);
      if (orig) { rewritten += 1; return `${attr}=${q}${orig}${q}`; }
      return whole;
    },
  );
  return { html: out, rewritten };
}

// Inline lenis.min.{js,css} (siblings of the prototype) into a cinematic prototype.
function inlineLenis(html, protoDir) {
  let out = html;
  try {
    const js = fs.readFileSync(`${protoDir}/lenis.min.js`, 'utf8');
    out = out.replace(/<script[^>]*src=["'][^"']*lenis\.min\.js["'][^>]*>\s*<\/script>/i, `<script>${js}</script>`);
  } catch { /* no lenis js — leave as-is */ }
  try {
    const css = fs.readFileSync(`${protoDir}/lenis.min.css`, 'utf8');
    out = out.replace(/<link[^>]*href=["'][^"']*lenis\.min\.css["'][^>]*>/i, `<style>${css}</style>`);
  } catch { /* no lenis css */ }
  return out;
}

let html = fs.readFileSync(protoPath, 'utf8');
let lenisInlined = false;
if (/cinematic/.test(protoPath)) { const before = html; html = inlineLenis(html, dirname(protoPath)); lenisInlined = (html !== before); }
const r = rewriteAssetUrls(html, buildAssetUrlMap());

const out = protoPath.replace(/\.html$/i, '') + '.forge.html';
fs.writeFileSync(out, r.html);
console.log(JSON.stringify({ out, rewritten: r.rewritten, lenisInlined }));
