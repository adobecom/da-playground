# references/

Prompt templates + vendored ground-truth for the `page-forge` SLICC skill.

| File | Source of truth | Notes |
|---|---|---|
| `figma-extract.md` | `page-forge/server/server.js` `buildFigmaExtractPrompt` | Strict 1:1 rules are load-bearing. Only the "Read the design" step is a pluggable seam. |
| `redesign.md` | `buildRedesignPrompt` | Optional Stardust pass. Injects the two `_vendored/` files. |
| `snowflake-deploy.md` | `buildSnowflakeDeployPrompt` + `runDeployPrototype` | Deploy via the reused `.claude` snowflake skill. |
| `_vendored/c2-brief.md` | `server/figma/c2Refs.js` `buildC2PromptSection()` | **Generated** — see below. |
| `_vendored/design-knowledge.md` | `server/designKnowledge.js` `buildDesignKnowledgeSection()` | **Generated** — only if the forge checkout has committed Stardust extractions. |
| `_vendored/block-catalog.md` | `server/figma/blockIndex.js` `buildCompactIndex()` | **Generated** — compact Milo block inventory (for optional ship-labeling). |

## Vendoring (`_vendored/`)

These three files are **generated** so the skill is self-contained and doesn't depend on the
(private) `forge` repo at runtime. They are gitignored in the forge source; the packaging
step regenerates them into the shipped skill (the adobecom skills repo / `.skill` archive).

Regenerate on a machine that has the forge checkout:

```bash
FORGE_PAGE_FORGE=/path/to/forge/page-forge \
MILO_PATH=/path/to/milo \
node scripts/sync-references.mjs
```

## Drift

Vendoring forks these from upstream `forge`. Re-run `sync-references.mjs` whenever the C2
brief, design-knowledge, block catalog, or the prompt builders change upstream. For the
long-lived skills repo, wire this into a CI/release step (or git-submodule the sources).
