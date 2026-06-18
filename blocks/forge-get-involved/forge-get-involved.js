/**
 * forge-get-involved — dark act split section
 * DA content model (2-column row):
 *   Row 0: 2 cells
 *     Cell 0 (left): h2, lead paragraph, CTA link, made-in data
 *     Cell 1 (right): list of action links (each as a p with a link)
 */

export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const mainRow = rows[0];
  const cells = [...mainRow.querySelectorAll(':scope > div')];
  const leftCell = cells[0];
  const rightCell = cells[1];

  const inner = document.createElement('div');
  inner.className = 'involved__inner';

  // --- Left column ---
  const leftCol = document.createElement('div');

  if (leftCell) {
    // h2
    const h2 = leftCell.querySelector('h2');
    if (h2) {
      const newH2 = h2.cloneNode(true);
      newH2.className = 'involved';
      leftCol.appendChild(newH2);
    }

    // Lead paragraph (first non-link p after h2)
    const allPs = [...leftCell.querySelectorAll('p')];
    let leadSet = false;
    let ctaSet = false;
    let madeInLabel = null;
    let madeInStates = null;

    allPs.forEach((p) => {
      const pLink = p.querySelector('a');
      const pText = p.textContent.trim();

      if (pText.startsWith('Proudly made in') || pText.startsWith('Made in')) {
        // This is the made-in label
        madeInLabel = pText;
      } else if (/^[A-Z]{2}(,\s*[A-Z]{2})+$/.test(pText)) {
        // State abbreviations
        madeInStates = pText;
      } else if (pLink && !ctaSet) {
        // CTA button
        const cta = document.createElement('a');
        cta.className = 'btn btn--ghost involved__cta';
        cta.href = pLink.href;
        cta.textContent = pLink.textContent.trim();
        leftCol.appendChild(cta);
        ctaSet = true;
      } else if (!pLink && !leadSet) {
        // Lead text (first text p)
        const lead = document.createElement('p');
        lead.className = 'involved__lead';
        lead.textContent = pText;
        leftCol.appendChild(lead);
        leadSet = true;
      }
    });

    // Made-in section
    if (madeInLabel || madeInStates) {
      const madeIn = document.createElement('div');
      madeIn.className = 'made-in';
      if (madeInLabel) {
        const labelEl = document.createElement('div');
        labelEl.className = 'made-in__label';
        labelEl.textContent = madeInLabel;
        madeIn.appendChild(labelEl);
      }
      if (madeInStates) {
        const statesEl = document.createElement('div');
        statesEl.className = 'made-in__states';
        statesEl.textContent = madeInStates;
        madeIn.appendChild(statesEl);
      }
      leftCol.appendChild(madeIn);
    }
  }

  // --- Right column (involved links) ---
  const rightCol = document.createElement('div');
  rightCol.className = 'involved__links';

  if (rightCell) {
    const linkEls = [...rightCell.querySelectorAll('a')];
    linkEls.forEach((link) => {
      const a = document.createElement('a');
      a.href = link.href;

      const span = document.createElement('span');
      span.textContent = link.textContent.trim();

      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      a.appendChild(span);
      a.appendChild(arrow);
      rightCol.appendChild(a);
    });
  }

  inner.appendChild(leftCol);
  inner.appendChild(rightCol);

  block.textContent = '';
  block.appendChild(inner);
}
