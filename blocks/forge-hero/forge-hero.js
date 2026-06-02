/**
 * forge-hero block
 * DA rows (positional):
 *   0 — hero image (img/picture)
 *   1 — eyebrow text
 *   2 — h1 heading
 *   3 — lede paragraph
 *   4 — CTA links (primary first, secondary second)
 */

function initAnimationEngine() {
  if (window.__forgeAnimInit) return;
  window.__forgeAnimInit = true;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Lenis-compatible shim ── */
  if (!window.Lenis) {
    (function (g) {
      function Lenis() {
        this._cbs = [];
        const self = this;
        this._onScroll = function () {
          const s = self.scroll;
          for (let i = 0; i < self._cbs.length; i++) self._cbs[i]({ scroll: s });
        };
        window.addEventListener('scroll', this._onScroll, { passive: true });
        document.documentElement.classList.add('lenis', 'lenis-smooth');
      }
      Object.defineProperty(Lenis.prototype, 'scroll', {
        get() { return window.scrollY || window.pageYOffset || 0; },
      });
      Lenis.prototype.raf = function () {};
      Lenis.prototype.on = function (ev, cb) { if (ev === 'scroll') this._cbs.push(cb); };
      Lenis.prototype.stop = function () {};
      Lenis.prototype.start = function () {};
      Lenis.prototype.destroy = function () { window.removeEventListener('scroll', this._onScroll); };
      g.Lenis = Lenis;
    }(window));
  }

  const lenis = new window.Lenis({ lerp: 0.1, smoothWheel: !prefersReducedMotion });
  window.__lenis = lenis;
  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }(performance.now()));

  const nav = document.getElementById('gnav');
  if (nav) lenis.on('scroll', ({ scroll }) => { nav.classList.toggle('scrolled', scroll > 40); });

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const easeOut3 = (t) => 1 - (1 - t) ** 3;
  const getDocTop = (el) => el.getBoundingClientRect().top + (window.__lenis ? window.__lenis.scroll : window.scrollY);

  const animConfig = {
    parallax: { translate: 35, fade: 0.55, rangeStart: 0, range: 80 },
    plansParallax: { translate: 16, rangeStart: 0, range: 80 },
    cards: { trigger: 0.85, range: 0.32, slide: 40, stagger: 0.12 },
    wordmark: { range: 0.6, clip: 80 },
  };

  const animList = [];
  let wordmarkEl = null;
  let wordmarkTop = 0;

  function measure() {
    if (prefersReducedMotion) return;
    const postHeroEl = document.querySelector('.post-hero');
    const saved = postHeroEl ? postHeroEl.style.transform : '';
    if (postHeroEl) postHeroEl.style.transform = '';
    animList.forEach(({ el }) => { el.style.opacity = el.style.transform = el.style.willChange = ''; });
    animList.length = 0;
    document.querySelectorAll('[data-anim]').forEach((el) => {
      const parent = el.closest('.section');
      let stagger = 0;
      if (parent) {
        const peers = parent.querySelectorAll('[data-anim]');
        const idx = [...peers].indexOf(el);
        stagger = (idx % 8) * animConfig.cards.stagger;
      }
      el.style.opacity = '0';
      el.style.transform = `translateY(${animConfig.cards.slide}px)`;
      el.style.willChange = 'opacity, transform';
      animList.push({ el, triggerTop: getDocTop(el), staggerDelay: stagger });
    });
    wordmarkEl = document.querySelector('.site-footer__wordmark');
    if (wordmarkEl) {
      wordmarkTop = getDocTop(wordmarkEl);
      wordmarkEl.style.clipPath = `inset(${animConfig.wordmark.clip}% 0 0 0)`;
      wordmarkEl.style.willChange = 'clip-path';
    }
    if (postHeroEl) postHeroEl.style.transform = saved;
  }

  let _lastMB = null;

  (function tick() {
    if (prefersReducedMotion) { requestAnimationFrame(tick); return; }
    const sY = window.__lenis ? window.__lenis.scroll : window.scrollY;
    const vh = window.innerHeight;
    const isDesktop = window.innerWidth > 767;

    const heroMarqueeEl = document.querySelector('.hero-marquee');
    const postHeroEl = document.querySelector('.post-hero');

    if (heroMarqueeEl) {
      const pp = animConfig.parallax;
      if (isDesktop) {
        const rs = (pp.rangeStart / 100) * vh;
        const re = (pp.range / 100) * vh;
        const p = easeOut3(clamp((sY - rs) / (re - rs), 0, 1));
        heroMarqueeEl.style.transform = `translateY(${p * -pp.translate}vh)`;
        document.documentElement.style.setProperty('--parallax-progress', p);
      } else {
        heroMarqueeEl.style.transform = '';
        document.documentElement.style.setProperty('--parallax-progress', 0);
      }
    }

    let postHeroOffsetPx = 0;
    if (postHeroEl) {
      const pp2 = animConfig.plansParallax;
      if (isDesktop) {
        const rs = (pp2.rangeStart / 100) * vh;
        const re = (pp2.range / 100) * vh;
        const p = easeOut3(clamp((sY - rs) / (re - rs), 0, 1));
        postHeroOffsetPx = (p * -pp2.translate) / 100 * vh;
        postHeroEl.style.transform = `translateY(${p * -pp2.translate}vh)`;
        const newMB = `${p * -pp2.translate}vh`;
        if (newMB !== _lastMB) { postHeroEl.style.marginBottom = newMB; _lastMB = newMB; }
      } else {
        postHeroEl.style.transform = '';
        if (_lastMB !== '') { postHeroEl.style.marginBottom = ''; _lastMB = ''; }
      }
    }

    for (let i = 0; i < animList.length; i++) {
      const item = animList[i];
      const { trigger, range, slide } = animConfig.cards;
      const raw = (sY + vh * trigger - (item.triggerTop + postHeroOffsetPx)) / (vh * range);
      const p = easeOut3(clamp(raw - item.staggerDelay, 0, 1));
      item.el.style.opacity = String(p);
      item.el.style.transform = `translateY(${(1 - p) * slide}px)`;
    }

    if (wordmarkEl) {
      const adjustedTop = wordmarkTop + postHeroOffsetPx;
      const wP = easeOut3(clamp((sY + vh - adjustedTop) / (vh * animConfig.wordmark.range), 0, 1));
      wordmarkEl.style.clipPath = `inset(${(1 - wP) * animConfig.wordmark.clip}% 0 0 0)`;
    }
    requestAnimationFrame(tick);
  }());

  measure();
  window.addEventListener('load', () => requestAnimationFrame(measure), { once: true });
  window.addEventListener('resize', measure, { passive: true });

  if (prefersReducedMotion) {
    document.querySelectorAll('[data-anim]').forEach((el) => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    if (wordmarkEl) wordmarkEl.style.clipPath = 'none';
  }
}

export default function decorate(block) {
  const rows = [...block.children];
  const imgRow = rows[0];
  const eyebrowRow = rows[1];
  const headingRow = rows[2];
  const ledeRow = rows[3];
  const ctaRow = rows[4];

  const img = imgRow?.querySelector('img');
  if (img) { img.loading = 'eager'; img.fetchpriority = 'high'; }
  const picture = imgRow?.querySelector('picture') || img;

  const eyebrowText = eyebrowRow?.textContent?.trim() || '';
  const h1 = headingRow?.querySelector('h1, h2, h3');
  if (h1 && h1.tagName !== 'H1') {
    const h = document.createElement('h1');
    h.textContent = h1.textContent;
    h1.replaceWith(h);
  }
  const ledeText = ledeRow?.textContent?.trim() || '';
  const ctaLinks = [...(ctaRow?.querySelectorAll('a') || [])];

  /* Build DOM */
  const grid = document.createElement('div');
  grid.className = 'hero__grid';

  const copy = document.createElement('div');
  copy.className = 'hero__copy';

  if (eyebrowText) {
    const p = document.createElement('p');
    p.className = 'eyebrow';
    p.textContent = eyebrowText;
    copy.append(p);
  }

  const freshH1 = block.querySelector('h1') || (() => {
    const h = document.createElement('h1');
    h.textContent = headingRow?.textContent?.trim() || '';
    return h;
  })();
  copy.append(freshH1);

  if (ledeText) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = ledeText;
    copy.append(p);
  }

  const ctaDiv = document.createElement('div');
  ctaDiv.className = 'hero__cta';
  ctaLinks.forEach((a, i) => {
    const link = document.createElement('a');
    link.href = a.href;
    link.textContent = a.textContent;
    link.className = 'btn ' + (i === 0 ? 'btn--primary' : 'btn--outline');
    ctaDiv.append(link);
  });
  copy.append(ctaDiv);
  grid.append(copy);

  const media = document.createElement('div');
  media.className = 'hero__media hero-marquee';
  if (picture) media.append(picture);
  grid.append(media);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(grid);

  block.textContent = '';
  block.append(wrap);

  /* Kick off the shared animation engine */
  initAnimationEngine();
}
