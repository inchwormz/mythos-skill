# Receipts product site handoff

Date: 2026-07-13

## Outcome

Repurposed the verified Linear capture as a Receipts landing page for Prime agents and agent orchestrations. The visual shell came from the blueprint compiler, so the page keeps the dense workbench feel while the visible story now explains runs, execution evidence, `next_pass_packet.json`, gates, and the next-agent handoff in plain English.

The original SiteSorted checkout and compiler source were read-only inputs. The compiler WIP in this repository was preserved.

## Blueprint receipt

- Source bundle: `C:\Users\johnr\.codex\runs\perfectclone\web-capture\runs\current-050678da-full176-final-layout-proof-20260713-0531-c01\linear\wide-1728x1000\bundle.json`
- Pinned binary: `C:\Users\johnr\sitesorted\src\lib\builder\screenshot-to-code\web-compiler-rust\target\release\web-compiler-cli.exe`
- Binary SHA-256: `646F00687566325F1BAA08C73DD1F0837D71CABB81668AA430B8139797D2D12F`
- `emit-clean`: PASS; `copiedAssets=34`; `failures=[]`
- `emit-blueprint-shell`: PASS; `schemaVersion=web-clean-emit/v1`; `shellChars=569209`
- Compiler materialized assets are served from `site/assets/files/`.

## Files changed for this site

- `site/index.html` — blueprint-emitted shell, repurposed Receipts copy, local action status surface, Receipts-specific header/footer icons, and a four-label Claude/Codex/Grok/Gemini model strip below the hero.
- `site/styles.css` — blueprint-emitted styles plus the local status, model-strip, and responsive overrides.
- `site/assets/**` — compiler-materialized assets required by the shell.
- `site/build-worker.mjs` — recursively packages HTML, CSS, assets, and favicon into the Sites Worker.
- `site/smoke.test.mjs` — product, compiler-marker, stale-copy, local-asset, interaction, and responsive contract tests.
- `dist/server/index.js` — generated Worker asset map.
- `.openai/hosting.json` — existing Sites project configuration; unchanged.

## Fresh verification

- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 66 assets.
- Generated Worker fetch check — PASS: `/` 200 HTML, `/styles.css` 200 CSS, `/assets/files/asset-0001.avif` 200 AVIF, `/images/favicon.svg` 200 SVG, unknown route 404.
- `git diff --check` — PASS; only normal Windows LF-to-CRLF warnings.
- Local URL: `http://127.0.0.1:4175/`.
- Desktop browser proof — PASS; Receipts header icon, workbench hero, feature sections, CTA, and footer render with zero console errors or warnings.
- Mobile browser proof at `390x844` — PASS; responsive navigation collapses, Receipts content remains reachable, and console errors/warnings are 0.
- Mythos compiler suite — PASS; 43 unit tests, 1 determinism test, and 1 init contract test, 0 failures.

## Hosted receipt

- Sites version: `2`
- Deployment: succeeded; owner-only private access preserved.
- Hosted URL: `https://receipts-for-agents.johnrichardmckeown.chatgpt.site`
- Hosted endpoint check — PASS with owner authorization: `/` 200 HTML, `/styles.css` 200 CSS, `/assets/files/asset-0024.avif` 200 AVIF.

Unrelated working-tree edits remain untouched and unstaged.

## Terminal workbench update

Date: 2026-07-13

Replaced the hero application mockup and the illustration under “Review receipts and agent output” with the same Receipts-specific two-terminal workbench. The left terminal is a subagent/verifier conversation with a summary; the right terminal is a Prime CLI handoff showing `next_pass_packet.json`, run and receipt identifiers, exit status, content hash, source references, artifacts, gate, and next action.

Local verification after the replacement:

- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 37 assets.
- Worker fetch check — PASS: `/` 200 HTML, `/styles.css` 200 CSS, representative AVIF and PNG assets 200, favicon 200, unknown route 404.
- Browser desktop check — PASS: 2 workbenches, 2 subagent panes, 2 Prime panes, old hero/diff nodes absent, zero console errors or warnings.
- Browser mobile check at `390x844` — PASS: terminal grid stacks to one column, document width remains 390px, zero console errors or warnings.
- `cargo test --manifest-path mythos-compiler/Cargo.toml` — PASS; 43 unit tests, 1 determinism test, and 1 init contract test, 0 failures.

Private Sites republish is the remaining step for this update.
