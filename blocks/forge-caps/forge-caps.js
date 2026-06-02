/**
 * forge-caps — Capability strip (4-column light background).
 *
 * DA content shape (4 rows, 2 cells each):
 *   Row N | Col 0: cap number text ("01", "02", …)
 *   Row N | Col 1: cap heading text
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  const row = document.createElement('div');
  row.className = 'caps__row';

  rows.forEach((r) => {
    const cells = [...r.querySelectorAll(':scope > div')];
    const [numCell, headCell] = cells;

    const cap = document.createElement('div');
    cap.className = 'cap';

    const numEl = document.createElement('div');
    numEl.className = 'cap__n';
    numEl.textContent = numCell ? numCell.textContent.trim() : '';

    const h3 = document.createElement('h3');
    h3.textContent = headCell ? headCell.textContent.trim() : '';

    cap.append(numEl, h3);
    row.append(cap);
  });

  // sr-only h2 for accessibility
  const srH2 = document.createElement('h2');
  srH2.className = 'sr-only';
  srH2.textContent = 'What you can do with Adobe Express';

  block.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(srH2, row);
  block.append(wrap);
}
