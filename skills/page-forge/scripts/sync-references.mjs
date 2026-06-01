#!/usr/bin/env node
// sync-references.mjs — build-time vendoring step (run on a machine that has the forge
// checkout). Pulls the C2 brief, Stardust design-knowledge, and compact block catalog out
// of the page-forge server modules and writes them into references/_vendored/ so the SLICC
// skill is self-contained and does not depend on the (private) forge repo at runtime.
//
// Usage (from anywhere):
//   FORGE_PAGE_FORGE=/Users/you/dev/forge/page-forge \
//   MILO_PATH=/Users/you/dev/milo \
//   node sync-references.mjs
//
// MILO_PATH is optional — c2Refs falls back to inline tokens if milo isn't present.
// design-knowledge.md is written only if the forge checkout has committed extractions.

import { writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const vendored = join(here, '..', 'references', '_vendored');
mkdirSync(vendored, { recursive: true });

const pf = process.env.FORGE_PAGE_FORGE
  || join(here, '..', '..', '..', 'page-forge'); // assumes forge/skills/page-forge layout
const imp = (rel) => import(pathToFileURL(join(pf, rel)).href);

const FORGE_ROOT = join(pf, '..');
const SKILLS_BASE = join(FORGE_ROOT, '.claude', 'skills');

let wrote = [];

// 1. Consonant 2 brief (reads process.env.MILO_PATH lazily; inline fallback otherwise).
try {
  const { buildC2PromptSection } = await imp('server/figma/c2Refs.js');
  const md = buildC2PromptSection();
  writeFileSync(join(vendored, 'c2-brief.md'), md || '# Consonant 2 brief\n\n(empty)\n');
  wrote.push(`c2-brief.md (${(md || '').length} chars)`);
} catch (e) {
  console.error('warn: c2-brief sync failed —', e.message);
}

// 2. Stardust design-knowledge (committed extractions; empty string if none).
try {
  const { buildDesignKnowledgeSection } = await imp('server/designKnowledge.js');
  const md = buildDesignKnowledgeSection();
  if (md) {
    writeFileSync(join(vendored, 'design-knowledge.md'), md);
    wrote.push(`design-knowledge.md (${md.length} chars)`);
  } else {
    console.error('note: no committed design-knowledge extractions — skipping design-knowledge.md');
  }
} catch (e) {
  console.error('warn: design-knowledge sync failed —', e.message);
}

// 3. Compact block catalog (used for optional ship-labeling; informational for redesign).
try {
  const { loadBlockIndex, buildCompactIndex } = await imp('server/figma/blockIndex.js');
  const idx = loadBlockIndex({
    sharedLibraryDir: join(FORGE_ROOT, 'shared/library'),
    catalogDir: join(SKILLS_BASE, 'block-knowledge-base/catalog'),
    designSystemDir: join(SKILLS_BASE, 'consonant-extract-refiner/design-system-index'),
  });
  const compact = buildCompactIndex(idx.library);
  writeFileSync(join(vendored, 'block-catalog.md'),
    `# Compact Milo block catalog\n\n${compact}\n`);
  wrote.push(`block-catalog.md (${idx.library.size} blocks)`);
} catch (e) {
  console.error('warn: block-catalog sync failed —', e.message);
}

// 4. Canonical C2 brand surface — the Reimagine engine injects this over each stardust
//    capture (see scripts/inject-c2-brand.jsh + references/redesign.md). It lives in the
//    forge server's design-knowledge dir; ship a copy so the skill is self-contained.
try {
  const srcDir = join(pf, 'server', 'design-knowledge', 'acom-c2-brand-extraction');
  const dstDir = join(vendored, 'acom-c2-brand-extraction');
  const brand = join(srcDir, '_brand-extraction.json');
  if (existsSync(brand)) {
    mkdirSync(dstDir, { recursive: true });
    copyFileSync(brand, join(dstDir, '_brand-extraction.json'));
    let extra = '';
    const design = join(srcDir, 'DESIGN.json');
    if (existsSync(design)) { copyFileSync(design, join(dstDir, 'DESIGN.json')); extra = ' + DESIGN.json'; }
    wrote.push(`acom-c2-brand-extraction/_brand-extraction.json${extra}`);
  } else {
    console.error(`warn: C2 brand surface not found at ${srcDir} — Reimagine injection will fail until vendored`);
  }
} catch (e) {
  console.error('warn: C2 brand sync failed —', e.message);
}

console.log('synced:', wrote.length ? wrote.join(', ') : '(nothing)');
