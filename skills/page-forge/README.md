# page-forge (SLICC skill)

Browser-native re-host of the Page Forge pipeline: **Figma / page URL / raw HTML → 1:1
prototype published to Adobe DA**, with an optional Stardust (Consonant 2 + brand-knowledge)
redesign pass. Replaces the local `:3002` Node server. A `page-forge` **scoop** owns the
side-panel **sprinkle** (`page-forge.shtml`) and runs the pipeline, reusing the `snowflake`
skill (installed via `upskill`) for the deploy.

See `../../docs/sliccy-demo-plan.md` for the why and the phased plan.

## Layout

```
page-forge/
├── SKILL.md            # scoop/sprinkle architecture + pipeline + sprinkle⇄scoop protocol
├── page-forge.shtml    # side-panel sprinkle: preflight checklist + Figma/URL/HTML + Generate
├── scripts/
│   ├── figma-fetch.jsh    # Figma REST: structure + /images raster export (FIGMA_TOKEN)
│   ├── deploy.jsh         # commit + push forge-proto-* branch
│   └── sync-references.mjs # build-time (host node) vendoring of C2/design-knowledge/catalog
└── references/
    ├── figma-extract.md      # strict 1:1 Figma extract prompt
    ├── redesign.md           # optional Stardust redesign prompt
    ├── snowflake-deploy.md   # snowflake deploy (aem command + Milo flavor)
    ├── _vendored/            # generated; gitignored in forge, shipped in the package
    └── README.md
```

`.jsh` = SLICC-native shell scripts (global `fetch`/`fs`/`process`/`exec`, top-level await; run
without `node`). `sync-references.mjs` is a **host** build tool (run with `node` on a machine
that has the forge checkout), not a runtime script.

## Install / run

```
# 1. install this skill + the snowflake deploy skill (Milo flavor lives on the fork branch
#    until merged upstream into adobe/skills)
upskill adobecom/da-playground --path skills/page-forge
upskill vhargrave/skills --path plugins/aem/edge-delivery-services --all --branch feat/snowflake-milo-substrate

# 2. access — per designer:
#    - Settings → Providers → Sign in with Adobe   (covers DA + aem)
#    - be logged into figma.com in this browser
#    - GitHub: a fine-grained PAT scoped to the target repo (Contents: RW), stored via
#      `secret set GITHUB_PAT <token> --domain github.com,*.github.com`. The preflight
#      detects the target repo and walks you through creating it (~2 min). OAuth "Sign in
#      with GitHub" is org-blocked on adobecom, hence the PAT.
#    GitHub push needs Write on the target repo — granted via the milo-contributors team.
```

Then open the skill — the preflight checklist runs and gates Generate until access is green.
Regenerate `references/_vendored/` before publishing (see `references/README.md`).

## Status

Scaffold — prompts + sprinkle UI + `.jsh` helpers ported from `page-forge/server`, aligned to
SLICC's verified model (upskill, `aem` command, Adobe OAuth, scoop/sprinkle). **Not yet run
end-to-end on SLICC.** Phase 0 validates the one real unknown: whether the WASM shell can
`git push` with the fetch-proxy secret-injection model. `deploy.jsh` is written to report the
exact failure so we pick the right auth mechanism.
