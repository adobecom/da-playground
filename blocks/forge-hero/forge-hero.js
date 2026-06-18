/**
 * forge-hero — Milo block-level EDS block
 * Reads the authored rows from the DA block table and rebuilds the hero section DOM.
 *
 * DA content model (single cell, one row):
 *   Row 0: all hero content in natural DOM order —
 *     p (eyebrow), h1 (with em for accent span), p (sub), p(a) (CTA 1), p(a) (CTA 2)
 */

const GITHUB_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49
  0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62
  1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07
  0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.4 9.4 0 0 1 5 0
  c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75
  0 3.94-2.34 4.81-4.57 5.06.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85
  0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z"/>
</svg>`;

export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  if (!cell) return;

  // Walk direct children of the cell in DOM order
  const cellChildren = [...cell.children];

  let eyebrowEl = null;
  let h1El = null;
  let subEl = null;
  const ctaLinks = [];
  let seenH1 = false;

  cellChildren.forEach((el) => {
    if (el.nodeName === 'H1') {
      h1El = el;
      seenH1 = true;
    } else if (el.nodeName === 'P') {
      const links = el.querySelectorAll('a');
      if (links.length > 0) {
        links.forEach((a) => ctaLinks.push(a));
      } else if (!seenH1 && !eyebrowEl) {
        eyebrowEl = el;
      } else if (seenH1 && !subEl) {
        subEl = el;
      }
    }
  });

  // Build the hero inner structure
  const inner = document.createElement('div');
  inner.className = 'hero__inner';

  // Eyebrow
  if (eyebrowEl) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = eyebrowEl.textContent;
    inner.appendChild(eyebrow);
  }

  // H1 — convert <em> inside h1 to <span class="accent">
  if (h1El) {
    const newH1 = document.createElement('h1');
    h1El.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        newH1.appendChild(document.createTextNode(node.textContent));
      } else if (node.nodeName === 'EM' || node.nodeName === 'STRONG') {
        const accent = document.createElement('span');
        accent.className = 'accent';
        accent.textContent = node.textContent;
        newH1.appendChild(accent);
      } else {
        newH1.appendChild(node.cloneNode(true));
      }
    });
    inner.appendChild(newH1);
  }

  // Sub paragraph
  if (subEl) {
    const sub = document.createElement('p');
    sub.className = 'hero__sub';
    sub.textContent = subEl.textContent;
    inner.appendChild(sub);
  }

  // CTA buttons
  if (ctaLinks.length) {
    const ctaDiv = document.createElement('div');
    ctaDiv.className = 'hero__cta';

    ctaLinks.forEach((link, i) => {
      const a = document.createElement('a');
      a.href = link.href;
      const text = link.textContent.trim();
      const isGithub = link.href.includes('github') || text.toLowerCase().includes('github');

      if (i === 0) {
        a.className = 'btn btn--primary';
        a.textContent = text;
      } else {
        a.className = 'btn btn--outline';
        if (isGithub) {
          // Add GitHub SVG icon before text
          const iconWrap = document.createElement('span');
          iconWrap.innerHTML = GITHUB_ICON;
          a.appendChild(iconWrap.firstElementChild);
          a.appendChild(document.createTextNode(' ' + text));
        } else {
          a.textContent = text;
        }
      }

      ctaDiv.appendChild(a);
    });

    inner.appendChild(ctaDiv);
  }

  block.textContent = '';
  block.appendChild(inner);
}
