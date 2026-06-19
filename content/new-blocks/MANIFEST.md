# Cycle-2 R4 — new-block authoring queue

**Session:** `f5c1aa4f-545`
**Milo branch:** `forge/session-f5c1aa4f-545` (create with `cd /Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f && git checkout -b forge/session-f5c1aa4f-545 forge-a-panel`)
**Tasks:** 6

| # | Block name | Target path |
|---|---|---|
| 1 | `forge-section` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f/libs/c2/blocks/forge-section` |
| 2 | `forge-section-3` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f/libs/c2/blocks/forge-section-3` |
| 3 | `forge-section-4` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f/libs/c2/blocks/forge-section-4` |
| 4 | `forge-section-5` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f/libs/c2/blocks/forge-section-5` |
| 5 | `forge-section-6` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f/libs/c2/blocks/forge-section-6` |
| 6 | `forge-section-11` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-f5c1aa4f/libs/c2/blocks/forge-section-11` |

## Next steps

For each task, invoke the `build-block-from-figma` skill with the inputs in
that task directory's `build-prompt.md`. The skill's Phases 0–8 cover
authoring, visual validation (Playwright), accessibility (axe), and
performance (Lighthouse). After each PR opens, the block becomes available
at `?milolibs=local` against this local milo checkout.

### Authoring contract (block-building.md, enforced by build-block-from-figma)

- `export default async function init(el)` — no other shape.
- Probe outward from required content (typically a heading); never use
  nth-child selectors.
- Move nodes via `appendChild` / `append` / `replaceWith` — never
  `innerHTML =` on elements with listeners.
- `createTag` from `libs/utils/utils.js`; `decorateBlockText` /
  `decorateBlockBg` from `libs/utils/decorate.js`. Don't redefine these.
- Three-phase render: raw → `data-block-status="decorated"` → `"loaded"`.
  LCP structure synchronous; enhancement async.
- `try/catch` + `lana.log` around fetches; LCP must not depend on API
  success.
- Per-module budgets: JS < 300 LOC, CSS < 200 LOC.
