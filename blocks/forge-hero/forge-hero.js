/**
 * forge-hero — Decorate the authored rows into the bespoke hero layout.
 *
 * DA content shape (1 row, 2 cells):
 *   Row 0 | Col 0: copy  — p(eyebrow), h1, p(lede), p>a(CTA1), p>a(CTA2)
 *   Row 0 | Col 1: media — picture > img
 */
export default function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;
  const cells = [...row.querySelectorAll(':scope > div')];
  const [copyCell, mediaCell] = cells;

  // ── Copy ──────────────────────────────────────────────────────────────
  const copy = document.createElement('div');
  copy.className = 'hero__copy';

  const copyChildren = copyCell ? [...copyCell.children] : [];
  let idx = 0;

  // Eyebrow: first <p> that has no block-level children
  const firstP = copyChildren[idx];
  if (firstP && firstP.tagName === 'P' && !firstP.querySelector('a,strong,em')) {
    firstP.className = 'eyebrow';
    copy.append(firstP);
    idx++;
  }

  // H1
  const h1 = copyChildren[idx];
  if (h1 && h1.tagName === 'H1') { copy.append(h1); idx++; }

  // Lede
  const lede = copyChildren[idx];
  if (lede && lede.tagName === 'P') {
    lede.className = 'lede';
    copy.append(lede);
    idx++;
  }

  // CTAs
  const ctaWrap = document.createElement('div');
  ctaWrap.className = 'hero__cta';
  while (idx < copyChildren.length) {
    const el = copyChildren[idx++];
    const a = el.tagName === 'A' ? el : el.querySelector('a');
    if (!a) { copy.append(el); continue; }
    // First CTA → primary, second → outline
    const isPrimary = ctaWrap.children.length === 0;
    a.className = `btn ${isPrimary ? 'btn--primary' : 'btn--outline'}`;
    ctaWrap.append(a);
  }
  if (ctaWrap.children.length) copy.append(ctaWrap);

  // ── Media ─────────────────────────────────────────────────────────────
  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'hero__media';
  if (mediaCell) {
    const img = mediaCell.querySelector('img');
    if (img) {
      img.loading = 'eager';
      img.fetchpriority = 'high';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    }
    mediaWrap.append(...mediaCell.children);
  }

  // ── Grid ──────────────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'hero__grid';
  grid.append(copy, mediaWrap);

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(grid);

  block.innerHTML = '';
  block.append(wrap);
}
