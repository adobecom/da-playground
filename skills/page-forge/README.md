# page-forge (SLICC skill)

Browser-native re-host of the Page Forge pipeline: **Figma / page URL / raw HTML → either a 1:1
prototype (Match) or an Adobe Consonant 2 redesign (Reimagine) → published to Adobe DA**. Replaces
the local `:3002` Node server. A `page-forge` **scoop** owns the side-panel **sprinkle**
(`page-forge.shtml`) and runs the pipeline, reusing the `snowflake` skill for the deploy and the
two-phase **stardust** engine (on `impeccable`) for Reimagine — both installed via `upskill`.

See `../../docs/sliccy-demo-plan.md` for the why and the phased plan.

## Layout

```
page-forge/
├── SKILL.md            # scoop/sprinkle architecture + pipeline + sprinkle⇄scoop protocol
├── page-forge.shtml    # side-panel sprinkle: preflight checklist + Figma/URL/HTML + Generate
├── scripts/
│   ├── figma-fetch.jsh       # Figma REST: structure + /images raster export (FIGMA_TOKEN)
│   ├── inject-c2-brand.jsh   # Reimagine: copy vendored C2 brand over stardust/current/ (fail-loud)
│   ├── collect-prototype.jsh # Reimagine: rewrite local image refs → live URLs + inline lenis
│   ├── deploy.jsh            # commit + push forge-proto-* branch
│   └── sync-references.mjs # build-time (host node) vendoring of C2 brief/brand/knowledge/catalog
└── references/
    ├── figma-extract.md      # strict 1:1 Figma extract prompt (Match · Figma)
    ├── redesign.md           # two-phase Stardust Reimagine (extract → inject C2 → direct/uplift)
    ├── snowflake-deploy.md   # snowflake deploy (aem command + Milo flavor)
    ├── _vendored/            # generated; shipped in the package. Incl. acom-c2-brand-extraction/
    └── README.md             #   (_brand-extraction.json + DESIGN.json — the C2 brand injected by Reimagine)
```

`.jsh` = SLICC-native shell scripts (global `fetch`/`fs`/`process`/`exec`, top-level await; run
without `node`). `sync-references.mjs` is a **host** build tool (run with `node` on a machine
that has the forge checkout), not a runtime script.

## Install / run

```
# 1. install this skill + the snowflake deploy skill (Milo flavor lives on the fork branch
#    until merged upstream into adobe/skills) + the Stardust Reimagine engine (+ impeccable)
upskill adobecom/da-playground --path skills/page-forge
upskill vhargrave/skills --path plugins/aem/edge-delivery-services --all --branch feat/snowflake-milo-substrate-v2
upskill adobe/skills --path plugins/stardust --all          # Reimagine engine
upskill pbakaus/impeccable                                  # stardust's hard dependency

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

1:1 with the DA Page Forge tool (forge `stage`): **Match / Reimagine** model, the two-phase
**Stardust** Reimagine engine (`extract → inject canonical C2 brand → direct|uplift`), multi-variant
chips, and the activity log are all ported here. The Milo deploy is **block-level editable `forge-*`
blocks + adjustable `--pa-*` scroll animations** by default (snowflake PR #166 — `decorate()` rebuilds
each section's DOM for 1:1, live gnav/footer from chrome metadata), with the frozen page-level overlay
as a documented fallback. Reimagine's prototype-image resolution matches DA's 4-tier recovery
(`collect-prototype.jsh`).

Caveats for the demo:
- **Match** (URL/HTML/Figma → 1:1 → snowflake deploy) is the fast, verified spine — lead with it.
- **Block-level Milo deploy** is the headline (editable + animated), but it has **not yet been run
  live end-to-end inside SLICC** — it's proven via the DA `:3002` tool, and the methodology +
  branch pin are now wired here. Smoke-test one deploy before the demo; fall back to the overlay
  (`conversionLevel: page-level`) if a section won't converge to 1:1.
- **Reimagine** is slow (~10–30 min/phase) and **not yet validated end-to-end inside SLICC** (it is
  proven in DA). Pre-bake it for the demo. Unlike DA — where the C2 injection is a Node copy *outside*
  the agent — here the scoop runs `scripts/inject-c2-brand.jsh` itself, so it's a *mandated* (not
  structurally guaranteed) step; the script fails loud if the injection doesn't land.
- Phase 0 still validates whether the WASM shell can `git push` via the fetch-proxy `GITHUB_PAT`.
