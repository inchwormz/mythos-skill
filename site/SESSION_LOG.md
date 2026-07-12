# Receipts product site handoff

Date: 2026-07-13

## Outcome

Built the Receipts landing page by duplicating the verified SiteSorted website export at:

`C:\Users\johnr\Projects\sitesorted\website\index.html`

The page keeps the cloned SiteSorted shell: compact header, centered composer, three-column proof grid, feature wall, packet list, log cards, CTA, and four-column footer. The visible content now targets agents and Prime orchestrators in plain English.

The page explains that Receipts runs work at the execution boundary, preserves exit codes and hashes, compiles `next_pass_packet.json`, and lets a gate refute claims contradicted by evidence. It identifies the current install command honestly as `cargo install mythos-skill`.

## Files changed for this site

- `site/index.html` — copied from the actual SiteSorted export, then repurposed for Receipts.
- `site/images/favicon.svg` — copied from the matching export asset.
- `site/smoke.test.mjs` — red/green contract for the cloned shell, product copy, local interaction, anchors, and responsive CSS.
- `site/build-worker.mjs` — packages the exact HTML export as a Sites-compatible Worker entrypoint.
- `.openai/hosting.json` — points Sites at the Receipts project.
- `docs/superpowers/plans/2026-07-13-receipts-product-site.md` — implementation plan updated with the exact clone source.
- `docs/superpowers/plans/2026-07-13-receipts-product-site.html` — browser-hosted plan updated with the exact clone source.

The existing compiler/runtime changes in the repository were not modified by this site task.

## Verification

- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `cargo test --manifest-path mythos-compiler/Cargo.toml` — PASS, 42 unit tests, 1 determinism integration test, 1 init contract integration test, 0 failures.
- `git diff --check` — PASS.
- `node site/build-worker.mjs` — PASS, generated `dist/server/index.js`.
- Worker fetch check — PASS, root HTML returned 200, favicon returned 200, unknown route returned 404.
- Local browser URL: `http://127.0.0.1:4175/`.
- Desktop browser proof: cloned header, composer, proof cards, feature wall, packet list, CTA, and footer rendered; proof chip filled the prompt; Prime mode revealed context fields; proof action rendered the local packet response.
- Mobile browser proof at 390x844: `scrollWidth=390`, `bodyScrollWidth=390`, center navigation hidden at the responsive breakpoint, and console errors/warnings were 0.

## Not done

Hosted deployment is being completed through Sites. The old SiteSorted checkout and its working tree were read-only source material.
