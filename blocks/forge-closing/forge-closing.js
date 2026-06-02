/**
 * forge-closing — Full-width dark closing CTA.
 *
 * DA content shape (1 row, 1 cell):
 *   Row 0 | Col 0: h2 + p + p>a (button)
 */
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;

  const h2 = cell.querySelector('h2');
  const p = cell.querySelector('p:not(:has(a))') || cell.querySelector('p');
  const a = cell.querySelector('a');

  const inner = document.createElement('div');
  inner.className = 'closing-inner';

  if (h2) inner.append(h2);
  if (p && p !== a?.closest('p')) inner.append(p);
  if (a) {
    a.className = 'btn btn--primary';
    inner.append(a);
  }

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(inner);

  block.innerHTML = '';
  block.append(wrap);
}
