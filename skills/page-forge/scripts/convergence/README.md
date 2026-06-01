# Convergence Loop (SLICC port of forge/page-forge/server/figma/)

Port of the Figma fidelity engine from `page-forge/server/figma/`:
- `convergence.js` → `convergence.jsh`  (orchestrator)
- `renderDiff.js`  → `render-diff.jsh`  (screenshot + masked pixel diff)
- `spec.js`        → `spec-score.jsh`   (font-agnostic typography/color scoring)
- `figmaClient.js` → already exists as `../figma-fetch.jsh`

## How it works

After the first Figma → HTML extract (prompt-only, one-shot), the convergence loop
self-corrects toward pixel accuracy:

```
Round 0: figma-fetch.jsh → reference.png (the Figma frame @2x)
         first extract → v1.html (from figma-extract.md)

Round N (max 4):
  1. render-diff.jsh: serve v<N>.html → playwright-cli screenshot → render-<N>.png
  2. render-diff.jsh: canvas pixel-diff (reference vs render, masked) → mismatch score
  3. spec-score.jsh: typography/color scoring from Figma node data → spec score
  4. combined score = pixel + spec + presence
  5. if combined < 0.015 → DONE (close enough)
  6. else: feed correction prompt with diff regions + scores → agent writes v<N+1>.html
```

## SLICC primitives used

| Capability | Implementation |
|---|---|
| Render HTML to PNG | `serve <dir>` + `playwright-cli screenshot --tab=<id>` |
| Pixel-diff two PNGs | Canvas-based diff in a utility page via `playwright-cli eval` |
| Figma reference image | `figma-fetch.jsh` (REST `/images` export) |
| Correction agent | `exec('agent <workdir> "" "<correction prompt>"')` or direct re-prompt |
| Spec scoring | Pure JS — Figma node data → typography/color deltas (no browser needed) |

## Integration with generate flow

The convergence loop wraps around `references/figma-extract.md`:
1. `generate` (mode: match, source: figma) calls `convergence.jsh`
2. `convergence.jsh` runs the initial extract, then iterates up to MAX_ROUNDS
3. Each round produces a new version that replaces the last
4. Final output = the best version → emitted as the `preview`

Only Figma-source generates run the convergence loop. URL/HTML match is passthrough.
