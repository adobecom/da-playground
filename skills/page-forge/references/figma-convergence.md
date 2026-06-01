# Figma convergence loop — self-correction toward pixel accuracy

Wraps the initial Figma → HTML extract (`figma-extract.md`) with an iterative render → diff →
correct loop that converges toward the Figma reference image. Port of
`forge/page-forge/server/figma/convergence.js`.

## When to use

**Every Figma-source `generate` (mode: match)** runs through the convergence loop:
1. Initial extract → v1 (from `references/figma-extract.md`)
2. Convergence loop → v2, v3, … (from `scripts/convergence/convergence.jsh`)
3. Best version → emitted as the preview

URL/HTML match skips this entirely (no reference image to converge toward).

## Prerequisites (set up by the generate handler)

Before calling `convergence.jsh`:

```bash
# 1. Fetch Figma structure + reference image
figma-fetch <figma-url> <workdir>/input/figma

# 2. The reference PNG must exist (the primary image export from figma-fetch)
#    It's at <workdir>/input/figma/reference.png — or download from images.json
#    (convergence.jsh does this automatically if reference.png is missing)

# 3. The initial extract (v1) must exist at output/v1.html
#    This comes from the figma-extract.md prompt (the scoop writes it)
```

## Running the loop

```bash
convergence <workdir> [--max-rounds=4] [--target=0.015] [--figma-url=<url>]
```

The orchestrator:
1. Scores v1 (render → screenshot → pixel-diff + spec-score)
2. If score ≤ target → done (emit v1 as preview)
3. Else: spawns a correction agent with the diff regions + spec issues
4. Agent writes v2; loop scores v2; repeat until converged or max rounds

### Termination conditions
- **Converged**: combined score ≤ 0.015 (TARGET_RATIO)
- **Max rounds**: 4 — returns the best version seen
- **Plateau**: bail under 0.005 gain (2 consecutive rounds with < 0.5% improvement)
- **Regression**: any round that scores worse than the best is reverted; correction
  re-attempts from the best-so-far version

### Combined score formula (from forge)
```
combined = 0.45 * pixelMismatch + 0.45 * specMismatch + 0.10 * (1 - textPresence)
```
- **pixelMismatch**: fraction of differing pixels. Text is EXCLUDED from the pixel diff
  (masked) — otherwise substitute fonts make the score floor high and the loop chases
  unwinnable pixels. Image/background-image rects also masked; text rects ON images
  re-included. Downscaled to ~700px before comparing.
- **specMismatch**: typography + color + weight + radii delta from Figma node data (spec.js).
  This is where text fidelity is graded instead — font-agnostic, uses Figma node style data.
- **textPresence**: structural presence of text elements (graded separately since pixels lie
  about text with substitute fonts).

### Loop control (from forge)
- MAX_ROUNDS = 4
- TARGET_RATIO = 0.015 (converged when combined ≤ this)
- Bail under 0.005 gain (plateau — two rounds without meaningful improvement)
- Keep best / revert any regressing round (correction that made things worse is discarded)
- `figma-fetch.jsh` fetches at depth=30 (the full component tree — shallower misses nested text)

## Output

```json
{
  "converged": true,
  "finalVersion": 3,
  "rounds": 3,
  "bestScore": 0.0112,
  "target": 0.015,
  "scores": [
    { "round": 1, "combined": 0.0891, "pixel": 0.1245 },
    { "round": 2, "combined": 0.0312, "pixel": 0.0411 },
    { "round": 3, "combined": 0.0112, "pixel": 0.0134 }
  ]
}
```

The generate handler reads `finalVersion` and emits `output/v<finalVersion>.html` as the
preview.

## Integration into the generate handler

```
// In the scoop's generate handler for source: figma, mode: match:

1. mkdir -p <workdir>/{input,output}
2. figma-fetch <figma-url> <workdir>/input/figma [scale=2]
   → download reference.png from images.json if not already there
3. Run the Figma extract prompt (figma-extract.md) → writes output/v1.html
4. convergence <workdir> --max-rounds=4 --target=0.015 --figma-url=<url>
   → iterates, writes output/v<N>.html for each correction
   → prints JSON with finalVersion
5. Read output/v<finalVersion>.html → emit action:"preview" with v:1, stage:"bespoke"
```

## Correction agent prompt template

The convergence loop feeds each correction agent with:
- The pixel mismatch percentage and target
- The worst regions (4×4 grid quadrants with highest mismatch)
- Spec issues (font sizes, colors, weights, radii that don't match Figma)
- Instructions to fix ONLY the mismatched areas (don't rewrite working sections)
- The full figma-extract.md rules still apply (self-contained, strict fidelity)

This is what makes the loop converge: each round narrows the gap by targeting the
specific visual areas that are furthest from the reference.
