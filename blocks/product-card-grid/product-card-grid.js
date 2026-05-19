export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Separate hero row (single cell) from card rows (two cells: icon | content)
  const heroRows = [];
  const cardRows = [];

  rows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    if (cells.length <= 1) {
      heroRows.push(row);
    } else {
      cardRows.push(row);
    }
  });

  block.innerHTML = '';

  // ── Hero section ─────────────────────────────────────────────
  if (heroRows.length) {
    const hero = document.createElement('div');
    hero.className = 'product-card-grid-hero';

    const inner = document.createElement('div');
    inner.className = 'product-card-grid-hero-inner';

    heroRows.forEach((row) => {
      const cell = row.querySelector(':scope > div') || row;
      [...cell.childNodes].forEach((node) => inner.append(node));
    });

    // Collect all links into a dedicated actions container
    const links = [...inner.querySelectorAll('a')];
    if (links.length) {
      const actions = document.createElement('div');
      actions.className = 'product-card-grid-hero-actions';
      const parents = [...new Set(links.map((a) => a.closest('p') || a))];
      parents.forEach((node) => actions.append(node));
      inner.append(actions);
    }

    hero.append(inner);
    block.append(hero);
  }

  // ── Card grid ─────────────────────────────────────────────────
  if (cardRows.length) {
    const gridWrap = document.createElement('div');
    gridWrap.className = 'product-card-grid-wrap';

    const grid = document.createElement('div');
    grid.className = 'product-card-grid-cards';

    cardRows.forEach((row) => {
      const cells = [...row.querySelectorAll(':scope > div')];
      const card = document.createElement('div');
      card.className = 'product-card-grid-card';

      // Icon cell — first cell
      if (cells[0]) {
        const iconWrap = document.createElement('div');
        iconWrap.className = 'product-card-grid-icon';
        [...cells[0].childNodes].forEach((node) => iconWrap.append(node));
        // Eager-load the app icon (small, above fold)
        const img = iconWrap.querySelector('img');
        if (img) img.loading = 'eager';
        card.append(iconWrap);
      }

      // Content cell — second cell (eyebrow, heading, description, optional link)
      if (cells[1]) {
        const content = document.createElement('div');
        content.className = 'product-card-grid-content';
        [...cells[1].childNodes].forEach((node) => content.append(node));

        // Mark eyebrow: first <p> that appears before the heading and has no link
        const firstP = content.querySelector('p:first-child');
        const heading = content.querySelector('h2, h3');
        if (firstP && heading && firstP !== heading && !firstP.querySelector('a')) {
          firstP.classList.add('product-card-grid-eyebrow');
        }

        // Move card CTA links into a dedicated actions container
        const links = [...content.querySelectorAll('a')];
        if (links.length) {
          const actions = document.createElement('div');
          actions.className = 'product-card-grid-card-actions';
          const parents = [...new Set(links.map((a) => a.closest('p') || a))];
          parents.forEach((node) => actions.append(node));
          content.append(actions);
        }

        card.append(content);
      }

      grid.append(card);
    });

    gridWrap.append(grid);
    block.append(gridWrap);
  }
}
