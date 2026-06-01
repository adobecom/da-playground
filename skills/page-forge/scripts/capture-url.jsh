// capture-url.jsh — render a live URL and capture CLEAN, self-contained 1:1 bespoke HTML.
// SLICC port of forge's page-forge/server/eds/fetch-url.js (the DA tool's URL Match capture).
//
// WHY (the bug this fixes): Match·URL must NOT return the raw post-hydration DOM. SLICC's scoop
// grabbed the full rendered page (264KB incl. Milo runtime, lazy scripts, lifecycle hide-body
// guards) — that won't render in the panel's srcdoc iframe (scripts stripped → body stays hidden,
// external deps fail) and can't be snowflaked. DA renders the page, then strips scripts/iframes/
// preload, removes the Milo lifecycle guards + gnav/footer chrome, and ABSOLUTIZES every URL so the
// captured HTML is self-contained. This does exactly that.
//
// SLICC .jsh runtime: uses the `browser` global (verified in SLICC source: browserBridge).
//   browser.ensureTab(url)            → opens/navigates a tab, returns a TabHandle
//   browser.evalAsync(tab, asyncFn)   → runs a REAL async function in the page (no shell quoting of
//                                       the script — the regex `$` anchors would break a string eval)
//                                       and returns its value (returnByValue). setTimeout runs in the
//                                       page context, so hydration waits happen page-side.
//
// Usage:  capture-url.jsh <url> <out-file>

const url = process.argv[2];
const out = process.argv[3];
if (!url || !out) { console.error('usage: capture-url.jsh <url> <out-file>'); process.exit(1); }
const MAX_HTML_BYTES = 25 * 1024 * 1024;

const tab = await browser.ensureTab(url);

// Render + clean in one in-page async eval. Mirrors fetch-url.js's page.evaluate body.
const html = await browser.evalAsync(tab, async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Wait for hydration: readyState complete, then settle for Milo lazy blocks.
  for (let i = 0; i < 40 && document.readyState !== 'complete'; i += 1) await sleep(250);
  await sleep(2500);

  document.querySelectorAll('script, noscript, iframe, link[rel="preload"], link[rel="prefetch"]').forEach((n) => n.remove());
  document.querySelectorAll('meta[http-equiv], meta[name^="adobe"], meta[name^="ga"]').forEach((n) => n.remove());

  // Strip Milo/Helix lifecycle artifacts so the re-served page isn't stuck hidden.
  document.querySelectorAll('style').forEach((el) => {
    if (/body\s*\{[^}]*display\s*:\s*none/i.test(el.textContent || '')) el.remove();
  });
  const LIFECYCLE = ['lenis', 'lenis-stopped', 'lenis-smooth', 'lenis-scrolling', 'lenis-stop',
    'disable-scroll', 'no-scroll', 'is-loading', 'is-Loaded', 'is-loaded', 'pre-load', 'preload', 'hide-until-load'];
  [document.documentElement, document.body].forEach((el) => { if (el) LIFECYCLE.forEach((c) => el.classList.remove(c)); });
  if (document.body) {
    const s = document.body.getAttribute('style');
    if (s && /display\s*:\s*none/i.test(s)) {
      const cleaned = s.replace(/display\s*:\s*none\s*;?/ig, '').trim();
      if (cleaned) document.body.setAttribute('style', cleaned); else document.body.removeAttribute('style');
    }
  }

  // Drop Milo gnav/footer chrome (JS-driven; renders as a broken blob without scripts). Self-gating.
  const MILO_CHROME = '.global-navigation, .global-footer, [class*="feds-"], nav[data-lenis-prevent]';
  document.querySelectorAll('body > header, body > footer').forEach((el) => {
    if (el.matches(MILO_CHROME) || el.querySelector(MILO_CHROME)) el.remove();
  });

  // Absolutize every URL against the live baseURI so the captured HTML is self-contained.
  const base = document.baseURI;
  const abs = (rel) => {
    if (!rel) return rel;
    const v = rel.trim();
    if (!v) return v;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|data:|#)/i.test(v)) return v;
    try { return new URL(v, base).href; } catch { return rel; }
  };
  const absSrcset = (val) => val.split(',').map((part) => {
    const m = part.trim().match(/^(\S+)(\s+\S+)?$/);
    return m ? abs(m[1]) + (m[2] || '') : part;
  }).join(', ');
  document.querySelectorAll('img').forEach((el) => {
    if (el.hasAttribute('src')) el.setAttribute('src', abs(el.getAttribute('src')));
    if (el.hasAttribute('srcset')) el.setAttribute('srcset', absSrcset(el.getAttribute('srcset')));
  });
  document.querySelectorAll('source').forEach((el) => {
    if (el.hasAttribute('src')) el.setAttribute('src', abs(el.getAttribute('src')));
    if (el.hasAttribute('srcset')) el.setAttribute('srcset', absSrcset(el.getAttribute('srcset')));
  });
  document.querySelectorAll('a[href], link[href]').forEach((el) => {
    const v = el.getAttribute('href');
    if (v && !/^(?:#|mailto:|tel:|javascript:)/i.test(v)) el.setAttribute('href', abs(v));
  });
  document.querySelectorAll('video, audio, track').forEach((el) => {
    if (el.hasAttribute('src')) el.setAttribute('src', abs(el.getAttribute('src')));
    if (el.hasAttribute('poster')) el.setAttribute('poster', abs(el.getAttribute('poster')));
  });
  const URL_FN = /url\((\s*)(['"]?)([^'")]+)\2(\s*)\)/g;
  const absStyle = (css) => css.replace(URL_FN, (_, a, q, u, b) => 'url(' + a + q + abs(u) + q + b + ')');
  document.querySelectorAll('[style]').forEach((el) => {
    const s = el.getAttribute('style');
    if (s && s.includes('url(')) el.setAttribute('style', absStyle(s));
  });
  document.querySelectorAll('style').forEach((el) => {
    if (el.textContent && el.textContent.includes('url(')) el.textContent = absStyle(el.textContent);
  });

  return '<!doctype html>\n' + document.documentElement.outerHTML;
});

let final = html || '';
if (!final || final.length < 200) { console.error('ERROR: capture produced no/too-little HTML — the page may not have rendered.'); process.exit(2); }
if (final.length > MAX_HTML_BYTES) final = final.slice(0, MAX_HTML_BYTES) + '\n<!-- truncated at ' + MAX_HTML_BYTES + ' bytes -->';
await fs.writeFile(out, final);
console.log(JSON.stringify({ captured: true, url, out, bytes: final.length }));
