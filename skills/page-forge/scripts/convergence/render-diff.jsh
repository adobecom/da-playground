// render-diff.jsh -- Render HTML to PNG and pixel-diff against a reference image.
// SLICC port of forge's page-forge/server/figma/renderDiff.js.
//
// Uses playwright-cli (screenshot) + a served canvas utility page (pixel-diff-util.html)
// instead of Node's Playwright + pixelmatch/pngjs.
//
// Usage:  render-diff <html-path> <reference-png> <output-dir> [--round=N]
// Output: JSON { mismatch, diffPixels, regionScores, presence, renderPng, round }
//
// The utility page (pixel-diff-util.html) is served on first call and reused across rounds.
// Tab IDs are echoed to stderr for reuse.

const htmlPath = process.argv[2];
const refPng = process.argv[3];
const outDir = process.argv[4] || '.';
const roundFlag = (process.argv.find(a => a.startsWith('--round=')) || '').split('=')[1] || '0';
const round = parseInt(roundFlag);

if (!htmlPath || !refPng) {
  console.error('usage: render-diff <html-path> <reference-png> <output-dir> [--round=N]');
  process.exit(1);
}
if (!(await fs.exists(htmlPath))) { console.error('ERROR: HTML not found: ' + htmlPath); process.exit(2); }
if (!(await fs.exists(refPng))) { console.error('ERROR: reference PNG not found: ' + refPng); process.exit(2); }

// -- Resolve the convergence utility directory --
const scriptPath = process.argv[1] || '';
const utilDir = scriptPath.replace(/\/[^/]*$/, '') || '/workspace/skills/page-forge/scripts/convergence';

// -- Ensure the pixel-diff utility page is served --
async function ensureDiffTab() {
  // Check if we already have a served instance by looking for the served dir marker
  const markerPath = outDir + '/.diff-tab-id';
  if (await fs.exists(markerPath)) {
    const tabId = (await fs.readFile(markerPath)).trim();
    // Verify the tab is still alive
    const check = await exec('playwright-cli eval --tab=' + tabId + ' "typeof window.pixelDiff"').catch(() => null);
    if (check && check.stdout.trim() === 'function') return tabId;
  }

  // Serve the utility page directory
  const serveResult = await exec('serve ' + utilDir);
  const tabMatch = serveResult.stdout.match(/targetId:\s*(\d+)/);
  if (!tabMatch) {
    console.error('ERROR: failed to serve pixel-diff-util.html: ' + serveResult.stdout + serveResult.stderr);
    process.exit(3);
  }
  const tabId = tabMatch[1];

  // Wait for page to load
  await new Promise(r => setTimeout(r, 800));

  // The page script may not auto-execute in serve context. Inject pixelDiff if needed.
  const verify = await exec('playwright-cli eval --tab=' + tabId + ' "typeof window.pixelDiff"');
  if (verify.stdout.trim() !== 'function') {
    // Inject the pixel diff function directly
    console.error('INFO: injecting pixelDiff function into served page');
    await exec('playwright-cli eval --tab=' + tabId + ' "' + INJECT_PIXEL_DIFF.replace(/"/g, '\\"') + '"');
  }

  // Persist tab ID for reuse in subsequent rounds
  await fs.writeFile(markerPath, tabId);
  return tabId;
}

// Minimal inline pixel-diff function (injected if the HTML script doesn't auto-run)
const INJECT_PIXEL_DIFF = `
window.pixelDiff = async function(refUrl, renUrl, options) {
  options = options || {};
  var maxWidth = options.maxWidth || 700;
  var masked = options.masked !== false;
  function loadImg(url) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() { resolve(img); };
      img.onerror = function() { reject(new Error('load failed: ' + url)); };
      img.src = url;
    });
  }
  var imgs = await Promise.all([loadImg(refUrl), loadImg(renUrl)]);
  var refImg = imgs[0], renImg = imgs[1];
  var w = Math.min(refImg.width, maxWidth);
  var h = Math.round(w * (refImg.height / refImg.width));
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var ctx = c.getContext('2d');
  ctx.drawImage(refImg, 0, 0, w, h);
  var d1 = ctx.getImageData(0, 0, w, h).data;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(renImg, 0, 0, w, h);
  var d2 = ctx.getImageData(0, 0, w, h).data;
  var diffPixels = 0;
  var THRESHOLD = 35;
  var GRID = 4;
  var cellW = Math.ceil(w / GRID), cellH = Math.ceil(h / GRID);
  var regionDiffs = new Array(GRID * GRID).fill(0);
  var regionTotals = new Array(GRID * GRID).fill(0);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      var col = Math.min(Math.floor(x / cellW), GRID - 1);
      var row = Math.min(Math.floor(y / cellH), GRID - 1);
      var ri = row * GRID + col;
      regionTotals[ri]++;
      var dr = Math.abs(d1[i] - d2[i]);
      var dg = Math.abs(d1[i+1] - d2[i+1]);
      var db = Math.abs(d1[i+2] - d2[i+2]);
      if (dr > THRESHOLD || dg > THRESHOLD || db > THRESHOLD) {
        diffPixels++;
        regionDiffs[ri]++;
      }
    }
  }
  var regionScores = regionDiffs.map(function(d, idx) {
    return { row: Math.floor(idx/GRID), col: idx%GRID, mismatch: regionTotals[idx] > 0 ? d/regionTotals[idx] : 0, diffPixels: d };
  }).sort(function(a,b) { return b.mismatch - a.mismatch; }).slice(0, 6);
  return {
    width: w, height: h,
    totalPixels: w * h, diffPixels: diffPixels,
    mismatch: diffPixels / (w * h),
    regionScores: regionScores,
    refOriginal: { width: refImg.width, height: refImg.height },
    renOriginal: { width: renImg.width, height: renImg.height },
    masked: masked,
    aspectMatch: Math.abs((refImg.height/refImg.width) - (renImg.height/renImg.width)) < 0.05
  };
};
window.presenceScore = async function(refUrl, renUrl) {
  function loadImg(url) {
    return new Promise(function(resolve, reject) {
      var img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = function() { resolve(img); }; img.onerror = reject; img.src = url;
    });
  }
  var imgs = await Promise.all([loadImg(refUrl), loadImg(renUrl)]);
  var w = 320;
  var c = document.createElement('canvas');
  function profile(img) {
    var ph = Math.round(w * (img.height / img.width));
    c.width = w; c.height = ph;
    var ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, ph);
    var data = ctx.getImageData(0, 0, w, ph).data;
    var bands = 16, bandH = Math.ceil(ph / bands), out = [];
    for (var b = 0; b < bands; b++) {
      var r=0,g=0,bl=0,count=0;
      for (var y = b*bandH; y < Math.min((b+1)*bandH, ph); y++)
        for (var x = 0; x < w; x++) { var i=(y*w+x)*4; r+=data[i]; g+=data[i+1]; bl+=data[i+2]; count++; }
      if (count>0) out.push([r/count, g/count, bl/count]);
    }
    return out;
  }
  var p1 = profile(imgs[0]), p2 = profile(imgs[1]);
  var len = Math.min(p1.length, p2.length), total = 0;
  for (var i = 0; i < len; i++) {
    total += (Math.abs(p1[i][0]-p2[i][0]) + Math.abs(p1[i][1]-p2[i][1]) + Math.abs(p1[i][2]-p2[i][2])) / (3*255);
  }
  return { presence: 1 - (total / len), bands: len };
};
'injected';
`;

// -- Main --
const diffTabId = await ensureDiffTab();

// Open the HTML for rendering (or reuse existing render tab)
const renderMarker = outDir + '/.render-tab-id';
let renderTabId;
if (await fs.exists(renderMarker)) {
  renderTabId = (await fs.readFile(renderMarker)).trim();
  // Navigate to new HTML
  await exec('playwright-cli goto "' + htmlPath + '" --tab=' + renderTabId).catch(() => null);
} else {
  const openResult = await exec('playwright-cli open ' + htmlPath);
  const tabMatch = openResult.stdout.match(/targetId:\s*(\d+)/);
  if (!tabMatch) { console.error('ERROR: failed to open HTML for rendering'); process.exit(3); }
  renderTabId = tabMatch[1];
  await fs.writeFile(renderMarker, renderTabId);
}

// Wait for page render
await new Promise(r => setTimeout(r, 1200));

// Screenshot the rendered page
const renderPng = outDir + '/render-' + round + '.png';
const shotResult = await exec('playwright-cli screenshot --tab=' + renderTabId + ' --filename=' + renderPng + ' --fullPage=true');
if (!(await fs.exists(renderPng))) {
  console.error('ERROR: screenshot failed: ' + shotResult.stdout + shotResult.stderr);
  process.exit(4);
}

// Copy both images into the served utility dir so canvas can load them (same origin)
const refCopy = utilDir + '/ref-current.png';
const renCopy = utilDir + '/ren-current.png';

// Copy using binary read/write
const refBin = await fs.readFileBinary(refPng);
await fs.writeFileBinary(refCopy, refBin);
const renBin = await fs.readFileBinary(renderPng);
await fs.writeFileBinary(renCopy, renBin);

// Run pixel diff via canvas
const diffCmd = 'playwright-cli eval --tab=' + diffTabId + " \"(async()=>{try{const r=await window.pixelDiff('./ref-current.png','./ren-current.png',{masked:true});return JSON.stringify(r)}catch(e){return JSON.stringify({error:e.message})}})()\"";
const diffResult = await exec(diffCmd);

let diffData;
try {
  diffData = JSON.parse(diffResult.stdout.trim());
} catch (e) {
  console.error('ERROR: failed to parse diff result: ' + diffResult.stdout);
  process.exit(5);
}

if (diffData.error) {
  console.error('ERROR: pixel diff failed: ' + diffData.error);
  process.exit(5);
}

// Run presence check
const presCmd = 'playwright-cli eval --tab=' + diffTabId + " \"(async()=>{try{const r=await window.presenceScore('./ref-current.png','./ren-current.png');return JSON.stringify(r)}catch(e){return JSON.stringify({error:e.message})}})()\"";
const presResult = await exec(presCmd);
let presenceData = { presence: 1 };
try { presenceData = JSON.parse(presResult.stdout.trim()); } catch {}

// Clean up temp image copies
await fs.rm(refCopy).catch(() => {});
await fs.rm(renCopy).catch(() => {});

// Output combined result
console.log(JSON.stringify({
  round: round,
  mismatch: diffData.mismatch,
  diffPixels: diffData.diffPixels,
  totalPixels: diffData.totalPixels,
  regionScores: diffData.regionScores || [],
  presence: presenceData.presence || 1,
  aspectMatch: diffData.aspectMatch,
  renderPng: renderPng,
  refOriginal: diffData.refOriginal,
  renOriginal: diffData.renOriginal,
}));
