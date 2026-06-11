// Mosaic column configuration: maps to DA rows 4-8 in order.
// Each entry defines the CSS class and card heights for that column.
const MOSAIC_CONFIG = [
  { cls: 'mcol-2', heights: [394, 292, 393] }, // row 4
  { cls: 'mcol-1', heights: [291, 292, 394] }, // row 5
  { cls: 'mcol-4', heights: [291, 394] },       // row 6
  { cls: 'mcol-5', heights: [291, 394, 393] },  // row 7
  { cls: 'mcol-3', heights: [291, 292, 392] },  // row 8
];

const PROMO_CHEVRON_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M3 2l4 3-4 3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Extract the first <img> element from a cell div, or null if none.
 */
function extractImg(cell) {
  return cell?.querySelector('img') ?? null;
}

/**
 * Build an <img> element cloned from source img, or an empty placeholder div.
 */
function buildImg(imgEl) {
  if (!imgEl) return document.createElement('div');
  const img = imgEl.cloneNode(true);
  return img;
}

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // Helper: get all cell divs from a row
  const getCells = (rowIndex) => {
    const row = rows[rowIndex];
    if (!row) return [];
    return [...row.querySelectorAll(':scope > div')];
  };

  // Row 0 — eyebrow text
  const eyebrowText = getCells(0)[0]?.textContent?.trim() ?? '';

  // Row 1 — h1 (may contain an <h1> element or plain text)
  const h1Cell = getCells(1)[0];
  let h1Html = '';
  if (h1Cell) {
    const h1El = h1Cell.querySelector('h1');
    if (h1El) {
      // Preserve inner content; convert newlines to <br>
      h1Html = h1El.innerHTML.replace(/\n/g, '<br>');
    } else {
      h1Html = (h1Cell.textContent ?? '').trim().replace(/\n/g, '<br>');
    }
  }

  // Row 2 — body paragraph
  const bodyCell = getCells(2)[0];
  const bodyHtml = bodyCell?.innerHTML?.trim() ?? '';

  // Row 3 — promo icon img | promo text
  const promoCells = getCells(3);
  const promoIconImg = extractImg(promoCells[0]);
  const promoText = promoCells[1]?.textContent?.trim() ?? '';

  // Rows 4-8 — mosaic columns (5 rows, matching MOSAIC_CONFIG)
  const mosaicCols = MOSAIC_CONFIG.map(({ cls, heights }, i) => {
    const cells = getCells(4 + i);
    const cards = heights.map((h, j) => {
      const imgEl = extractImg(cells[j]);
      const img = buildImg(imgEl);
      const card = document.createElement('div');
      card.className = 'mcard';
      card.style.height = `${h}px`;
      card.appendChild(img);
      return card;
    });
    return { cls, cards };
  });

  // Build promo icon element
  const promoIconEl = document.createElement('div');
  promoIconEl.className = 'hero-promo-acrobat';
  if (promoIconImg) {
    promoIconEl.appendChild(promoIconImg.cloneNode(true));
  }

  // Build the hero section
  const section = document.createElement('section');
  section.className = 'hero';

  // --- hero-copy ---
  const heroCopy = document.createElement('div');
  heroCopy.className = 'hero-copy';

  const eyebrowWrap = document.createElement('div');
  eyebrowWrap.className = 'hero-eyebrow-wrap';
  const eyebrowP = document.createElement('p');
  eyebrowP.className = 'hero-eyebrow';
  eyebrowP.textContent = eyebrowText;
  eyebrowWrap.appendChild(eyebrowP);

  const h1 = document.createElement('h1');
  h1.className = 'hero-h1';
  h1.innerHTML = h1Html;

  const bodyP = document.createElement('p');
  bodyP.className = 'hero-body';
  bodyP.innerHTML = bodyHtml;

  // Promo bar
  const promo = document.createElement('div');
  promo.className = 'hero-promo';

  const promoInner = document.createElement('div');
  promoInner.className = 'hero-promo-inner';
  promoInner.appendChild(promoIconEl);

  const promoSpan = document.createElement('span');
  promoSpan.className = 'hero-promo-text';
  promoSpan.textContent = promoText;
  promoInner.appendChild(promoSpan);

  const promoBtn = document.createElement('div');
  promoBtn.className = 'hero-promo-btn';
  promoBtn.innerHTML = PROMO_CHEVRON_SVG;

  promo.appendChild(promoInner);
  promo.appendChild(promoBtn);

  heroCopy.appendChild(eyebrowWrap);
  heroCopy.appendChild(h1);
  heroCopy.appendChild(bodyP);
  heroCopy.appendChild(promo);

  // --- hero-mosaic ---
  const mosaic = document.createElement('div');
  mosaic.className = 'hero-mosaic';
  mosaic.setAttribute('aria-hidden', 'true');

  mosaicCols.forEach(({ cls, cards }) => {
    const col = document.createElement('div');
    col.className = `mcol ${cls}`;
    cards.forEach((card) => col.appendChild(card));
    mosaic.appendChild(col);
  });

  section.appendChild(heroCopy);
  section.appendChild(mosaic);

  // Replace block content with the built section
  block.innerHTML = '';
  block.appendChild(section);
}
