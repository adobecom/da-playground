/**
 * Snowflake generator for https-main-da-playground-adobecom-aem-li
 *
 * Reads input/bespoke.html and produces:
 *   - output/templates/https-main-da-playground-adobecom-aem-li.html
 *   - output/fragments/https-main-da-playground-adobecom-aem-li/header.html
 *   - output/fragments/https-main-da-playground-adobecom-aem-li/footer.html
 *   - output/styles/https-main-da-playground-adobecom-aem-li.css
 *   - output/da/https-main-da-playground-adobecom-aem-li.html
 */

import fs from 'fs';
import path from 'path';

const ROOT = '/Users/victor/dev/forge/shared/data/141c6e4b-739a-427a-a71b-9bb2e96b0b59-proto-mpphongk';
const PROJ = `${ROOT}/.snowflake/projects/001-https-main-da-playground-adobecom-aem-li`;
const TEMPLATE_NAME = 'https-main-da-playground-adobecom-aem-li';
const PAGE_SLUG = 'https-main-da-playground-adobecom-aem-li';

// Read the bespoke HTML
const bespoke = fs.readFileSync(`${ROOT}/input/bespoke.html`, 'utf8');

// =====================================================================
// UTILITIES
// =====================================================================

/**
 * Find the depth-matched closing </tagName> for the opening tag
 * whose content starts at `afterOpen` (position immediately after
 * the `>` of the opening tag).
 */
function findClosingTag(html, afterOpen, tagName) {
  let depth = 0;
  let i = afterOpen;
  const openPattern = `<${tagName.toLowerCase()}`;
  const closeTag = `</${tagName.toLowerCase()}>`;

  while (i < html.length) {
    const nextOpenIdx = html.indexOf(openPattern, i);
    const nextCloseIdx = html.indexOf(closeTag, i);

    if (nextCloseIdx === -1) {
      throw new Error(`No closing </${tagName}> found after position ${afterOpen}`);
    }

    // Check if the next open is before the next close AND it's a real tag
    // (followed by space or >)
    const isRealOpen = nextOpenIdx !== -1
      && nextOpenIdx < nextCloseIdx
      && (html[nextOpenIdx + openPattern.length] === ' '
        || html[nextOpenIdx + openPattern.length] === '>'
        || html[nextOpenIdx + openPattern.length] === '\n'
        || html[nextOpenIdx + openPattern.length] === '\t'
        || html[nextOpenIdx + openPattern.length] === '/');

    if (isRealOpen) {
      // Skip this nested open tag (find its closing '>')
      const openEnd = html.indexOf('>', nextOpenIdx) + 1;
      if (html[openEnd - 2] === '/') {
        // Self-closing tag like <br/> - don't increment depth
        i = openEnd;
      } else {
        depth += 1;
        i = openEnd;
      }
    } else {
      if (depth === 0) {
        return nextCloseIdx;
      }
      depth -= 1;
      i = nextCloseIdx + closeTag.length;
    }
  }
  throw new Error(`Unbalanced <${tagName}> starting after ${afterOpen}`);
}

/**
 * Add a data-slot attribute to the OPENING tag that contains the
 * given unique string. Handles two cases:
 *
 * 1. The string is INSIDE an attribute value (e.g. id="foo"):
 *    Walk backwards from the string to find the '<' of the opening tag.
 *
 * 2. The string is TEXT CONTENT between tags (e.g. >some text<):
 *    Walk backwards past any closing or text to find the last
 *    OPENING tag '<tag'.
 *
 * Inserts the slotAttr string before the '>' that closes the opening tag.
 */
function addSlot(html, uniqueStr, slotAttr) {
  const idx = html.indexOf(uniqueStr);
  if (idx === -1) {
    console.warn(`WARN: slot anchor not found: "${uniqueStr}"`);
    return html;
  }

  // Walk backwards to find the '<' of the opening tag that contains this string.
  // Skip over closing tags (</...) and comments.
  let tagStart = idx;
  while (tagStart > 0) {
    tagStart--;
    if (html[tagStart] === '<') {
      const nextCh = html[tagStart + 1];
      // Skip closing tags and comments
      if (nextCh !== '/' && nextCh !== '!') break;
    }
  }

  // Verify we found an opening tag
  if (tagStart <= 0) {
    console.warn(`WARN: could not find opening tag for "${uniqueStr}"`);
    return html;
  }

  // Walk forward from the tag start to find its closing '>'
  // Handle quoted attributes so we don't stop at '>' inside attr values
  let tagEnd = tagStart + 1;
  let inQuote = null;
  while (tagEnd < html.length) {
    const ch = html[tagEnd];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === '>') {
      break;
    }
    tagEnd++;
  }

  // Insert the attribute before the closing '>'
  return html.substring(0, tagEnd) + ` ${slotAttr}` + html.substring(tagEnd);
}

// =====================================================================
// EXTRACT HEAD LINKS (Milo CSS + fonts)
// =====================================================================
const headLinkRe = /<link rel="stylesheet" href="https:\/\/(main--milo--adobecom\.aem\.live|use\.typekit\.net|stage\.adobeccstatic\.com)[^"]*">/g;
const headLinks = [];
let lm;
while ((lm = headLinkRe.exec(bespoke)) !== null) {
  if (!headLinks.includes(lm[0])) headLinks.push(lm[0]);
}
const headLinksHtml = headLinks.join('\n');

// =====================================================================
// EXTRACT HEADER FRAGMENT (everything from <body> to <main>)
// =====================================================================
const bodyTagEnd = bespoke.indexOf('>',  bespoke.indexOf('<body')) + 1;
const mainTagStart = bespoke.indexOf('<main id="main-content"');
const headerHtml = bespoke.substring(bodyTagEnd, mainTagStart).trim();

// =====================================================================
// EXTRACT FOOTER FRAGMENT (everything after </main>)
// =====================================================================
const mainCloseIdx = bespoke.lastIndexOf('</main>');
const mainCloseEnd = mainCloseIdx + '</main>'.length;
const bodyCloseIdx = bespoke.lastIndexOf('</body>');
const footerHtml = bespoke.substring(mainCloseEnd, bodyCloseIdx).trim();

// =====================================================================
// EXTRACT MAIN CONTENT
// =====================================================================
const mainOpenEnd = bespoke.indexOf('>', mainTagStart) + 1;
let mainContent = bespoke.substring(mainTagStart, mainCloseIdx + '</main>'.length);

// =====================================================================
// TRANSFORM SECTIONS: <div class="section..."> → <section class="sN section...">
// =====================================================================
// First, find ALL section open tags in mainContent to record their
// positions in the original string. Then apply replacements in REVERSE
// order so indices stay valid.

const sectionRe = /<div class="section([^"]*)"([^>]*daa-lh="(s\d+)"[^>]*)>/g;
const sectionMatches = [];
let sm;
while ((sm = sectionRe.exec(mainContent)) !== null) {
  sectionMatches.push({
    openStart: sm.index,
    openEnd: sm.index + sm[0].length,
    extraClasses: sm[1],   // classes after "section" (may be empty or " rounded-corners-top ...")
    extraAttrs: sm[2],     // remaining attributes inc. daa-lh
    sN: sm[3],             // "s1", "s2", etc.
    originalOpen: sm[0],
  });
}

// Precompute closing positions from the ORIGINAL mainContent
// (before any replacements)
for (const sec of sectionMatches) {
  sec.closeStart = findClosingTag(mainContent, sec.openEnd, 'div');
  sec.closeEnd = sec.closeStart + '</div>'.length;
}

// Apply replacements in REVERSE order (last section first) so that
// earlier sections' positions stay valid
let workHtml = mainContent;

for (let i = sectionMatches.length - 1; i >= 0; i--) {
  const sec = sectionMatches[i];

  // Build new opening tag: <section class="sN section<extraClasses>"<extraAttrs>>
  const newOpen = `<section class="${sec.sN} section${sec.extraClasses}"${sec.extraAttrs}>`;
  const newClose = '</section>';

  // Replace closing </div> first (higher index position)
  workHtml = workHtml.substring(0, sec.closeStart) + newClose + workHtml.substring(sec.closeEnd);

  // Replace opening <div class="section..."> (lower index position)
  workHtml = workHtml.substring(0, sec.openStart) + newOpen + workHtml.substring(sec.openEnd);
}

// =====================================================================
// ADD data-slot MARKERS
// =====================================================================

// S2: rich-content - "Everything you need to make anything."
// Use id= anchor for the heading (inside the attribute value)
workHtml = addSlot(workHtml,
  'id="everything-you-need-to-make-anything"',
  'data-slot="s2.title"'
);
// For body, search for text content without the curly apostrophe
// The body-lg <p> is: "Whether you’re a student, social influencer..."
// Use a fragment that avoids the smart quote
workHtml = addSlot(workHtml,
  'social influencer, creative professional',
  'data-slot="s2.body"'
);

// S4: rich-content - "Explore what's new"
workHtml = addSlot(workHtml,
  'class="eyebrow">Features and Releases',
  'data-slot="s4.eyebrow"'
);
workHtml = addSlot(workHtml,
  'id="explore-whats-new"',
  'data-slot="s4.title"'
);
workHtml = addSlot(workHtml,
  'Discover the latest product features',
  'data-slot="s4.body"'
);

// S5: featured base-card
workHtml = addSlot(workHtml,
  'id="upscale-images-instantly-with-ai-2"',
  'data-slot="s5.title"'
);
workHtml = addSlot(workHtml,
  'Improve resolution, clarity, and sharpness',
  'data-slot="s5.body"'
);

// S9: Adobe News section headline and items
workHtml = addSlot(workHtml,
  'id="adobe-apps-are-top-choice-for-sundance-filmmakers"',
  'data-slot="s9.item1.title"'
);
workHtml = addSlot(workHtml,
  '85% of Sundance Filmmakers Choose Adobe',
  'data-slot="s9.item1.body"'
);
workHtml = addSlot(workHtml,
  'id="adobes-new-incubatorcreates-the-future"',
  'data-slot="s9.item2.title"'
);
workHtml = addSlot(workHtml,
  'At Adobe, innovating for our customers',
  'data-slot="s9.item2.body"'
);
workHtml = addSlot(workHtml,
  'id="adobe-partners-with-openaito-test-ads-in-chatgpt"',
  'data-slot="s9.item3.title"'
);
workHtml = addSlot(workHtml,
  'Adobe empowers marketing professionals with AI-driven',
  'data-slot="s9.item3.body"'
);

// S10: tools hero
workHtml = addSlot(workHtml,
  'id="tools-thatwork-for-you"',
  'data-slot="s10.title"'
);
workHtml = addSlot(workHtml,
  'Bring any idea to life with products for creators',
  'data-slot="s10.body"'
);

// =====================================================================
// BUILD TEMPLATE FILE
// =====================================================================
const templateContent = `${headLinksHtml}

${workHtml}`;

// =====================================================================
// BUILD DA DOCUMENT
// =====================================================================
const daBlocks = `<div>
  <div class="s2">
    <div><div>s2.title</div><div><h2>Everything you need to make anything.</h2></div></div>
    <div><div>s2.body</div><div>Whether you're a student, social influencer, creative professional, performance marketer, or global brand, Adobe has the apps you need to make it happen.</div></div>
  </div>
</div>
<div>
  <div class="s4">
    <div><div>s4.eyebrow</div><div>Features and Releases</div></div>
    <div><div>s4.title</div><div><h2>Explore what's new.</h2></div></div>
    <div><div>s4.body</div><div>Discover the latest product features from Adobe.</div></div>
  </div>
</div>
<div>
  <div class="s5">
    <div><div>s5.title</div><div><h3>Upscale images instantly with AI.</h3></div></div>
    <div><div>s5.body</div><div>Improve resolution, clarity, and sharpness while preserving detail—perfect for photos, designs, and creatives.</div></div>
  </div>
</div>
<div>
  <div class="s9">
    <div><div>s9.item1.title</div><div><h3>Adobe apps are top choice for Sundance filmmakers.</h3></div></div>
    <div><div>s9.item1.body</div><div>85% of Sundance Filmmakers Choose Adobe as Company Releases New AI Video Innovations and $10M in Creator Grants.</div></div>
    <div><div>s9.item2.title</div><div><h3>Adobe's new Incubator creates the future.</h3></div></div>
    <div><div>s9.item2.body</div><div>At Adobe, innovating for our customers has always been our north star. From pioneering digital creativity to reimagining the future of customer engagement, our mission has been to change the world through personalized digital experiences.</div></div>
    <div><div>s9.item3.title</div><div><h3>Adobe partners with OpenAI to test ads in ChatGPT.</h3></div></div>
    <div><div>s9.item3.body</div><div>Adobe empowers marketing professionals with AI-driven Customer Experience Orchestration to create, deliver and optimize personalized digital experiences.</div></div>
  </div>
</div>
<div>
  <div class="s10">
    <div><div>s10.title</div><div><h2>Tools that work for you.</h2></div></div>
    <div><div>s10.body</div><div>Bring any idea to life with products for creators, businesses, and beyond.</div></div>
  </div>
</div>
<div>
  <div class="metadata">
    <div><div>template</div><div>${TEMPLATE_NAME}</div></div>
    <div><div>title</div><div>DA Playground</div></div>
  </div>
</div>`;

const daDoc = `<body>
<header></header>
<main>
${daBlocks}
</main>
<footer></footer>
</body>`;

// =====================================================================
// WRITE OUTPUT FILES
// =====================================================================
const outDir = `${PROJ}/output`;

// Template
fs.mkdirSync(`${outDir}/templates`, { recursive: true });
fs.writeFileSync(`${outDir}/templates/${TEMPLATE_NAME}.html`, templateContent);
console.log(`Wrote template (${templateContent.length} bytes)`);

// Header fragment
fs.mkdirSync(`${outDir}/fragments/${TEMPLATE_NAME}`, { recursive: true });
fs.writeFileSync(`${outDir}/fragments/${TEMPLATE_NAME}/header.html`, headerHtml);
console.log(`Wrote header fragment (${headerHtml.length} bytes)`);

// Footer fragment
fs.writeFileSync(`${outDir}/fragments/${TEMPLATE_NAME}/footer.html`, footerHtml);
console.log(`Wrote footer fragment (${footerHtml.length} bytes)`);

// Page CSS (empty - all styles from CDN links in template head)
fs.mkdirSync(`${outDir}/styles`, { recursive: true });
fs.writeFileSync(`${outDir}/styles/${TEMPLATE_NAME}.css`,
  `/* Styles for ${TEMPLATE_NAME} */\n/* Visual design served via Milo CDN links in the template head. */\n`
);
console.log('Wrote page CSS');

// DA document
fs.mkdirSync(`${outDir}/da`, { recursive: true });
fs.writeFileSync(`${outDir}/da/${PAGE_SLUG}.html`, daDoc);
console.log(`Wrote DA document (${daDoc.length} bytes)`);

// =====================================================================
// SELF-CHECKS
// =====================================================================
console.log('\n--- Self-checks ---');

if (!templateContent.includes('<main')) {
  console.error('FAIL: template missing <main>');
} else {
  console.log('OK: template has <main>');
}

const divSectionCount = (templateContent.match(/<div class="section/g) || []).length;
const sectionTagCount = (templateContent.match(/<section class="s\d/g) || []).length;
if (divSectionCount > 0) {
  console.warn(`WARN: ${divSectionCount} unconverted <div class="section"> remaining`);
} else {
  console.log(`OK: all sections converted (${sectionTagCount} <section class="sN..."> elements)`);
}

const slotCount = (templateContent.match(/data-slot="/g) || []).length;
console.log(`OK: ${slotCount} data-slot markers in template`);

if (!daDoc.includes('class="metadata"')) {
  console.error('FAIL: DA doc missing metadata block');
} else {
  console.log('OK: DA doc has metadata block');
}

if (!daDoc.includes(`<div>${TEMPLATE_NAME}</div>`)) {
  console.error('FAIL: DA doc missing template name');
} else {
  console.log('OK: DA doc has template name');
}

// Check no relative assets/ refs in template
const relativeAssets = (templateContent.match(/="assets\//g) || []).length;
if (relativeAssets > 0) {
  console.warn(`WARN: ${relativeAssets} relative assets/ refs in template`);
} else {
  console.log('OK: no relative assets/ refs');
}

console.log('\nGeneration complete.');
