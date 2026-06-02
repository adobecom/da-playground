/**
 * forge-capability-strip block
 * DA rows (positional):
 *   0–3 — one row per capability: number text | heading text
 */
export default function decorate(block) {
  const rows = [...block.children];

  const caps = rows.map((row) => {
    const cells = [...row.children];
    const num = cells[0]?.textContent?.trim() || '';
    const heading = cells[1]?.textContent?.trim() || cells[0]?.textContent?.trim() || '';
    return { num, heading };
  });

  const row = document.createElement('div');
  row.className = 'caps__row';

  caps.forEach(({ num, heading }, i) => {
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.setAttribute('data-anim', '');

    const n = document.createElement('div');
    n.className = 'cap__n';
    n.textContent = num || String(i + 1).padStart(2, '0');

    const h = document.createElement('h3');
    h.textContent = heading;

    cap.append(n, h);
    row.append(cap);
  });

  /* Screen-reader heading */
  const srH2 = document.createElement('h2');
  srH2.className = 'sr-only';
  srH2.textContent = 'What you can do with Adobe Express';

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(srH2, row);

  block.textContent = '';
  block.append(wrap);
}
