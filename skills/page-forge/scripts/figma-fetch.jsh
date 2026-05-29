#!/usr/bin/env jsh
// figma-fetch.jsh — Figma REST helper (SLICC .jsh: global fetch/fs/process, top-level await).
// Pluggable extract seam: structure + node geometry + raster export, no MCP.
// Prefer SLICC's native Figma (logged-in browser session); use this only when the REST/raster
// path is needed. Token comes from the FIGMA_TOKEN secret (api.figma.com), never hardcoded.
//
// Usage:  figma-fetch.jsh <figma-url> [outDir=./input/figma] [scale=2]

const BASE = 'https://api.figma.com/v1';
const url = process.argv[2];
const outDir = process.argv[3] || './input/figma';
const scale = process.argv[4] || '2';
if (!url) { console.error('usage: figma-fetch.jsh <figma-url> [outDir] [scale]'); process.exit(1); }

// .design/.file URL → { key, nodeId } (node-id "a-b" → "a:b")
const key = url.match(/\/(?:file|design)\/([A-Za-z0-9]+)/)?.[1];
const rawNode = url.match(/[?&]node-id=([^&]+)/)?.[1];
const nodeId = rawNode ? decodeURIComponent(rawNode).replace(/-/g, ':') : null;
if (!key) { console.error('could not parse a Figma file key from the URL'); process.exit(1); }

// The FIGMA_TOKEN secret is injected by SLICC into api.figma.com requests; the X-Figma-Token
// header is the carrier. (If injection differs, Phase 0 surfaces it.)
async function figmaGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-Figma-Token': process.env.FIGMA_TOKEN || '' } });
  if (!res.ok) throw new Error(`Figma API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

function collectImageNodes(node, acc) {
  if (!node || typeof node !== 'object') return acc;
  if (Array.isArray(node.fills) && node.fills.some((f) => f?.type === 'IMAGE')) acc.push(node.id);
  for (const c of node.children || []) collectImageNodes(c, acc);
  return acc;
}

fs.mkdirSync(outDir, { recursive: true });

const nodes = await figmaGet(nodeId
  ? `/files/${key}/nodes?ids=${encodeURIComponent(nodeId)}&depth=6`
  : `/files/${key}?depth=4`);
fs.writeFileSync(`${outDir}/nodes.json`, JSON.stringify(nodes, null, 2));

const roots = nodes.nodes ? Object.values(nodes.nodes).map((n) => n.document) : [nodes.document];
const ids = new Set(nodeId ? [nodeId] : []);
for (const r of roots) collectImageNodes(r, []).forEach((id) => ids.add(id));

let images = {};
if (ids.size) {
  const exported = await figmaGet(`/images/${key}?ids=${encodeURIComponent([...ids].slice(0, 200).join(','))}&format=png&scale=${scale}`);
  images = exported.images || {};
}
fs.writeFileSync(`${outDir}/images.json`, JSON.stringify(images, null, 2));

console.log(JSON.stringify({ key, nodeId, outDir, nodeRoots: roots.length, imageNodes: Object.keys(images).length }));
