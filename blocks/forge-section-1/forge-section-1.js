// Snowflake block — bespoke section captured from a redesign prototype.
// EDS wraps the table-cell content in extra `<div>` row/cell wrappers
// (`block > div > div > <content>`). The scoped CSS in forge-section-1.css
// targets the natural HTML structure so we lift the content out of EDS's
// wrappers before the styles apply.
export default function decorate(block) {
  if (!block) return;
  const inner = block.querySelector(':scope > div > div');
  if (inner) {
    while (inner.firstChild) block.appendChild(inner.firstChild);
    inner.parentElement?.remove();
  }
  block.dataset.bespoke = 'forge-section-1';
}
