#!/usr/bin/env node
/**
 * Extract base64-encoded images from bespoke.html and save as files.
 * Maps each image to its context (section + index) for naming.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync('/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/input/bespoke.html', 'utf8');
const outDir = '/Users/osahin/repos/forge/shared/data/d8418073-27a7-4dcd-a56f-16ffa18e3f0c-proto-mqrz1jk6/.snowflake/projects/001-figma-d84180/output/assets';
mkdirSync(outDir, { recursive: true });

// Extract all img src attributes with context
const imgRegex = /<img([^>]*)src="(data:image\/([a-z]+);base64,([^"]+))"([^>]*)>/g;
let match;
const images = [];
let idx = 0;

while ((match = imgRegex.exec(html)) !== null) {
  const before = html.slice(Math.max(0, match.index - 500), match.index);
  const attrs = match[1] + match[5];
  const mime = match[3];
  const b64 = match[4];
  const ext = mime === 'jpeg' ? 'jpg' : mime;

  // Determine context from surrounding HTML
  let ctx = 'img';
  if (before.includes('tab-img')) ctx = 'tab';
  else if (before.includes('feature-visual')) ctx = 'feature';
  else if (before.includes('wn-img')) ctx = 'whats-new';
  else if (before.includes('doc-thumb')) ctx = 'doc';
  else if (before.includes('image-inventory')) ctx = 'inventory';
  else if (before.includes('plan-icon')) ctx = 'plan-icon';

  // Extract alt if present
  const altMatch = attrs.match(/alt="([^"]*)"/);
  const alt = altMatch ? altMatch[1].replace(/[^a-z0-9-]/gi, '-').slice(0, 30) : `img-${idx}`;

  const filename = `${ctx}-${idx}-${alt}.${ext}`.replace(/--+/g, '-').replace(/^-|-$/g, '');
  const filepath = join(outDir, filename);

  const buf = Buffer.from(b64, 'base64');
  writeFileSync(filepath, buf);

  images.push({
    idx,
    ctx,
    alt,
    filename,
    mime: `image/${mime}`,
    size: buf.length,
    offset: match.index,
  });

  console.log(`${idx}: ${ctx} → ${filename} (${buf.length} bytes)`);
  idx++;
}

writeFileSync(
  join(outDir, '../image-manifest.json'),
  JSON.stringify(images, null, 2)
);
console.log(`\nExtracted ${images.length} images to ${outDir}`);
