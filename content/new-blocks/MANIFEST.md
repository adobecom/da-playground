# Cycle-2 R4 — new-block authoring queue

**Session:** `5dae1546-209`
**Milo branch:** `forge/session-5dae1546-209` (create with `cd /Users/victor/dev/da-playground/.forge-worktrees/session-5dae1546 && git checkout -b forge/session-5dae1546-209 forge-a-panel`)
**Tasks:** 2

| # | Block name | Target path |
|---|---|---|
| 1 | `forge-hero` | `/Users/victor/dev/da-playground/.forge-worktrees/session-5dae1546/libs/c2/blocks/forge-hero` |
| 2 | `forge-gallery` | `/Users/victor/dev/da-playground/.forge-worktrees/session-5dae1546/libs/c2/blocks/forge-gallery` |

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
