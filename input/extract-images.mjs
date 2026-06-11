#!/usr/bin/env node
/**
 * Extract base64 data-URI images from bespoke.html into separate files.
 * Also extracts inline SVGs that have class attributes we recognize.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(new URL('./bespoke.html', import.meta.url), 'utf8');
const outDir = new URL('./assets/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const mapping = {};
let count = 0;

// Match src="data:image/jpeg;base64,..." or src="data:image/svg+xml;base64,..."
const dataUriRe = /src="(data:(image\/(?:jpeg|png|gif|webp|svg\+xml));base64,([^"]+))"/g;
let m;
while ((m = dataUriRe.exec(html)) !== null) {
  const [, full, mime, b64] = m;
  const ext = mime === 'image/jpeg' ? '.jpg'
    : mime === 'image/png' ? '.png'
    : mime === 'image/gif' ? '.gif'
    : mime === 'image/webp' ? '.webp'
    : mime === 'image/svg+xml' ? '.svg'
    : '.bin';
  const name = `img-${String(count).padStart(3, '0')}${ext}`;
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(join(outDir, name), buf);
  mapping[full] = name;
  console.log(`extracted: ${name} (${(buf.length / 1024).toFixed(1)} KB, ${mime})`);
  count++;
}

writeFileSync(join(outDir, 'image-map.json'), JSON.stringify(mapping, null, 2));
console.log(`\nTotal: ${count} images extracted to ${outDir}`);
