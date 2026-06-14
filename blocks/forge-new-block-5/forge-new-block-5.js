/**
 * forge-new-block-5 — hidden alternate section.
 *
 * The source frame carried a Figma "hidden alternate" of an adjacent section
 * (data-binding="snowflake", class="figma-hidden", aria-hidden="true", empty
 * body). It exists only to preserve the authored section count and renders
 * nothing. The decorator keeps the block in the DOM for parity but marks it
 * hidden + aria-hidden so it is removed from the accessibility tree and never
 * painted — 1:1 with the source.
 */
export default async function init(el) {
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('hidden', '');
  // Strip any stray authored whitespace rows so the hidden block stays empty.
  el.querySelectorAll(':scope > div').forEach((row) => {
    const hasMedia = row.querySelector('img, picture, svg, video');
    if (!row.textContent.trim() && !hasMedia) row.remove();
  });
}
