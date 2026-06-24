export default function decorate(block) {
  const rows = [...block.children];

  // Row 0: eyebrow (cell 0) and headline (cell 1)
  const eyebrow = rows[0]?.children[0]?.textContent.trim() || 'Plans & Pricing';
  const headline = rows[0]?.children[1]?.innerHTML.trim() || '';
  // Row 1: body text
  const body = rows[1]?.children[0]?.innerHTML.trim() || '';
  // Row 2: tab labels (comma-separated or multiple cells)
  const tabLabels = [];
  const tabRow = rows[2];
  if (tabRow) {
    [...tabRow.children].forEach((cell) => {
      const text = cell.textContent.trim();
      if (text) tabLabels.push(text);
    });
  }
  // Rows 3 to N-1: plan cards
  // Convention: if first cell text is "recommended", it's the badge indicator
  // Cells: [badge?] | eyebrow | name | desc | price | billing | primaryCTA | secondaryCTA | features
  const planRows = rows.slice(3, rows.length - 1);
  const plans = planRows.map((row) => {
    const cells = [...row.children];
    let badge = '';
    let offset = 0;
    if (cells[0]?.textContent.trim().toLowerCase() === 'recommended') {
      badge = 'Recommended';
      offset = 1;
    }
    const planEyebrow = cells[offset + 0]?.textContent.trim() || '';
    const planName = cells[offset + 1]?.textContent.trim() || '';
    const planDesc = cells[offset + 2]?.innerHTML.trim() || '';
    const planPrice = cells[offset + 3]?.innerHTML.trim() || '';
    const planBilling = cells[offset + 4]?.textContent.trim() || '';
    const primaryCTAEl = cells[offset + 5]?.querySelector('a');
    const primaryCTA = primaryCTAEl ? { text: primaryCTAEl.textContent.trim(), href: primaryCTAEl.href } : null;
    const secondaryCTAEl = cells[offset + 6]?.querySelector('a');
    const secondaryCTA = secondaryCTAEl ? { text: secondaryCTAEl.textContent.trim(), href: secondaryCTAEl.href } : null;
    const featuresCell = cells[offset + 7];
    return {
      badge, planEyebrow, planName, planDesc, planPrice, planBilling,
      primaryCTA, secondaryCTA, features: featuresCell?.innerHTML.trim() || '',
    };
  });

  // Last row: compare link
  const lastRow = rows[rows.length - 1];
  const compareEl = lastRow?.querySelector('a');
  const compareText = compareEl?.textContent.trim() || 'Compare plans';
  const compareHref = compareEl?.href || '#';

  block.innerHTML = '';

  // Section header
  const ey = document.createElement('p');
  ey.className = 'fp-eyebrow';
  ey.textContent = eyebrow;
  block.append(ey);

  const hl = document.createElement('h2');
  hl.className = 'fp-headline';
  hl.innerHTML = headline;
  block.append(hl);

  const bd = document.createElement('p');
  bd.className = 'fp-body';
  bd.innerHTML = body;
  block.append(bd);

  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'fp-tabs';
  tabLabels.forEach((label, idx) => {
    const btn = document.createElement('button');
    btn.className = `fp-tab${idx === 0 ? ' fp-tab-active' : ''}`;
    btn.textContent = label;
    btn.type = 'button';
    btn.addEventListener('click', () => {
      tabs.querySelectorAll('.fp-tab').forEach((t) => t.classList.remove('fp-tab-active'));
      btn.classList.add('fp-tab-active');
    });
    tabs.append(btn);
  });
  block.append(tabs);

  // Plans grid
  const grid = document.createElement('div');
  grid.className = 'fp-grid';

  plans.forEach(({ badge, planEyebrow, planName, planDesc, planPrice, planBilling,
    primaryCTA, secondaryCTA, features }) => {
    const card = document.createElement('div');
    card.className = `fp-card${badge ? ' fp-card-rec' : ''}`;

    if (badge) {
      const badgeEl = document.createElement('div');
      badgeEl.className = 'fp-badge';
      badgeEl.textContent = badge;
      card.append(badgeEl);
    }

    const mnemonic = document.createElement('div');
    mnemonic.className = 'fp-mnemonic';
    mnemonic.innerHTML = `
      <span class="fp-icon-tile">Ac</span>
      <span class="fp-plan-eyebrow">${planEyebrow}</span>
    `;

    const name = document.createElement('h3');
    name.className = 'fp-plan-name';
    name.textContent = planName;

    const desc = document.createElement('p');
    desc.className = 'fp-plan-desc';
    desc.innerHTML = planDesc;

    const seeTerms = document.createElement('a');
    seeTerms.className = 'fp-see-terms';
    seeTerms.href = '#';
    seeTerms.textContent = 'See what\'s included | See terms';

    const priceBlock = document.createElement('div');
    priceBlock.className = 'fp-price-block';
    priceBlock.innerHTML = `
      <div class="fp-price">${planPrice}</div>
      <div class="fp-billing">${planBilling}</div>
    `;

    const fine = document.createElement('p');
    fine.className = 'fp-fine';
    fine.textContent = 'Annual subscription, cancel within 14 days for a full refund. Fee applies if you cancel after 14 days.';

    const ctaRow = document.createElement('div');
    ctaRow.className = 'fp-cta-row';
    if (primaryCTA) {
      const a = document.createElement('a');
      a.href = primaryCTA.href;
      a.className = 'fp-btn-primary';
      a.textContent = primaryCTA.text;
      ctaRow.append(a);
    }
    if (secondaryCTA) {
      const a = document.createElement('a');
      a.href = secondaryCTA.href;
      a.className = 'fp-btn-secondary';
      a.textContent = secondaryCTA.text;
      ctaRow.append(a);
    }

    const licRow = document.createElement('div');
    licRow.className = 'fp-license-row';
    licRow.innerHTML = `<span class="fp-lic-num">1</span><span class="fp-lic-label">License</span>`;

    const save = document.createElement('p');
    save.className = 'fp-save';
    save.textContent = 'Save 7.5% your first year with 3+ licenses. See terms';

    const secure = document.createElement('p');
    secure.className = 'fp-secure';
    secure.textContent = 'Secure transaction';

    const addon = document.createElement('div');
    addon.className = 'fp-addon';
    addon.innerHTML = `
      <label><input type="checkbox"> <span>Add Acrobat AI Assistant to your Acrobat plan for US$1.99/mo.</span></label>
      <label><input type="checkbox"> <span>Add a 30-day free trial of Adobe Stock.**</span></label>
    `;

    card.append(mnemonic, name, desc, seeTerms, priceBlock, fine, ctaRow, licRow, save, secure, addon);

    if (features) {
      const section = document.createElement('div');
      section.className = 'fp-features';
      section.innerHTML = features;
      card.append(section);
    }

    grid.append(card);
  });

  block.append(grid);

  // Compare link
  const compareRow = document.createElement('div');
  compareRow.className = 'fp-compare-row';
  const compareA = document.createElement('a');
  compareA.href = compareHref;
  compareA.className = 'fp-btn-secondary';
  compareA.textContent = compareText;
  compareRow.append(compareA);
  block.append(compareRow);
}
