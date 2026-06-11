// Hardcoded feature data per card (index matches card order: Reader, Express, Pro, Studio)
const CARD_FEATURES = [
  // Acrobat Reader
  [
    { hd: 'Basic PDF tools', items: ['View, Print, Share PDFs'] },
  ],
  // Acrobat Express
  [
    { hd: 'AI Assistant', items: ['Get AI summaries, insights, and answers', 'Organize, share, and share with PDF Spaces'] },
    { hd: 'Creation tools', items: ['Create flyers, social content, and presentations from documents'] },
  ],
  // Acrobat Pro
  [
    { hd: '70+ PDF tools', items: [
      'Create, edit, convert, export, compare, and organize PDFs',
      'Collect e-signatures and track responses',
      'Password-protect and redact PDFs',
      'Create, fill, sign, and send forms',
      'Create web forms, turn scans into editable PDFs, and access 70+ features',
    ] },
  ],
  // Acrobat Studio (featured)
  [
    { hd: '70+ PDF tools', items: ['Get all the PDF tools in Acrobat Pro'] },
    { hd: 'AI Assistant', items: [
      'Ask AI to edit, convert, or compress PDFs',
      'Get AI summaries, insights, and answers',
      'Organize, share, and share with PDF Spaces',
    ] },
    { hd: 'Creation tools', items: ['Create flyers, social content, and presentations from documents'] },
  ],
];

// Which card index is "featured"
const FEATURED_INDEX = 3;

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  const getCells = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row) return [];
    return [...row.querySelectorAll(':scope > div')];
  };

  // Row 0: h2 title (1 cell)
  const titleCell = getCells(0)[0];
  let titleHtml = '';
  if (titleCell) {
    const h2El = titleCell.querySelector('h2');
    titleHtml = h2El ? h2El.innerHTML : titleCell.textContent.trim();
  }

  // Row 1: tab labels (3 cells)
  const tabLabels = getCells(1).map((c) => c.textContent.trim());

  // Row 2: card mnemonic images (4 cells — one picture per card)
  const mnemonicImgs = getCells(2).map((c) => c.querySelector('picture, img')?.cloneNode(true) ?? null);

  // Row 3: card mnemonic labels (4 cells)
  const mnemonicLabels = getCells(3).map((c) => c.textContent.trim());

  // Row 4: card names (4 cells)
  const cardNames = getCells(4).map((c) => c.textContent.trim());

  // Row 5: card descriptions (4 cells)
  const cardDescs = getCells(5).map((c) => c.textContent.trim());

  // Row 6: prices (4 cells)
  const cardPrices = getCells(6).map((c) => c.textContent.trim());

  // Row 7: price notes (4 cells)
  const cardPriceNotes = getCells(7).map((c) => c.textContent.trim());

  // Row 8: CTAs — each cell may have multiple <p> elements or newline-separated text
  const cardCtas = getCells(8).map((c) => {
    const ps = c.querySelectorAll('p');
    if (ps.length > 1) {
      return [...ps].map((p) => p.textContent.trim()).filter(Boolean);
    }
    const text = c.textContent.trim();
    return text.split('\n').map((t) => t.trim()).filter(Boolean);
  });

  // Row 9: secure icons (4 cells — picture elements)
  const secureImgs = getCells(9).map((c) => c.querySelector('picture, img')?.cloneNode(true) ?? null);

  // --- Build DOM ---

  const plansSection = document.createElement('div');
  plansSection.className = 'plans-section';

  const plansCard = document.createElement('div');
  plansCard.className = 'plans-card';

  // H2
  const h2 = document.createElement('h2');
  h2.className = 'plans-h2';
  h2.innerHTML = titleHtml;
  plansCard.appendChild(h2);

  // Tabs
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'plans-tabs';
  tabsDiv.setAttribute('role', 'tablist');

  const tabButtons = tabLabels.map((label, i) => {
    const btn = document.createElement('button');
    btn.className = 'ptab' + (i === 0 ? ' active' : '');
    btn.setAttribute('role', 'tab');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
    tabsDiv.appendChild(btn);
    return btn;
  });
  plansCard.appendChild(tabsDiv);

  // Grid
  const grid = document.createElement('div');
  grid.className = 'plans-grid';
  grid.setAttribute('role', 'tabpanel');

  const numCards = Math.max(mnemonicImgs.length, cardNames.length, 4);

  for (let i = 0; i < numCards; i++) {
    const isFeatured = i === FEATURED_INDEX;
    const features = CARD_FEATURES[i] ?? [];
    const ctaList = cardCtas[i] ?? [];

    const pcard = document.createElement('div');
    pcard.className = 'pcard' + (isFeatured ? ' featured' : '');

    // --- pcard-top ---
    const pcardTop = document.createElement('div');
    pcardTop.className = 'pcard-top';

    // Mnemonic row
    const mnemonicDiv = document.createElement('div');
    mnemonicDiv.className = 'pcard-mnemonic';
    if (mnemonicImgs[i]) mnemonicDiv.appendChild(mnemonicImgs[i]);
    const mnemonicLbl = document.createElement('span');
    mnemonicLbl.className = 'pcard-mnem-lbl';
    mnemonicLbl.textContent = mnemonicLabels[i] ?? '';
    mnemonicDiv.appendChild(mnemonicLbl);
    pcardTop.appendChild(mnemonicDiv);

    // Name + desc
    const nameDescDiv = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'pcard-name';
    nameSpan.textContent = cardNames[i] ?? '';
    const descP = document.createElement('p');
    descP.className = 'pcard-desc';
    descP.textContent = cardDescs[i] ?? '';
    nameDescDiv.appendChild(nameSpan);
    nameDescDiv.appendChild(descP);
    pcardTop.appendChild(nameDescDiv);

    // Price + CTA + secure
    const pricingDiv = document.createElement('div');

    const priceBlock = document.createElement('div');
    const priceEl = document.createElement('div');
    priceEl.className = 'pcard-price';
    priceEl.textContent = cardPrices[i] ?? '';
    const priceNote = document.createElement('div');
    priceNote.className = 'pcard-price-note';
    priceNote.textContent = cardPriceNotes[i] ?? '';
    priceBlock.appendChild(priceEl);
    priceBlock.appendChild(priceNote);
    pricingDiv.appendChild(priceBlock);

    // CTA buttons
    const ctaRow = document.createElement('div');
    ctaRow.className = 'pcard-ctarow';
    ctaList.forEach((label, j) => {
      const btn = document.createElement('button');
      // If 2 CTAs: first = accent (Free trial), second = outline (Learn more)
      // If 1 CTA: outline (e.g. Get free app for Reader)
      if (ctaList.length > 1 && j === 0) {
        btn.className = 'pbtn pbtn-accent';
      } else {
        btn.className = 'pbtn pbtn-outline';
      }
      btn.textContent = label;
      ctaRow.appendChild(btn);
    });
    pricingDiv.appendChild(ctaRow);

    // Secure icon
    const secureDiv = document.createElement('div');
    secureDiv.className = 'pcard-secure';
    if (secureImgs[i]) secureDiv.appendChild(secureImgs[i]);
    const secureLbl = document.createElement('span');
    secureLbl.textContent = 'Secure transaction';
    secureDiv.appendChild(secureLbl);
    pricingDiv.appendChild(secureDiv);

    pcardTop.appendChild(pricingDiv);
    pcard.appendChild(pcardTop);

    // --- pcard-features ---
    const featuresDiv = document.createElement('div');
    featuresDiv.className = 'pcard-features';

    features.forEach((sect) => {
      const sectDiv = document.createElement('div');
      sectDiv.className = 'pfeat-sect';

      const hdDiv = document.createElement('div');
      hdDiv.className = 'pfeat-hd';
      const hdTxt = document.createElement('span');
      hdTxt.className = 'pfeat-hd-txt';
      hdTxt.textContent = sect.hd;
      hdDiv.appendChild(hdTxt);
      sectDiv.appendChild(hdDiv);

      sect.items.forEach((item) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'pfeat-item';
        itemDiv.textContent = item;
        sectDiv.appendChild(itemDiv);
      });

      featuresDiv.appendChild(sectDiv);
    });

    pcard.appendChild(featuresDiv);
    grid.appendChild(pcard);
  }

  plansCard.appendChild(grid);

  // Compare button
  const compareBtn = document.createElement('button');
  compareBtn.className = 'plans-compare-btn';
  compareBtn.textContent = 'Compare Plans';
  plansCard.appendChild(compareBtn);

  plansSection.appendChild(plansCard);

  block.innerHTML = '';
  block.appendChild(plansSection);
}
