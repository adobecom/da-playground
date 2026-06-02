/**
 * forge-compare-plans block
 * DA rows (positional):
 *   0     — section heading (h2)
 *   1     — 3-cell row: plan1 | plan2 | plan3
 *           each cell contains: <h3>title</h3><p>body</p><a href>CTA</a>
 *   2     — optional compare-all link (1 cell)
 */
export default function decorate(block) {
  const rows = [...block.children];
  const headingRow = rows[0];
  const planRow = rows[1];
  const compareAllRow = rows[2];

  /* Section heading */
  const sectionHead = document.createElement('div');
  sectionHead.className = 'section-head';
  sectionHead.setAttribute('data-anim', '');

  const h2 = document.createElement('h2');
  h2.textContent = headingRow?.textContent?.trim() || '';
  sectionHead.append(h2);

  /* Plans grid */
  const grid = document.createElement('div');
  grid.className = 'plans__grid';

  const planCells = planRow ? [...planRow.children] : [];
  planCells.forEach((cell, i) => {
    const plan = document.createElement('div');
    plan.className = 'plan';
    plan.setAttribute('data-anim', '');

    const h3 = cell.querySelector('h3, h2') || document.createElement('h3');
    if (!h3.parentNode) h3.textContent = '';
    const h3El = document.createElement('h3');
    h3El.textContent = h3.textContent;
    plan.append(h3El);

    const p = cell.querySelector('p') || (() => {
      const para = document.createElement('p');
      para.textContent = '';
      return para;
    })();
    const pEl = document.createElement('p');
    pEl.textContent = p.textContent?.trim() || '';
    plan.append(pEl);

    const linkEl = cell.querySelector('a');
    if (linkEl) {
      const a = document.createElement('a');
      a.href = linkEl.href;
      a.textContent = linkEl.textContent;
      /* First plan = primary; others = ghost */
      a.className = 'btn ' + (i === 0 ? 'btn--primary' : 'btn--ghost');
      plan.append(a);
    }

    grid.append(plan);
  });

  /* Compare-all footer link */
  const compareAllLink = compareAllRow?.querySelector('a');

  const wrap = document.createElement('div');
  wrap.className = 'wrap';
  wrap.append(sectionHead, grid);

  if (compareAllLink) {
    const footer = document.createElement('p');
    footer.style.marginTop = 'var(--spacing-xl)';
    const a = document.createElement('a');
    a.href = compareAllLink.href;
    a.textContent = compareAllLink.textContent;
    a.style.fontWeight = '700';
    footer.append(a);
    wrap.append(footer);
  }

  block.textContent = '';
  block.id = 'plans';
  block.append(wrap);
}
