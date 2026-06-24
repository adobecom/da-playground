export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: breadcrumbs (2 cells)
  const crumbRow = rows[0];
  const crumbCells = crumbRow ? [...crumbRow.children] : [];
  const breadcrumbs = document.createElement('div');
  breadcrumbs.className = 'breadcrumbs';
  crumbCells.forEach((cell, i) => {
    const a = cell.querySelector('a');
    const crumb = document.createElement(a ? 'a' : 'span');
    crumb.className = 'crumb';
    if (a) {
      crumb.href = a.href;
      crumb.textContent = a.textContent.trim();
    } else {
      crumb.textContent = cell.textContent.trim();
    }
    breadcrumbs.append(crumb);
    if (i < crumbCells.length - 1) {
      const slash = document.createElement('span');
      slash.className = 'slash';
      slash.textContent = '/';
      breadcrumbs.append(slash);
    }
  });

  // Row 1: eyebrow text (1 cell)
  const eyebrowRow = rows[1];
  const eyebrowText = eyebrowRow ? eyebrowRow.children[0]?.textContent.trim() : '';
  const heroEyebrow = document.createElement('div');
  heroEyebrow.className = 'hero-eyebrow';
  const appTile = document.createElement('span');
  appTile.className = 'app-tile';
  appTile.textContent = 'Ac';
  heroEyebrow.append(appTile, eyebrowText);

  // Row 2: headline (1 cell with h1)
  const headlineRow = rows[2];
  const headlineCell = headlineRow ? headlineRow.children[0] : null;
  const h1 = headlineCell ? headlineCell.querySelector('h1') : null;
  if (h1) h1.className = 'hero-headline';

  // Row 3: body (1 cell with p)
  const bodyRow = rows[3];
  const bodyCell = bodyRow ? bodyRow.children[0] : null;
  const p = bodyCell ? bodyCell.querySelector('p') : null;
  if (p) p.className = 'hero-body';

  // Row 4: CTA (1 cell with strong > a)
  const ctaRow = rows[4];
  const ctaCell = ctaRow ? ctaRow.children[0] : null;
  const ctaLink = ctaCell ? ctaCell.querySelector('a') : null;
  const btnPromo = document.createElement('a');
  btnPromo.className = 'btn-promo';
  if (ctaLink) {
    btnPromo.href = ctaLink.href;
    const acIcon = document.createElement('span');
    acIcon.className = 'ac-icon';
    acIcon.textContent = 'Ac';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = ctaLink.textContent.trim();
    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'arrow';
    arrowSpan.textContent = '→';
    btnPromo.append(acIcon, labelSpan, arrowSpan);
  }

  // Build .hero div
  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.append(heroEyebrow);
  if (h1) hero.append(h1);
  if (p) hero.append(p);
  hero.append(btnPromo);

  // Rows 5-14: docs (2 cells each: label + picture)
  const docs = [];
  for (let i = 5; i <= 14; i++) {
    const row = rows[i];
    if (!row) break;
    const cells = [...row.children];
    const label = cells[0] ? cells[0].textContent.trim() : '';
    const picture = cells[1] ? cells[1].querySelector('picture, img') : null;
    docs.push({ label, picture });
  }

  // 5 columns of 2 docs each, stagger classes
  const staggerClasses = [null, 'offset-down', 'offset-mid', 'offset-down', null];
  const docsGrid = document.createElement('div');
  docsGrid.className = 'docs-grid';

  for (let col = 0; col < 5; col++) {
    const docsCol = document.createElement('div');
    docsCol.className = 'docs-col';
    if (staggerClasses[col]) docsCol.classList.add(staggerClasses[col]);

    const docA = docs[col * 2];
    const docB = docs[col * 2 + 1];

    [docA, docB].forEach((doc) => {
      if (!doc) return;
      const card = document.createElement('div');
      card.className = 'doc-card';
      const thumb = document.createElement('div');
      thumb.className = 'doc-thumb';
      if (doc.picture) thumb.append(doc.picture.cloneNode(true));
      const labelSpan = document.createElement('span');
      labelSpan.textContent = doc.label;
      thumb.append(labelSpan);
      card.append(thumb);
      docsCol.append(card);
    });

    docsGrid.append(docsCol);
  }

  // Build .header-inner
  const headerInner = document.createElement('div');
  headerInner.className = 'header-inner';
  headerInner.append(breadcrumbs, hero, docsGrid);

  // Replace block content
  block.textContent = '';
  block.append(headerInner);
}
