export default function decorate(block) {
  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  // Detect optional header row: single cell containing the section label
  let labelText = '';
  let labelImg = null;
  let newsRows = rows;

  const firstCells = rows[0].querySelectorAll(':scope > div');
  if (firstCells.length === 1) {
    const labelCell = firstCells[0];
    // Check if label cell contains an image (icon)
    labelImg = labelCell.querySelector('img');
    labelText = labelCell.textContent.trim();
    newsRows = rows.slice(1);
  }

  // Build header
  const header = document.createElement('div');
  header.className = 'news-strip-header';

  const iconWrapper = document.createElement('span');
  iconWrapper.className = 'news-strip-icon';
  iconWrapper.setAttribute('aria-hidden', 'true');
  if (labelImg) {
    iconWrapper.append(labelImg);
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'news-strip-label';
  labelEl.textContent = labelText;

  header.append(iconWrapper, labelEl);

  // Build news list
  const list = document.createElement('div');
  list.className = 'news-strip-list';

  newsRows.forEach((row) => {
    const cells = [...row.querySelectorAll(':scope > div')];
    const [headlineCell, descCell, ctaCell] = cells;

    const item = document.createElement('article');
    item.className = 'news-strip-item';

    // Content: headline + description
    const content = document.createElement('div');
    content.className = 'news-strip-content';

    if (headlineCell) {
      const heading = document.createElement('h3');
      heading.className = 'news-strip-headline';
      // Move child nodes to preserve any inline markup
      [...headlineCell.childNodes].forEach((node) => heading.append(node));
      content.append(heading);
    }

    if (descCell) {
      const desc = document.createElement('p');
      desc.className = 'news-strip-desc';
      [...descCell.childNodes].forEach((node) => desc.append(node));
      content.append(desc);
    }

    item.append(content);

    // CTA: "Read story" link
    if (ctaCell) {
      const cta = document.createElement('div');
      cta.className = 'news-strip-cta';
      const link = ctaCell.querySelector('a');
      if (link) {
        link.classList.add('news-strip-link');
        cta.append(link);
      } else {
        // Bare text — wrap in a span so it still renders
        const span = document.createElement('span');
        span.className = 'news-strip-link';
        span.textContent = ctaCell.textContent.trim();
        cta.append(span);
      }
      item.append(cta);
    }

    list.append(item);
  });

  // Rebuild block content
  block.innerHTML = '';
  const inner = document.createElement('div');
  inner.append(header, list);
  block.append(inner);
}
