# Cycle-2 R4 — new-block authoring queue

**Session:** `7d1abf2e-c3c`
**Milo branch:** `forge/session-7d1abf2e-c3c` (create with `cd /Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w && git checkout -b forge/session-7d1abf2e-c3c forge-a-panel`)
**Tasks:** 6

| # | Block name | Target path |
|---|---|---|
| 1 | `forge-usecase` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w/libs/c2/blocks/forge-usecase` |
| 2 | `forge-usecase-3` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w/libs/c2/blocks/forge-usecase-3` |
| 3 | `forge-usecase-4` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w/libs/c2/blocks/forge-usecase-4` |
| 4 | `forge-carousel` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w/libs/c2/blocks/forge-carousel` |
| 5 | `forge-trust` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w/libs/c2/blocks/forge-trust` |
| 6 | `forge-concierge` | `/Users/cod87753/Code/da-playground/.forge-worktrees/session-7d1abf2e-mqjtty3w/libs/c2/blocks/forge-concierge` |

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
