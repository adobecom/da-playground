// convergence.jsh -- Figma fidelity convergence loop orchestrator.
// SLICC port of forge's page-forge/server/figma/convergence.js.
//
// After the initial Figma->HTML extract (one-shot prompt), this loop self-corrects
// toward pixel accuracy by iterating: render -> screenshot -> diff -> correct -> repeat.
//
// Usage:  convergence <workdir> [--max-rounds=4] [--target=0.015] [--figma-url=<url>]
//
// Expected workdir layout (set up by the generate handler before calling this):
//   input/figma/nodes.json   -- Figma node structure (from figma-fetch.jsh)
//   input/figma/reference.png -- Figma frame raster @2x (from figma-fetch /images export)
//   output/v1.html           -- initial extract (from the figma-extract.md prompt)
//
// Output:
//   output/v<final>.html     -- the best version after convergence
//   output/convergence.json  -- full convergence log (round scores, decisions)
//   Prints JSON: { converged, finalVersion, rounds, scores }
//
// The loop terminates when:
//   - combined score < target threshold (converged = true), OR
//   - MAX_ROUNDS reached (converged = false, but returns the best version)
//   - score stops improving (plateau detection -- 2 rounds with <0.5% improvement)

// -- Args --
const workdir = process.argv[2];
if (!workdir) { console.error('usage: convergence <workdir> [--max-rounds=4] [--target=0.015]'); process.exit(1); }

function getFlag(name, def) {
  const f = process.argv.find(a => a.startsWith('--' + name + '='));
  return f ? f.split('=')[1] : def;
}

const MAX_ROUNDS = parseInt(getFlag('max-rounds', '4'));
const TARGET_MISMATCH = parseFloat(getFlag('target', '0.015'));

// -- Paths --
const nodesJson = workdir + '/input/figma/nodes.json';
const refPng = workdir + '/input/figma/reference.png';
const outputDir = workdir + '/output';

// Validate prerequisites
if (!(await fs.exists(nodesJson))) {
  console.error('ERROR: ' + nodesJson + ' not found -- run figma-fetch.jsh first');
  process.exit(2);
}

// If reference.png is missing, try to download from images.json
if (!(await fs.exists(refPng))) {
  const imagesJsonPath = workdir + '/input/figma/images.json';
  if (await fs.exists(imagesJsonPath)) {
    const images = JSON.parse(await fs.readFile(imagesJsonPath));
    const firstUrl = Object.values(images)[0];
    if (firstUrl) {
      console.error('INFO: reference.png not found, downloading from Figma export...');
      await fs.fetchToFile(firstUrl, refPng);
    }
  }
  if (!(await fs.exists(refPng))) {
    console.error('ERROR: ' + refPng + ' not found -- need the Figma frame export as reference');
    process.exit(2);
  }
}

const v1Path = outputDir + '/v1.html';
if (!(await fs.exists(v1Path))) {
  console.error('ERROR: ' + v1Path + ' not found -- need the initial extract');
  process.exit(2);
}

await fs.mkdir(outputDir);

// -- Convergence state --
const log = { rounds: [], finalVersion: 1, converged: false, target: TARGET_MISMATCH };
let currentVersion = 1;
let bestScore = Infinity;
let bestVersion = 1;
let plateauCount = 0;

// -- Score computation --
// From forge: combined = 0.45*pixelMismatch + 0.45*specMismatch + 0.10*(1-textPresence)
// Text is EXCLUDED from the pixel diff and graded by spec.js instead -- otherwise the
// substitute font makes the score floor high and the loop chases unwinnable pixels.
function combinedScore(pixel, spec, textPresence) {
  return (pixel * 0.45) + (spec * 0.45) + ((1 - (textPresence || 1)) * 0.10);
}

// -- Run one round of render -> diff -> score --
async function scoreRound(version, round) {
  const htmlPath = outputDir + '/v' + version + '.html';

  // 1. Render + pixel diff
  const diffResult = await exec(
    'render-diff "' + htmlPath + '" "' + refPng + '" "' + outputDir + '" --round=' + round
  ).catch(e => ({ stdout: '', stderr: (e.message || ''), exitCode: 1 }));

  let diff;
  try {
    diff = JSON.parse(diffResult.stdout.trim());
  } catch {
    console.error('WARN: render-diff failed for round ' + round + ': ' + (diffResult.stderr || diffResult.stdout));
    return null;
  }

  // 2. Spec score
  const specResult = await exec(
    'spec-score "' + nodesJson + '" "' + htmlPath + '"'
  ).catch(e => ({ stdout: '{}', stderr: (e.message || ''), exitCode: 1 }));

  let spec;
  try {
    spec = JSON.parse(specResult.stdout.trim());
  } catch {
    console.error('WARN: spec-score failed for round ' + round);
    spec = { specScore: 0 };
  }

  // 3. Combined
  const combined = combinedScore(diff.mismatch, spec.specScore, diff.presence);

  return {
    round: round,
    version: version,
    pixel: diff.mismatch,
    spec: spec.specScore,
    presence: diff.presence,
    combined: combined,
    regionScores: diff.regionScores || [],
    renderPng: diff.renderPng,
    specDetails: spec.details,
  };
}

// -- Build a correction prompt from the diff data --
function buildCorrectionPrompt(score, version) {
  const regions = (score.regionScores || []).slice(0, 4);
  const regionDesc = regions.map(r =>
    '  - Grid [row ' + r.row + ', col ' + r.col + ']: ' + (r.mismatch * 100).toFixed(1) + '% mismatch'
  ).join('\n');

  const specIssues = [];
  if (score.specDetails) {
    if (score.specDetails.typography > 0.2) specIssues.push('font sizes do not match the Figma spec');
    if (score.specDetails.colors > 0.2) specIssues.push('color values differ from the Figma palette');
    if (score.specDetails.weights > 0.3) specIssues.push('font weights are off');
    if (score.specDetails.radii > 0.3) specIssues.push('border radii do not match');
  }

  return 'CONVERGENCE CORRECTION -- Round ' + (score.round + 1) + '\n\n' +
    'You produced output/v' + version + '.html. A pixel comparison against the Figma reference shows:\n' +
    '- Overall mismatch: ' + (score.pixel * 100).toFixed(2) + '% (target: <' + (TARGET_MISMATCH * 100).toFixed(1) + '%)\n' +
    '- Spec fidelity score: ' + (score.spec * 100).toFixed(1) + '% deviation\n' +
    '- Presence (structural similarity): ' + ((score.presence || 1) * 100).toFixed(1) + '%\n\n' +
    'WORST REGIONS (4x4 grid of the page):\n' +
    (regionDesc || '  (no significant regional differences)') + '\n\n' +
    (specIssues.length ? 'SPEC ISSUES:\n' + specIssues.map(i => '  - ' + i).join('\n') + '\n\n' : '') +
    'TASK: Read output/v' + version + '.html and the Figma reference data (input/figma/nodes.json).\n' +
    'Fix ONLY the mismatched areas -- do not rewrite working sections. Focus on:\n' +
    '1. The worst regions listed above (check spacing, alignment, colors in those quadrants)\n' +
    '2. Any spec issues (exact font sizes, exact hex colors from Figma)\n' +
    '3. Preserve everything that already matches\n\n' +
    'Write the corrected version to output/v' + (version + 1) + '.html.\n' +
    'Keep it self-contained (inline styles, no external deps). Follow ALL rules from\n' +
    'references/figma-extract.md sections 1-5.';
}

// -- Main loop --
console.error('INFO: Starting convergence loop (max ' + MAX_ROUNDS + ' rounds, target mismatch: ' + TARGET_MISMATCH + ')');

for (let round = 0; round < MAX_ROUNDS; round++) {
  console.error('INFO: Round ' + (round + 1) + '/' + MAX_ROUNDS + ' -- scoring v' + currentVersion + '...');

  const score = await scoreRound(currentVersion, round);
  if (!score) {
    console.error('WARN: scoring failed for round ' + (round + 1) + ', stopping');
    break;
  }

  log.rounds.push(score);
  console.error('INFO: Round ' + (round + 1) + ' -- combined: ' + score.combined.toFixed(4) +
    ' (pixel: ' + (score.pixel * 100).toFixed(1) + '%, spec: ' + (score.spec * 100).toFixed(1) + '%)');

  // Track best -- revert any regressing round (keep best version)
  if (score.combined < bestScore) {
    const improvement = bestScore === Infinity ? 1 : (bestScore - score.combined) / bestScore;
    bestScore = score.combined;
    bestVersion = currentVersion;
    // Bail under 0.005 gain (diminishing returns)
    plateauCount = improvement < 0.005 ? plateauCount + 1 : 0;
  } else {
    // Score regressed -- revert to best version for next correction attempt
    console.error('WARN: Round ' + (round + 1) + ' regressed (score ' + score.combined.toFixed(4) +
      ' > best ' + bestScore.toFixed(4) + '). Reverting to v' + bestVersion + '.');
    currentVersion = bestVersion;
    plateauCount++;
  }

  // Check termination conditions
  if (score.combined <= TARGET_MISMATCH) {
    console.error('INFO: Converged! Combined score ' + score.combined.toFixed(4) + ' <= target ' + TARGET_MISMATCH);
    log.converged = true;
    break;
  }

  if (plateauCount >= 2) {
    console.error('INFO: Plateau detected (2 rounds without meaningful improvement). Stopping at v' + bestVersion + '.');
    break;
  }

  if (round === MAX_ROUNDS - 1) {
    console.error('INFO: Max rounds reached. Best version: v' + bestVersion + ' (score: ' + bestScore.toFixed(4) + ')');
    break;
  }

  // -- Correction: spawn a one-shot agent to fix the HTML --
  console.error('INFO: Round ' + (round + 1) + ' -- dispatching correction agent for v' + (currentVersion + 1) + '...');

  const correctionPrompt = buildCorrectionPrompt(score, currentVersion);
  const nextVersion = currentVersion + 1;

  // Use `agent` for a one-shot fire-and-forget correction
  const agentResult = await exec(
    'agent "' + workdir + '" "" ' + JSON.stringify(correctionPrompt)
  ).catch(e => ({ stdout: '', stderr: (e.message || ''), exitCode: 1 }));

  if (agentResult.exitCode && agentResult.exitCode !== 0) {
    console.error('WARN: correction agent exited with code ' + agentResult.exitCode);
  }

  // Check if the correction produced a new file
  const nextPath = outputDir + '/v' + nextVersion + '.html';
  if (!(await fs.exists(nextPath))) {
    console.error('WARN: correction agent did not produce ' + nextPath + '. Stopping.');
    break;
  }

  currentVersion = nextVersion;
}

// -- Final output --
log.finalVersion = bestVersion;

// Write convergence log
await fs.writeFile(outputDir + '/convergence.json', JSON.stringify(log, null, 2));

// Output summary
console.log(JSON.stringify({
  converged: log.converged,
  finalVersion: bestVersion,
  rounds: log.rounds.length,
  bestScore: Math.round(bestScore * 10000) / 10000,
  target: TARGET_MISMATCH,
  scores: log.rounds.map(r => ({
    round: r.round + 1,
    combined: Math.round(r.combined * 10000) / 10000,
    pixel: Math.round(r.pixel * 10000) / 10000,
  })),
}));
