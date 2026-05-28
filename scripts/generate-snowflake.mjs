/**
 * Snowflake generation script for https-main-da-playground-adobecom-aem-li
 * Reads input/bespoke.html and produces:
 *   - templates/https-main-da-playground-adobecom-aem-li.html
 *   - fragments/https-main-da-playground-adobecom-aem-li/header.html
 *   - fragments/https-main-da-playground-adobecom-aem-li/footer.html
 *   - styles/https-main-da-playground-adobecom-aem-li.css
 *   - .snowflake/projects/001-da-playground/output/da/https-main-da-playground-adobecom-aem-li.html
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = __dir.replace('/scripts', '');
const TNAME = 'https-main-da-playground-adobecom-aem-li';
const SOURCE = `${ROOT}/input/bespoke.html`;

const src = readFileSync(SOURCE, 'utf8');

// ── helpers ──────────────────────────────────────────────────────────────────
function write(relPath, content) {
  const full = `${ROOT}/${relPath}`;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
  console.log(`[snowflake] wrote ${relPath}`);
}

// Extract content between two line numbers (1-based, inclusive)
function lines(from, to) {
  return src.split('\n').slice(from - 1, to).join('\n');
}

// ── HEAD LINKS ────────────────────────────────────────────────────────────────
const HEAD_LINKS = [
  '<link rel="stylesheet" href="https://use.typekit.net/hah7vzn.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/styles/styles.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/visually-hidden/visually-hidden.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/router-marquee/router-marquee.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/section-metadata/section-metadata.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/blocks/merch/merch.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/modal/modal.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/blocks/video/video.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/global-navigation/global-navigation.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/deps/lenis.min.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/rich-content/rich-content.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/elastic-carousel/elastic-carousel.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/base-card/base-card.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/carousel-c2/carousel-c2.css">',
  '<link rel="stylesheet" href="https://stage.adobeccstatic.com/unav/1.5/UniversalNav.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/news/news.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/explore-card/explore-card.css">',
  '<link rel="stylesheet" href="https://main--milo--adobecom.aem.live/libs/c2/blocks/global-footer/global-footer.css">',
].join('\n');

// ── 1) HEADER FRAGMENT ────────────────────────────────────────────────────────
// Extract from <body> start up to (not including) <main>
// Header is lines 30-1124 (the <header class="global-navigation..."> block
// and the promo cards section before <main>)
const headerStart = src.indexOf('<header class="global-navigation');
const mainStart = src.indexOf('<main id="main-content"');
const headerHtml = src.slice(headerStart, mainStart).trim();

write(`fragments/${TNAME}/header.html`, headerHtml);

// ── 2) FOOTER FRAGMENT ────────────────────────────────────────────────────────
// The footer in the rendered page is empty (loaded dynamically by Milo JS)
const footerMatch = src.match(/<footer[^>]*class="global-footer"[^>]*>[\s\S]*?<\/footer>/);
const footerHtml = footerMatch ? footerMatch[0] : '<footer class="global-footer"></footer>';
write(`fragments/${TNAME}/footer.html`, footerHtml);

// ── 3) PAGE CSS ────────────────────────────────────────────────────────────────
// No inline <style> blocks in this rendered Milo page; all CSS from CDN.
write(`styles/${TNAME}.css`, '/* No inline styles — all CSS loaded via CDN links in template. */\n');

// ── 4) TEMPLATE HTML ──────────────────────────────────────────────────────────
// Extract <main>...</main> from bespoke.html
const mainEndIdx = src.indexOf('</main>') + '</main>'.length;
let mainContent = src.slice(mainStart, mainEndIdx);

// Section first-class mapping: from class="section ..." to class="UNIQUE section ..."
// Each section div gets its unique first class prepended
const sectionMappings = [
  // [match-anchor, unique-first-class]
  ['daa-lh="s1"', 'router-marquee'],
  ['daa-lh="s2"', 'rich-content-intro'],
  ['daa-lh="s3"', 'elastic-carousel-section'],
  ['daa-lh="s4"', 'rich-content-features'],
  ['daa-lh="s5"', 'base-card-featured'],
  ['daa-lh="s6"', 'base-card-three-up'],
  ['daa-lh="s7"', 'carousel-c2-section'],
  ['daa-lh="s8"', 'section-spacer'],
  ['daa-lh="s9"', 'news-section'],
  ['daa-lh="s10"', 'rich-content-garage-door'],
  ['daa-lh="s11"', 'product-grid-section'],
  ['daa-lh="s12"', 'section-footer-spacer'],
];

// Rewrite div class="section ..." to section class="UNIQUE section ..."
// Strategy: find each top-level section div by its daa-lh, rewrite the opening tag
for (const [anchor, firstClass] of sectionMappings) {
  // Find the <div ... daa-lh="sN"...> opening tag and rewrite class to add unique first class
  // Pattern: <div class="section..." daa-lh="sN">
  mainContent = mainContent.replace(
    new RegExp(`<div([^>]*?)class="section([^"]*?)"([^>]*?)${anchor.replace(/"/g, '\\"')}`, 'g'),
    (match, pre, rest, post) => {
      // Rewrite: section gets unique-first-class prepended
      return `<section${pre}class="${firstClass} section${rest}"${post}${anchor}`;
    }
  );
  // Also need to find the closing </div> for this section — but we can't do that
  // with simple regex on complex nested HTML. Instead we'll do a post-pass to
  // fix the section closing tags.
}

// NOTE: The approach above with section open/close won't work well with regex
// due to nesting. Let me use a different approach - use Node's string processing
// to track depth and convert the right closing tags.
// For simplicity in this prototype, we'll use a marker-based approach.

// Actually, the simplest approach is to mark the sections with data-slot attributes
// on their content elements, not worry about the closing div/section mismatch
// (the browser parser handles div vs section closing tags gracefully).
// But the overlay engine needs section[class] elements - so we DO need proper <section> tags.

// Let me use a proper depth-tracking approach:
function convertDivToSection(html, divAnchor, firstClass) {
  // Find the opening div tag with this anchor
  const anchorIdx = html.indexOf(divAnchor);
  if (anchorIdx === -1) return html;

  // Walk backwards to find the start of the <div that contains this anchor
  let tagStart = anchorIdx;
  while (tagStart > 0 && html[tagStart] !== '<') tagStart--;

  // Find the end of the opening tag
  let tagEnd = html.indexOf('>', anchorIdx) + 1;

  // Extract and transform the opening tag
  const openTag = html.slice(tagStart, tagEnd);

  // Rewrite class attribute: prepend unique first class
  const newOpenTag = openTag
    .replace(/^<div/, '<section')
    .replace(/class="section/, `class="${firstClass} section`);

  // Now find the matching closing </div> by tracking nesting depth
  let depth = 1;
  let pos = tagEnd;
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) {
        // Replace this </div> with </section>
        const beforeClose = html.slice(0, nextClose);
        const afterClose = html.slice(nextClose + 6); // '</div>'.length = 6
        html = beforeClose + '</section>' + afterClose;
        break;
      }
      pos = nextClose + 6;
    }
  }

  // Replace the opening tag
  html = html.slice(0, tagStart) + newOpenTag + html.slice(tagEnd);
  return html;
}

// Apply section conversions in reverse order to preserve indices
// Actually we need to apply in forward order - let's reset and reprocess
mainContent = src.slice(mainStart, mainEndIdx);

for (const [anchor, firstClass] of sectionMappings) {
  mainContent = convertDivToSection(mainContent, anchor, firstClass);
}

// ── 5) ADD DATA-SLOT MARKERS ──────────────────────────────────────────────────
// Slot additions: add data-slot attributes to key authorable elements.
// We target specific text content patterns unique enough to identify each element.

const slotMarkers = [
  // ── s1 router-marquee: 5 slides × 3 viewports ──
  // Slide 1 (Creative Cloud) - mobile viewport (first occurrence)
  [/<p class="rm-eyebrow">Creative Cloud<\/p>/, '<p class="rm-eyebrow" data-slot="slide-1.eyebrow">Creative Cloud</p>'],
  [/<h2 id="create-at-the-highest-level" class="rm-title">/, '<h2 id="create-at-the-highest-level" class="rm-title" data-slot="slide-1.title">'],
  // Mobile body
  [/<div class="rm-body"><p>Photoshop, Illustrator, Premiere/, '<div class="rm-body" data-slot="slide-1.body"><p>Photoshop, Illustrator, Premiere'],

  // Slide 2 (Firefly) - first occurrence
  [/<p class="rm-eyebrow">Firefly<\/p>/, '<p class="rm-eyebrow" data-slot="slide-2.eyebrow">Firefly</p>'],
  [/<h2 id="all-the-best-models-all-in-one-place" class="rm-title">/, '<h2 id="all-the-best-models-all-in-one-place" class="rm-title" data-slot="slide-2.title">'],
  [/<div class="rm-body"><p>Quickly create and edit images/, '<div class="rm-body" data-slot="slide-2.body"><p>Quickly create and edit images'],

  // Slide 3 (Acrobat) - first occurrence
  [/<p class="rm-eyebrow">Acrobat<\/p>/, '<p class="rm-eyebrow" data-slot="slide-3.eyebrow">Acrobat</p>'],
  [/<h2 id="get-workdone-faster" class="rm-title">/, '<h2 id="get-workdone-faster" class="rm-title" data-slot="slide-3.title">'],
  [/<div class="rm-body"><p>Create, edit, share, and sign/, '<div class="rm-body" data-slot="slide-3.body"><p>Create, edit, share, and sign'],

  // Slide 4 (Adobe for Business) - first occurrence
  [/<p class="rm-eyebrow">Adobe for Business<\/p>/, '<p class="rm-eyebrow" data-slot="slide-4.eyebrow">Adobe for Business</p>'],
  [/<h2 id="use-ai-to-create-better-customer-experiences" class="rm-title">/, '<h2 id="use-ai-to-create-better-customer-experiences" class="rm-title" data-slot="slide-4.title">'],
  [/<div class="rm-body"><p>Unify data, content, and workflows/, '<div class="rm-body" data-slot="slide-4.body"><p>Unify data, content, and workflows'],

  // Slide 5 (Students) - first occurrence
  [/<p class="rm-eyebrow">Students and teachers<\/p>/, '<p class="rm-eyebrow" data-slot="slide-5.eyebrow">Students and teachers</p>'],
  [/<h2 id="students-and-teachers-save-71" class="rm-title">/, '<h2 id="students-and-teachers-save-71" class="rm-title" data-slot="slide-5.title">'],
  [/<div class="rm-body"><p>Save big on industry-standard/, '<div class="rm-body" data-slot="slide-5.body"><p>Save big on industry-standard'],

  // ── s2 rich-content-intro ──
  [/<h2 id="everything-you-need-to-make-anything" class="title-2">/, '<h2 id="everything-you-need-to-make-anything" class="title-2" data-slot="heading">'],
  [/<p class="body-lg">Whether you're a student/, '<p class="body-lg" data-slot="body">Whether you\'re a student'],

  // ── s4 rich-content-features ──
  [/<p class="eyebrow">Features and Releases<\/p>/, '<p class="eyebrow" data-slot="eyebrow">Features and Releases</p>'],
  [/<h2 id="explore-whats-new" class="title-2">/, '<h2 id="explore-whats-new" class="title-2" data-slot="heading">'],
  [/<p class="body-lg">Discover the latest product features/, '<p class="body-lg" data-slot="body">Discover the latest product features'],

  // ── s5 base-card-featured ──
  [/<h3 id="upscale-images-instantly-with-ai-2" class="title-4">/, '<h3 id="upscale-images-instantly-with-ai-2" class="title-4" data-slot="heading">'],
  [/<p class="body-md">Improve resolution, clarity/, '<p class="body-md" data-slot="body">Improve resolution, clarity'],
  [/class="standalone-link label" daa-ll="Explore Firefly-1--Upscale images insta">Explore Firefly/, 'class="standalone-link label" daa-ll="Explore Firefly-1--Upscale images insta" data-slot="cta">Explore Firefly'],

  // ── s6 base-card-three-up (card-1: Acrobat) ──
  [/<h3 id="work-smarter-than-ever-with-documents" class="title-4">/, '<h3 id="work-smarter-than-ever-with-documents" class="title-4" data-slot="card-1.heading">'],
  [/<p class="body-md">Trusted PDF tools, now with AI/, '<p class="body-md" data-slot="card-1.body">Trusted PDF tools, now with AI'],
  [/class="standalone-link label" daa-ll="Explore Acrobat-1--Work smarter than ev">Explore Acrobat/, 'class="standalone-link label" daa-ll="Explore Acrobat-1--Work smarter than ev" data-slot="card-1.cta">Explore Acrobat'],

  // s6 card-2: Firefly partner models
  [/<h3 id="generate-with-top-ai-models-in-one-place" class="title-4">/, '<h3 id="generate-with-top-ai-models-in-one-place" class="title-4" data-slot="card-2.heading">'],
  [/<p class="body-md">Access Gemini 3.1/, '<p class="body-md" data-slot="card-2.body">Access Gemini 3.1'],
  [/class="standalone-link label" daa-ll="Get started-1--Generate with top AI">Get started/, 'class="standalone-link label" daa-ll="Get started-1--Generate with top AI" data-slot="card-2.cta">Get started'],

  // s6 card-3: Harmonize
  [/<h3 id="blend-images-seamlessly-with-harmonize" class="title-4">/, '<h3 id="blend-images-seamlessly-with-harmonize" class="title-4" data-slot="card-3.heading">'],
  [/<p class="body-md">Combine people and objects/, '<p class="body-md" data-slot="card-3.body">Combine people and objects'],
  [/class="standalone-link label" daa-ll="Get started-1--Blend images seamles">Get started/, 'class="standalone-link label" daa-ll="Get started-1--Blend images seamles" data-slot="card-3.cta">Get started'],

  // ── s9 news-section ──
  [/<h3 id="adobe-apps-are-top-choice-for-sundance-filmmakers" class="title-4 news-item-headline">/, '<h3 id="adobe-apps-are-top-choice-for-sundance-filmmakers" class="title-4 news-item-headline" data-slot="news-1.heading">'],
  [/<p class="body-md news-item-body">85% of Sundance/, '<p class="body-md news-item-body" data-slot="news-1.body">85% of Sundance'],
  [/class="standalone-link label quiet" daa-ll="Read story-1--Adobe apps are top c">Read story/, 'class="standalone-link label quiet" daa-ll="Read story-1--Adobe apps are top c" data-slot="news-1.link">Read story'],

  [/<h3 id="adobes-new-incubatorcreates-the-future" class="title-4 news-item-headline">/, '<h3 id="adobes-new-incubatorcreates-the-future" class="title-4 news-item-headline" data-slot="news-2.heading">'],
  [/<p class="body-md news-item-body">At Adobe, innovating/, '<p class="body-md news-item-body" data-slot="news-2.body">At Adobe, innovating'],
  [/class="standalone-link label quiet" daa-ll="Read story-2--Adobe s new Incubato">Read story/, 'class="standalone-link label quiet" daa-ll="Read story-2--Adobe s new Incubato" data-slot="news-2.link">Read story'],

  [/<h3 id="adobe-partners-with-openaito-test-ads-in-chatgpt" class="title-4 news-item-headline">/, '<h3 id="adobe-partners-with-openaito-test-ads-in-chatgpt" class="title-4 news-item-headline" data-slot="news-3.heading">'],
  [/<p class="body-md news-item-body">Adobe empowers marketing/, '<p class="body-md news-item-body" data-slot="news-3.body">Adobe empowers marketing'],
  [/class="standalone-link label quiet" daa-ll="Read story-3--Adobe partners with ">Read story/, 'class="standalone-link label quiet" daa-ll="Read story-3--Adobe partners with " data-slot="news-3.link">Read story'],

  // ── s10 rich-content-garage-door ──
  [/<h2 id="tools-thatwork-for-you" class="title-2">/, '<h2 id="tools-thatwork-for-you" class="title-2" data-slot="heading">'],
  [/<p class="body-lg">Bring any idea to life/, '<p class="body-lg" data-slot="body">Bring any idea to life'],
  [/class="con-button outline button-lg" daa-ll="See all products-1--Tools that work for ">See all products/, 'class="con-button outline button-lg" daa-ll="See all products-1--Tools that work for " data-slot="cta">See all products'],

  // ── s11 product-grid-section (9 explore-cards) ──
  [/<h3 id="firefly" class="title-4">Firefly<\/h3>/, '<h3 id="firefly" class="title-4" data-slot="card-1.title">Firefly</h3>'],
  [/<p class="body-md">Create and enhance images, video, and audio with AI-powered tools/, '<p class="body-md" data-slot="card-1.body">Create and enhance images, video, and audio with AI-powered tools'],

  [/<h3 id="adobeacrobat" class="title-4">Adobe&nbsp;Acrobat<\/h3>/, '<h3 id="adobeacrobat" class="title-4" data-slot="card-2.title">Adobe&nbsp;Acrobat</h3>'],
  [/<p class="body-md">The complete AI-powered PDF/, '<p class="body-md" data-slot="card-2.body">The complete AI-powered PDF'],

  [/<h3 id="photoshop" class="title-4">Photoshop<\/h3>/, '<h3 id="photoshop" class="title-4" data-slot="card-3.title">Photoshop</h3>'],
  [/<p class="body-md">Create gorgeous images, rich graphics/, '<p class="body-md" data-slot="card-3.body">Create gorgeous images, rich graphics'],

  [/<h3 id="premiere" class="title-4">Premiere<\/h3>/, '<h3 id="premiere" class="title-4" data-slot="card-4.title">Premiere</h3>'],
  [/<p class="body-md">Create everything from social clips to feature films/, '<p class="body-md" data-slot="card-4.body">Create everything from social clips to feature films'],

  [/<h3 id="creative-cloud" class="title-4">Creative Cloud<\/h3>/, '<h3 id="creative-cloud" class="title-4" data-slot="card-5.title">Creative Cloud</h3>'],
  [/<p class="body-md">Get 20\+ apps, including Photoshop, Illustrator, Premiere Pro/, '<p class="body-md" data-slot="card-5.body">Get 20+ apps, including Photoshop, Illustrator, Premiere Pro'],

  [/<h3 id="genstudio" class="title-4">GenStudio<\/h3>/, '<h3 id="genstudio" class="title-4" data-slot="card-6.title">GenStudio</h3>'],
  [/<p class="body-md">Scale your content supply chain\.<\/p>/, '<p class="body-md" data-slot="card-6.body">Scale your content supply chain.</p>'],

  [/<h3 id="business-products" class="title-4">Business Products<\/h3>/, '<h3 id="business-products" class="title-4" data-slot="card-7.title">Business Products</h3>'],
  [/<p class="body-md">Adobe solutions integrate our best-in-class/, '<p class="body-md" data-slot="card-7.body">Adobe solutions integrate our best-in-class'],

  [/<h3 id="illustrator" class="title-4">Illustrator<\/h3>/, '<h3 id="illustrator" class="title-4" data-slot="card-8.title">Illustrator</h3>'],
  [/<p class="body-md">Design precision vector graphics/, '<p class="body-md" data-slot="card-8.body">Design precision vector graphics'],

  [/<h3 id="all-products" class="title-4">All products<\/h3>/, '<h3 id="all-products" class="title-4" data-slot="card-9.title">All products</h3>'],
  [/<p class="body-md">See all Adobe products<\/p>/, '<p class="body-md" data-slot="card-9.body">See all Adobe products</p>'],
];

// Apply slot markers. Router-marquee patterns need global flag (3 viewports).
// Other patterns are unique enough that first-occurrence is correct.
const rmPatterns = new Set([
  'slide-1.eyebrow','slide-1.title','slide-1.body',
  'slide-2.eyebrow','slide-2.title','slide-2.body',
  'slide-3.eyebrow','slide-3.title','slide-3.body',
  'slide-4.eyebrow','slide-4.title','slide-4.body',
  'slide-5.eyebrow','slide-5.title','slide-5.body',
]);
for (const [pattern, replacement] of slotMarkers) {
  // Determine if this needs global replacement
  const needsGlobal = rmPatterns.has(replacement.match(/data-slot="([^"]+)"/)?.[1]);
  if (needsGlobal) {
    // Convert the RegExp to global
    const globalPat = new RegExp(pattern.source, 'g');
    mainContent = mainContent.replace(globalPat, replacement);
  } else {
    mainContent = mainContent.replace(pattern, replacement);
  }
}

// Fix: s2 body slot - apostrophe might not match, do a targeted replacement
mainContent = mainContent.replace(
  /<p class="body-lg">Whether you(’|')re a student/,
  `<p class="body-lg" data-slot="body">Whether you$1re a student`
);

// Build template HTML
const templateHtml = `${HEAD_LINKS}

${mainContent}`;

write(`templates/${TNAME}.html`, templateHtml);

// ── 6) DA DOCUMENT ────────────────────────────────────────────────────────────
// The branch for DA cell absolute image URLs
const BRANCH = 'forge-proto-mppkivgg';
const DA_IMG_BASE = `https://${BRANCH}--da-playground--adobecom.aem.page`;

// All images in this page are already at main--da-playground--adobecom.aem.live
// which is publicly reachable and Media Bus can sideload from there.
// We use those absolute URLs directly in DA cells.

const daDoc = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<header></header>
<main>
<div>
<div class="router-marquee">
  <div><div>slide-1.eyebrow</div><div>Creative Cloud</div></div>
  <div><div>slide-1.title</div><div><strong>Create at the highest level.</strong></div></div>
  <div><div>slide-1.body</div><div><p>Photoshop, Illustrator, Premiere, and much more. Work with the tools behind the world's most iconic creative content. Save 50% on Creative Cloud Pro for the <del>first three months</del>. <a href="https://www.adobe.com/offer-terms/cc-full-special-offer.html" target="_blank"><u>See terms</u></a>.</p></div></div>
  <div><div>slide-2.eyebrow</div><div>Firefly</div></div>
  <div><div>slide-2.title</div><div><strong>All the best models, all in one place.</strong></div></div>
  <div><div>slide-2.body</div><div><p>Quickly create and edit images, video, and audio with&nbsp;unlimited generations and the unbeatable value of Firefly.</p></div></div>
  <div><div>slide-3.eyebrow</div><div>Acrobat</div></div>
  <div><div>slide-3.title</div><div>Get work done. Faster.</div></div>
  <div><div>slide-3.body</div><div><p>Create, edit, share, and sign documents with trusted PDF tools. Use AI to make easy edits, get answers, generate summaries, and create polished content.</p></div></div>
  <div><div>slide-4.eyebrow</div><div>Adobe for Business</div></div>
  <div><div>slide-4.title</div><div>Use AI to create better customer experiences.</div></div>
  <div><div>slide-4.body</div><div><p>Unify data, content, and workflows with Adobe AI to move faster, personalize at scale, and show impact across your business.</p></div></div>
  <div><div>slide-5.eyebrow</div><div>Students and teachers</div></div>
  <div><div>slide-5.title</div><div><strong>Students and teachers save 71%.</strong></div></div>
  <div><div>slide-5.body</div><div><p>Save big on industry-standard tools with Creative Cloud Pro. Create designs, videos, presentations, and more—while building skills for your future.</p></div></div>
</div>
</div>

<div>
<div class="rich-content-intro">
  <div><div>heading</div><div>Everything you need to make anything.</div></div>
  <div><div>body</div><div><p>Whether you're a student, social influencer, creative professional, performance marketer, or global brand, Adobe has the apps you need to make it happen.</p></div></div>
</div>
</div>

<div>
<div class="elastic-carousel-section">
</div>
</div>

<div>
<div class="rich-content-features">
  <div><div>eyebrow</div><div>Features and Releases</div></div>
  <div><div>heading</div><div>Explore what's new.</div></div>
  <div><div>body</div><div><p>Discover the latest product features from Adobe.</p></div></div>
</div>
</div>

<div>
<div class="base-card-featured">
  <div><div>heading</div><div><strong>Upscale images instantly with AI.</strong></div></div>
  <div><div>body</div><div><p>Improve resolution, clarity, and sharpness while preserving detail—perfect for photos, designs, and creatives.</p></div></div>
  <div><div>cta</div><div><a href="https://www.adobe.com/products/firefly/features/image-upscaler.html">Explore Firefly</a></div></div>
</div>
</div>

<div>
<div class="base-card-three-up">
  <div><div>card-1.heading</div><div><strong>Work smarter than ever with documents.</strong></div></div>
  <div><div>card-1.body</div><div><p>Trusted PDF tools, now with AI for editing, insights, and content creation.</p></div></div>
  <div><div>card-1.cta</div><div><a href="https://www.adobe.com/acrobat.html">Explore Acrobat</a></div></div>
  <div><div>card-2.heading</div><div><strong>Generate with top AI models in one place.</strong></div></div>
  <div><div>card-2.body</div><div><p>Access Gemini 3.1 (with Nano Banana 2), GPT Image, Runway, FLUX models, Luma AI, and more.</p></div></div>
  <div><div>card-2.cta</div><div><a href="https://www.adobe.com/products/firefly/partner-models.html">Get started</a></div></div>
  <div><div>card-3.heading</div><div><strong>Blend images seamlessly with Harmonize.</strong></div></div>
  <div><div>card-3.body</div><div><p>Combine people and objects into any background instantly.</p></div></div>
  <div><div>card-3.cta</div><div><a href="https://www.adobe.com/products/photoshop/harmonize-image-blender.html">Get started</a></div></div>
</div>
</div>

<div>
<div class="carousel-c2-section">
</div>
</div>

<div>
<div class="section-spacer">
</div>
</div>

<div>
<div class="news-section">
  <div><div>news-1.heading</div><div>Adobe apps are top choice for Sundance filmmakers.</div></div>
  <div><div>news-1.body</div><div><p>85% of Sundance Filmmakers Choose Adobe as Company Releases New AI Video Innovations and $10M in Creator Grants.</p></div></div>
  <div><div>news-1.link</div><div><a href="https://news.adobe.com/news/2026/01/sundance-filmmakers-choose-adobe">Read story</a></div></div>
  <div><div>news-2.heading</div><div>Adobe's new Incubator creates the future.</div></div>
  <div><div>news-2.body</div><div><p>At Adobe, innovating for our customers has always been our north star. From pioneering digital creativity to reimagining the future of customer engagement, our mission has been to change the world through personalized digital experiences.</p></div></div>
  <div><div>news-2.link</div><div><a href="https://blog.adobe.com/en/publish/2025/11/17/adobes-new-incubator-creates-future">Read story</a></div></div>
  <div><div>news-3.heading</div><div>Adobe partners with OpenAI to test ads in ChatGPT.</div></div>
  <div><div>news-3.body</div><div><p>Adobe empowers marketing professionals with AI-driven Customer Experience Orchestration to create, deliver and optimize personalized digital experiences.</p></div></div>
  <div><div>news-3.link</div><div><a href="https://blog.adobe.com/en/publish/2026/02/09/adobe-partners-openai-test-ads-chatgpt">Read story</a></div></div>
</div>
</div>

<div>
<div class="rich-content-garage-door">
  <div><div>heading</div><div>Tools that work for you.</div></div>
  <div><div>body</div><div><p>Bring any idea to life with products for creators, businesses, and beyond.</p></div></div>
  <div><div>cta</div><div><a href="https://www.adobe.com/products/catalog.html">See all products</a></div></div>
</div>
</div>

<div>
<div class="product-grid-section">
  <div><div>card-1.title</div><div>Firefly</div></div>
  <div><div>card-1.body</div><div><p>Create and enhance images, video, and audio with AI-powered tools.</p></div></div>
  <div><div>card-2.title</div><div>Adobe&nbsp;Acrobat</div></div>
  <div><div>card-2.body</div><div><p>The complete AI-powered PDF and design solution for business workflows.</p></div></div>
  <div><div>card-3.title</div><div>Photoshop</div></div>
  <div><div>card-3.body</div><div><p>Create gorgeous images, rich graphics, and incredible art.</p></div></div>
  <div><div>card-4.title</div><div>Premiere</div></div>
  <div><div>card-4.body</div><div><p>Create everything from social clips to feature films with the leading video editor.</p></div></div>
  <div><div>card-5.title</div><div>Creative Cloud</div></div>
  <div><div>card-5.body</div><div><p>Get 20+ apps, including Photoshop, Illustrator, Premiere Pro, and Acrobat Pro.</p></div></div>
  <div><div>card-6.title</div><div>GenStudio</div></div>
  <div><div>card-6.body</div><div><p>Scale your content supply chain.</p></div></div>
  <div><div>card-7.title</div><div>Business Products</div></div>
  <div><div>card-7.body</div><div><p>Adobe solutions integrate our best-in-class products to help you tackle pressing business challenges.</p></div></div>
  <div><div>card-8.title</div><div>Illustrator</div></div>
  <div><div>card-8.body</div><div><p>Design precision vector graphics—from branding to illustration—that stay sharp, scalable, and fully editable at any size.</p></div></div>
  <div><div>card-9.title</div><div>All products</div></div>
  <div><div>card-9.body</div><div><p>See all Adobe products</p></div></div>
</div>
</div>

<div>
<div class="metadata">
  <div><div>template</div><div>${TNAME}</div></div>
  <div><div>title</div><div>DA Playground</div></div>
</div>
</div>

</main>
<footer></footer>
</body>
</html>`;

write(`.snowflake/projects/001-da-playground/output/da/${TNAME}.html`, daDoc);

console.log('[snowflake] Phase 3 generation complete!');
console.log(`[snowflake] Template: templates/${TNAME}.html`);
console.log(`[snowflake] Header fragment: fragments/${TNAME}/header.html`);
console.log(`[snowflake] Footer fragment: fragments/${TNAME}/footer.html`);
console.log(`[snowflake] CSS: styles/${TNAME}.css`);
console.log(`[snowflake] DA doc: .snowflake/projects/001-da-playground/output/da/${TNAME}.html`);
