/**
 * forge-plans — Compare plans (dark, 3-column).
 *
 * DA content shape:
 *   Row 0  | Col 0: section h2
 *   Row 1  | Col 0: plan 1 (h3 + p + a)  | Col 1: plan 2  | Col 2: plan 3
 *   Row 2  | Col 0: footnote link
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Section head
  const sectionHead = document.createElement('div');
  sectionHead.className = 'section-head';
  const headCell = rows[0]?.querySelector(':scope > div');
  if (headCell) {
    const h2 = headCell.querySelector('h2') || document.createElement('h2');
    if (!h2.textContent) h2.textContent = headCell.textContent.trim();
    sectionHead.append(h2);
  }

  // Plans grid
  const grid = document.createElement('div');
  grid.className = 'plans__grid';

  const planRow = rows[1];
  if (planRow) {
    const planCells = [...planRow.querySelectorAll(':scope > div')];
    planCells.forEach((cell, i) => {
      const plan = document.createElement('div');
      plan.className = 'plan';

      const h3 = cell.querySelector('h3');
      const p = cell.querySelector('p:not(:has(a))') || cell.querySelector('p');
      const a = cell.querySelector('a');

      if (h3) plan.append(h3);
      if (p && p !== a?.closest('p')) plan.append(p);
      if (a) {
        // First plan → primary, others → ghost
        a.className = `btn ${i === 0 ? 'btn--primary' : 'btn--ghost'}`;
        plan.append(a);
      }

      grid.append(plan);
    });
  }

  // Footnote
  const footnote = document.createElement('p');
  footnote.className = 'plans-footnote';
  const footRow = rows[2];
  if (footRow) {
    const footCell = footRow.querySelector(':scope > div');
    const a = footCell?.querySelector('a');
    if (a) {
      a.style.fontWeight = '700';
      footnote.append(a);
    }
  }

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(sectionHead, grid);
  if (footnote.children.length) wrap.append(footnote);

  block.innerHTML = '';
  block.append(wrap);
}
