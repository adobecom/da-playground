function buildEyebrow(row) {
  const p = document.createElement('p');
  p.className = 'plans-eyebrow';
  p.textContent = row.children[0].textContent.trim();
  return p;
}

function buildHeadline(row) {
  const h2 = row.querySelector('h2');
  if (h2) h2.className = 'plans-headline';
  return h2;
}

function buildBody(row) {
  const p = row.querySelector('p');
  if (p) p.className = 'plans-body';
  return p;
}

function buildTabs(row) {
  const cells = [...row.children];
  // cells[0] is "tabs" key, remaining are tab labels
  const tabsEl = document.createElement('div');
  tabsEl.className = 'plans-tabs';
  cells.slice(1).forEach((cell, i) => {
    const btn = document.createElement('button');
    btn.className = 'plans-tab' + (i === 0 ? ' active' : '');
    btn.textContent = cell.textContent.trim();
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.plans-tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
    });
    tabsEl.appendChild(btn);
  });
  return tabsEl;
}

function buildPlanCard(row) {
  const cells = [...row.children];
  const cell0 = cells[0];
  const cell1 = cells[1];
  const cell2 = cells[2];
  // 4th cell (optional) signals recommended
  const isRecommended = cells.length >= 4 && /recommended/i.test(cells[3]?.textContent);

  const card = document.createElement('div');
  card.className = 'plan-card';

  if (isRecommended) {
    card.classList.add('plan-card-rec');
    const badge = document.createElement('div');
    badge.className = 'plan-badge';
    badge.textContent = 'Recommended';
    card.appendChild(badge);
  }

  // Build mnemonic (icon + eyebrow label)
  const mnemonic = document.createElement('div');
  mnemonic.className = 'plan-mnemonic';

  const picture = cell0.querySelector('picture');
  if (picture) {
    const img = picture.querySelector('img');
    if (img) img.className = 'plan-icon-img';
    mnemonic.appendChild(picture.cloneNode(true));
  }

  // Eyebrow text: from <p> in cell0 or fallback to textContent
  const eyebrowP = cell0.querySelector('p');
  const eyebrowText = eyebrowP ? eyebrowP.textContent.trim() : cell0.textContent.trim();
  if (eyebrowText) {
    const eyebrow = document.createElement('span');
    eyebrow.className = 'plan-eyebrow';
    eyebrow.textContent = eyebrowText;
    mnemonic.appendChild(eyebrow);
  }

  card.appendChild(mnemonic);

  // Parse cell1 children in order
  const c1Children = [...cell1.children];
  let idx = 0;

  function peek() { return c1Children[idx]; }
  function consume() { return c1Children[idx++]; }

  // h3 → plan-name
  if (peek() && peek().tagName === 'H3') {
    const h3 = consume();
    h3.className = 'plan-name';
    card.appendChild(h3);
  }

  // 1st p → plan-desc
  if (peek() && peek().tagName === 'P' && !peek().querySelector('strong') && !peek().querySelector('a')) {
    const desc = consume();
    desc.className = 'plan-desc';
    card.appendChild(desc);
  }

  // p with link → see-terms
  if (peek() && peek().tagName === 'P' && peek().querySelector('a')) {
    const termsP = consume();
    const a = termsP.querySelector('a');
    if (a) {
      a.className = 'plan-see-terms';
      card.appendChild(a);
    }
  }

  // p with strong → price block
  if (peek() && peek().tagName === 'P' && peek().querySelector('strong')) {
    const priceBlock = document.createElement('div');
    priceBlock.className = 'plan-price-block';

    const priceP = consume();
    const priceSpan = document.createElement('div');
    priceSpan.className = 'plan-price';
    priceSpan.textContent = priceP.querySelector('strong')?.textContent.trim() || priceP.textContent.trim();
    priceBlock.appendChild(priceSpan);

    // next p → billing
    if (peek() && peek().tagName === 'P' && !peek().querySelector('a') && !peek().querySelector('strong')) {
      const billingP = consume();
      const billing = document.createElement('div');
      billing.className = 'plan-billing';
      billing.textContent = billingP.textContent.trim();
      priceBlock.appendChild(billing);
    }

    card.appendChild(priceBlock);
  }

  // next p (fine print / subscription terms) → plan-fine
  if (peek() && peek().tagName === 'P' && !peek().querySelector('a') && !peek().querySelector('strong')) {
    const fineP = consume();
    fineP.className = 'plan-fine';
    card.appendChild(fineP);
  }

  // CTA links — collect consecutive p elements that contain only an anchor
  const ctaRow = document.createElement('div');
  ctaRow.className = 'plan-cta-row';
  let ctaCount = 0;
  while (peek() && peek().tagName === 'P' && peek().querySelector('a') && peek().children.length <= 1) {
    const ctaP = consume();
    const a = ctaP.querySelector('a');
    if (a) {
      a.className = ctaCount === 0 ? 'btn-primary' : 'btn-secondary';
      ctaRow.appendChild(a);
      ctaCount++;
    }
  }
  if (ctaCount > 0) card.appendChild(ctaRow);

  // p with "License" → license row
  if (peek() && peek().tagName === 'P' && /license/i.test(peek().textContent)) {
    const licP = consume();
    const licRow = document.createElement('div');
    licRow.className = 'plan-license-row';
    const numSpan = document.createElement('span');
    numSpan.className = 'lic-num';
    // Extract leading number if present
    const match = licP.textContent.trim().match(/^(\d+)/);
    numSpan.textContent = match ? match[1] : '1';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'lic-label';
    labelSpan.textContent = 'License';
    licRow.appendChild(numSpan);
    licRow.appendChild(labelSpan);
    card.appendChild(licRow);
  }

  // p with "Save" → plan-save
  if (peek() && peek().tagName === 'P' && /save/i.test(peek().textContent)) {
    const saveP = consume();
    saveP.className = 'plan-save';
    card.appendChild(saveP);
  }

  // p with "Secure" → plan-secure
  if (peek() && peek().tagName === 'P' && /secure/i.test(peek().textContent)) {
    const secureP = consume();
    secureP.className = 'plan-secure';
    card.appendChild(secureP);
  }

  // Remaining ps with "Add" → plan-addon checkboxes
  const addon = document.createElement('div');
  addon.className = 'plan-addon';
  while (peek() && peek().tagName === 'P' && /add/i.test(peek().textContent)) {
    const addP = consume();
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    label.appendChild(cb);
    label.appendChild(document.createTextNode(addP.textContent.trim()));
    addon.appendChild(label);
  }
  if (addon.children.length > 0) card.appendChild(addon);

  // Parse cell2 for feature sections
  if (cell2) {
    const c2Children = [...cell2.children];
    let section = null;

    c2Children.forEach((el) => {
      if (el.tagName === 'P') {
        // Bold text = section title
        const strong = el.querySelector('strong');
        if (strong) {
          section = document.createElement('div');
          section.className = 'plan-section';
          const title = document.createElement('p');
          title.className = 'plan-section-title';
          title.textContent = strong.textContent.trim();
          section.appendChild(title);
          card.appendChild(section);
        }
      } else if (el.tagName === 'UL') {
        const ul = el.cloneNode(true);
        ul.className = 'plan-feature-list';
        if (section) {
          section.appendChild(ul);
        } else {
          card.appendChild(ul);
        }
      }
    });
  }

  return card;
}

function buildCompareRow(row) {
  const compareRow = document.createElement('div');
  compareRow.className = 'plans-compare-row';
  const a = row.querySelector('a');
  if (a) {
    a.className = 'btn-secondary';
    compareRow.appendChild(a);
  }
  return compareRow;
}

export default function decorate(block) {
  const rows = [...block.children];

  const section = document.createElement('div');
  section.className = 'plans-section';

  // Row 0: eyebrow
  if (rows[0]) section.appendChild(buildEyebrow(rows[0]));

  // Row 1: headline
  if (rows[1]) {
    const h2 = buildHeadline(rows[1]);
    if (h2) section.appendChild(h2);
  }

  // Row 2: body
  if (rows[2]) {
    const p = buildBody(rows[2]);
    if (p) section.appendChild(p);
  }

  // Row 3: tabs
  if (rows[3]) section.appendChild(buildTabs(rows[3]));

  // Rows 4-7: plan cards
  const grid = document.createElement('div');
  grid.className = 'plans-grid';

  const planRows = rows.slice(4, rows.length - 1);
  planRows.forEach((row) => {
    if (row.children.length >= 2) {
      grid.appendChild(buildPlanCard(row));
    }
  });
  section.appendChild(grid);

  // Last row: compare
  if (rows[rows.length - 1]) {
    section.appendChild(buildCompareRow(rows[rows.length - 1]));
  }

  block.textContent = '';
  block.appendChild(section);
}
