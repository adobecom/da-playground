// spec-score.jsh -- Font-agnostic typography/color scoring from Figma node data.
// SLICC port of forge's page-forge/server/figma/spec.js.
//
// Pure JS -- no browser/screenshot needed. Compares the Figma-declared visual spec
// (from nodes.json) against what the generated HTML declares (parsed from the CSS).
//
// Usage:  spec-score <figma-nodes-json> <generated-html-path>
// Output: JSON { specScore, details: { typography, colors, spacing, layout } }
//
// The score is 0-1 (0 = perfect match, 1 = total mismatch). Used by convergence.jsh
// as one of three signals (pixel + spec + presence) to decide if another round is needed.

const nodesPath = process.argv[2];
const htmlPath = process.argv[3];
if (!nodesPath || !htmlPath) {
  console.error('usage: spec-score <figma-nodes-json> <html-path>');
  process.exit(1);
}

if (!(await fs.exists(nodesPath))) { console.error('ERROR: nodes file not found: ' + nodesPath); process.exit(2); }
if (!(await fs.exists(htmlPath))) { console.error('ERROR: html file not found: ' + htmlPath); process.exit(2); }

const nodesData = JSON.parse(await fs.readFile(nodesPath));
const htmlContent = await fs.readFile(htmlPath);

// -- Extract Figma spec from nodes --

function extractFigmaSpec(data) {
  const spec = { fonts: [], colors: [], fontSizes: [], fontWeights: [], lineHeights: [], radii: [] };

  function walkNode(node) {
    if (!node || typeof node !== 'object') return;

    // Typography from style
    if (node.style) {
      const s = node.style;
      if (s.fontFamily) spec.fonts.push(s.fontFamily);
      if (s.fontSize) spec.fontSizes.push(s.fontSize);
      if (s.fontWeight) spec.fontWeights.push(s.fontWeight);
      if (s.lineHeightPx) spec.lineHeights.push(s.lineHeightPx);
    }

    // Colors from fills
    if (Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const { r, g, b } = fill.color;
          spec.colors.push(rgbToHex(r, g, b));
        }
      }
    }

    // Border radius
    if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
      spec.radii.push(node.cornerRadius);
    }

    // Recurse children
    if (Array.isArray(node.children)) {
      for (const child of node.children) walkNode(child);
    }
  }

  // Handle both file-level and node-level responses
  const roots = data.nodes
    ? Object.values(data.nodes).map(n => n.document)
    : [data.document];

  for (const root of roots) walkNode(root);

  return spec;
}

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// -- Extract declared CSS values from generated HTML --

function extractHtmlSpec(html) {
  const spec = { fonts: [], colors: [], fontSizes: [], fontWeights: [], lineHeights: [], radii: [] };

  // Extract from <style> blocks
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (!styleMatch) return spec;
  const css = styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

  // Font families
  const fontFamilyRe = /font-family:\s*([^;}\n]+)/gi;
  let m;
  while ((m = fontFamilyRe.exec(css)) !== null) {
    const families = m[1].split(',').map(f => f.trim().replace(/["']/g, ''));
    spec.fonts.push(...families.filter(f => !['sans-serif', 'serif', 'monospace', 'inherit'].includes(f)));
  }

  // Font sizes (px)
  const fontSizeRe = /font-size:\s*(\d+(?:\.\d+)?)\s*px/gi;
  while ((m = fontSizeRe.exec(css)) !== null) spec.fontSizes.push(parseFloat(m[1]));

  // Font weights
  const fontWeightRe = /font-weight:\s*(\d+)/gi;
  while ((m = fontWeightRe.exec(css)) !== null) spec.fontWeights.push(parseInt(m[1]));

  // Line heights (px)
  const lineHeightRe = /line-height:\s*(\d+(?:\.\d+)?)\s*px/gi;
  while ((m = lineHeightRe.exec(css)) !== null) spec.lineHeights.push(parseFloat(m[1]));

  // Colors (hex)
  const colorRe = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  while ((m = colorRe.exec(css)) !== null) {
    let hex = m[1];
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    spec.colors.push('#' + hex.toLowerCase());
  }

  // Border radii
  const radiusRe = /border-radius:\s*(\d+(?:\.\d+)?)\s*px/gi;
  while ((m = radiusRe.exec(css)) !== null) spec.radii.push(parseFloat(m[1]));

  return spec;
}

// -- Scoring: compare Figma spec vs HTML spec --

function uniqueSorted(arr) { return [...new Set(arr)].sort(); }

// Font-agnostic: don't penalize font name differences (different rendering environments).
// Score based on: size scale match, weight distribution, color palette overlap.
function scoreTypography(figma, html) {
  const figmaSizes = uniqueSorted(figma.fontSizes);
  const htmlSizes = uniqueSorted(html.fontSizes);

  if (figmaSizes.length === 0) return 0;

  let matched = 0;
  for (const fs2 of figmaSizes) {
    const found = htmlSizes.some(hs => Math.abs(hs - fs2) / fs2 < 0.1); // 10% tolerance
    if (found) matched++;
  }
  return 1 - (matched / figmaSizes.length);
}

function scoreColors(figma, html) {
  const figmaColors = uniqueSorted(figma.colors);
  const htmlColors = uniqueSorted(html.colors);

  if (figmaColors.length === 0) return 0;

  let totalDelta = 0;
  for (const fc of figmaColors) {
    let minDelta = 1;
    for (const hc of htmlColors) {
      const delta = colorDelta(fc, hc);
      if (delta < minDelta) minDelta = delta;
    }
    totalDelta += minDelta;
  }
  return totalDelta / figmaColors.length;
}

function colorDelta(hex1, hex2) {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  return (Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)) / (3 * 255);
}

function scoreWeights(figma, html) {
  const figmaW = uniqueSorted(figma.fontWeights);
  const htmlW = uniqueSorted(html.fontWeights);
  if (figmaW.length === 0) return 0;

  let matched = 0;
  for (const fw of figmaW) {
    if (htmlW.some(hw => Math.abs(hw - fw) <= 100)) matched++;
  }
  return 1 - (matched / figmaW.length);
}

function scoreRadii(figma, html) {
  const figmaR = uniqueSorted(figma.radii);
  const htmlR = uniqueSorted(html.radii);
  if (figmaR.length === 0) return 0;

  let matched = 0;
  for (const fr of figmaR) {
    if (htmlR.some(hr => Math.abs(hr - fr) <= 2)) matched++;
  }
  return 1 - (matched / figmaR.length);
}

// -- Main --

const figmaSpec = extractFigmaSpec(nodesData);
const htmlSpec = extractHtmlSpec(htmlContent);

const typography = scoreTypography(figmaSpec, htmlSpec);
const colors = scoreColors(figmaSpec, htmlSpec);
const weights = scoreWeights(figmaSpec, htmlSpec);
const radii = scoreRadii(figmaSpec, htmlSpec);

// Combined spec score (weighted -- colors and typography matter most)
const specScore = (typography * 0.3) + (colors * 0.4) + (weights * 0.15) + (radii * 0.15);

console.log(JSON.stringify({
  specScore: Math.round(specScore * 10000) / 10000,
  details: {
    typography: Math.round(typography * 10000) / 10000,
    colors: Math.round(colors * 10000) / 10000,
    weights: Math.round(weights * 10000) / 10000,
    radii: Math.round(radii * 10000) / 10000,
  },
  figmaSpec: {
    fonts: uniqueSorted(figmaSpec.fonts).slice(0, 5),
    fontSizes: uniqueSorted(figmaSpec.fontSizes).slice(0, 10),
    colors: uniqueSorted(figmaSpec.colors).slice(0, 10),
  },
  htmlSpec: {
    fonts: uniqueSorted(htmlSpec.fonts).slice(0, 5),
    fontSizes: uniqueSorted(htmlSpec.fontSizes).slice(0, 10),
    colors: uniqueSorted(htmlSpec.colors).slice(0, 10),
  },
}));
