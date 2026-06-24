/**
 * forge-tabs — "Work faster. No matter the work." tabs section.
 *
 * Content model (DA block table):
 *   Row 0: 1 cell  — headline <h2>
 *   Row 1–4: 3 cells — [title text] | [<p> subtitle] | [<picture> image]
 */
export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];

  // --- Row 0: headline ---
  const headlineRow = rows[0];
  const h2 = headlineRow?.querySelector('h2');
  if (h2) h2.classList.add('tabs-headline');

  // --- Rows 1–4: tab cards ---
  const tabCards = rows.slice(1).map((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const titleText = cells[0]?.textContent.trim() ?? '';
    const subEl = cells[1]?.querySelector('p');
    const picture = cells[2]?.querySelector('picture');

    const card = document.createElement('div');
    card.className = 'tab-card';

    // Image container
    const imgWrap = document.createElement('div');
    imgWrap.className = 'tab-img';
    if (picture) {
      // Ensure the img inside the picture fills the container
      const img = picture.querySelector('img');
      if (img) {
        img.removeAttribute('width');
        img.removeAttribute('height');
      }
      imgWrap.appendChild(picture);
    }
    card.appendChild(imgWrap);

    // Title
    const h3 = document.createElement('h3');
    h3.className = 'tab-title';
    h3.textContent = titleText;
    card.appendChild(h3);

    // Subtitle
    const p = document.createElement('p');
    p.className = 'tab-sub';
    p.textContent = subEl?.textContent.trim() ?? '';
    card.appendChild(p);

    return card;
  });

  // --- Assemble ---
  const tabsRow = document.createElement('div');
  tabsRow.className = 'tabs-row';
  tabCards.forEach((card) => tabsRow.appendChild(card));

  const section = document.createElement('div');
  section.className = 'tabs-section';
  if (h2) section.appendChild(h2);
  section.appendChild(tabsRow);

  block.innerHTML = '';
  block.appendChild(section);
}
