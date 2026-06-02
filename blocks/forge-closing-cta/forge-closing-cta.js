/**
 * forge-closing-cta block
 * DA rows (positional):
 *   0 — h2 heading
 *   1 — body paragraph
 *   2 — CTA link
 */
export default function decorate(block) {
  const rows = [...block.children];
  const headingRow = rows[0];
  const bodyRow = rows[1];
  const ctaRow = rows[2];

  const h2 = document.createElement('h2');
  h2.textContent = headingRow?.textContent?.trim() || '';

  const p = document.createElement('p');
  p.textContent = bodyRow?.textContent?.trim() || '';

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.setAttribute('data-anim', '');
  wrap.append(h2, p);

  const linkEl = ctaRow?.querySelector('a');
  if (linkEl) {
    const a = document.createElement('a');
    a.href = linkEl.href;
    a.textContent = linkEl.textContent;
    a.className = 'btn btn--primary';
    wrap.append(a);
  }

  block.textContent = '';
  block.append(wrap);
}
