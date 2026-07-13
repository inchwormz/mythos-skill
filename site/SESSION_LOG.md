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

Private Sites republish completed successfully.

## Terminal depth and Geist refinement

Date: 2026-07-13

Rebuilt both terminal surfaces to restore the information density of the removed compiler-emitted mockups. Each pane now has window chrome, toolbars, tabs, lane/context rails, timestamped conversation cards, summary metrics, artifact chips, line-numbered and syntax-colored packet output, a packet manifest, verification output, and a persistent status bar.

Typography now uses the local SiteSorted GeistSans asset for the core page font and every H1. The existing Inter Variable header font remains explicitly preserved, and terminal/code/sub-fonts continue to use the original Berkeley Mono variable.

Fresh local/browser verification:

- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures; depth markers, font rules, and local Geist asset are guarded.
- Browser desktop — PASS; terminal panes render at 818px height with both detailed surfaces present, old mockup markers absent, and computed fonts confirm GeistSans body/H1, Inter Variable header, and Berkeley Mono code.
- Browser mobile at `390x844` — PASS; document width remains 390px, internal terminal rails and packet output stay within the viewport, and console errors/warnings are 0.

Private Sites republish is currently blocked by the Sites deployment queue. The saved version 4 points to commit `e9c7093387201c9d2107b42c506a8a7365bc6eeb`, but both owner-only deployment attempts remain `pending` with no provider deployment ID. The current live URL still serves version 3: the hosted HTML has no rich-terminal markers and `/assets/files/geist.woff2` returns 404. Local source, Worker, and browser proofs remain valid; hosted verification is not complete.

Hosted receipt for the terminal workbench:

- Site version: `3` (`appgprj_6a54232a80208191a151c49baf473e7e~appgver_9a9c50141de881918a84f8fa40a86934`).
- Deployment: succeeded (`appgdep_6a542db344a48191b3cbf457b6ed3d8b`); owner-only private access preserved.
- Hosted URL: `https://receipts-for-agents.johnrichardmckeown.chatgpt.site`.
- Hosted endpoint check — PASS with owner authorization: `/` 200 HTML, `/styles.css` 200 CSS, representative AVIF and PNG assets 200, unknown route 404; hosted HTML contains the terminal workbench and model labels and excludes the old hero/diff markers.

Hosted receipt for terminal depth and Geist refinement:

- Saved Sites version: `4` (`appgprj_6a54232a80208191a151c49baf473e7e~appgver_0884935d93888191bd82e4b4e5a60f2e`), source commit `e9c7093387201c9d2107b42c506a8a7365bc6eeb`.
- Deployment attempts: `appgdep_6a54345bc6f8819198ec1f1cc2dd7df8` and `appgdep_6a54355213cc8191bc012b8c73e0c860`; both remain `pending` with `provider_deployment_id=null`.
- Hosted endpoint check — not passed for this refinement: current live URL returns version-3 HTML, the rich-terminal/Geist markers are absent, and `/assets/files/geist.woff2` returns 404.

Re-serve attempt:

- Local server receipt — PASS: `http://127.0.0.1:4175/` returns 200 and contains the rich terminal surface plus Claude, Codex, Grok, and Gemini labels.
- Third private deployment retry: `appgdep_6a54364613bc8191b1cf9dfeecdaa8d`; after a fresh queue wait it remains `pending`, with no provider deployment ID and no hosted content change.

## Terminal copy and visual direction correction

Date: 2026-07-13

Simplified the terminal copy and shifted the visual language toward the original compiler-emitted dark surface: short labels, compact file/state values, denser layout, and warm monochrome/amber accents. Removed terminal green/blue state classes, round status/window markers, and the source grid-dot orb visuals. The heading rule now applies Geist to every heading in `main` while the existing header remains Inter.

Fresh verification:

- TDD red receipt — the new smoke guard failed on the previous long terminal sentence before the implementation change.
- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 38 assets.
- Browser desktop — PASS; warm terminal palette, compact copy, no orb markers, and computed Geist H1/H2/H3 with Inter header.
- Browser mobile at `390x844` — PASS; document/body width remain 390px and console errors/warnings are 0.

Private republish remains blocked by the existing Sites deployment queue; the saved hosted version still does not contain this correction.

## SiteSorted heading font correction

Date: 2026-07-13

The heading font correction is now applied: the local SiteSorted `Fraunces` asset is used for all main-content headings, while the SiteSorted `GeistSans` asset remains the core/body font and the header keeps its original Inter Variable treatment.

Fresh verification:

- TDD red receipt — the smoke test failed on the missing Fraunces CSS rule and asset before implementation.
- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 39 assets.
- Browser desktop at `1280px` — PASS; computed `main h1` and `main h2` are `Fraunces`, the header remains `Inter Variable`, both Fraunces and GeistSans report loaded, and document/body width remain 1280px.

Hosted republish is still pending until the Sites deployment queue accepts the new source version.

## Terminal-only landing surface

Date: 2026-07-13

Changed the visible landing surface to two terminal panes only: the subagent receipt conversation on the left and the prime CLI output on the right. The duplicate review workbench, hero copy, model strip, feature sections, footer, and header actions are hidden so the terminal output carries the product story. The panes keep a small window bar and use the existing warm monochrome treatment.

Fresh verification:

- TDD red receipt — the new smoke guard failed before the terminal-only CSS selectors were added.
- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 39 assets.
- Browser desktop at `1280px` — PASS; 2 visible panes, 1 visible workbench, no visible main headings, footer/header actions hidden, body width 1280px, and 0 console errors.
- Browser mobile at `390px` — PASS; 2 visible panes, body width 390px, terminal surface width 358px, no visible main headings, and 0 console errors.

Hosted republish remains pending until this final terminal-only revision is pushed and accepted by the Sites deployment queue.

Deployment receipt for the terminal-only revision:

- Pushed source commit: `94175ff99c085d908a4895ae371e2335404a4e01`.
- Saved Sites version: `5` (`appgprj_6a54232a80208191a151c49baf473e7e~appgver_77524856d2c88191b8274ffca5dbecc9`).
- Private deployment: `appgdep_6a543e0949348191a50903f9226a5a92` remains `pending` with no provider deployment ID after two valid polls.
- Hosted endpoint check — not passed for version 5: the live URL still returns the older site and the Fraunces asset is not found. Local source and Worker are the verified current surface.

## Flat Linear-style terminal correction

Date: 2026-07-13

The serving layer was healthy; the mismatch was visual. The visible terminal panes still carried dashboard UI through bordered event cards, status treatments, and a framed output panel. The final correction flattens those interiors into two simple terminal streams. Styling depth now comes from the window frame, subtle surface texture, type hierarchy, thin rules, spacing, shadow, line numbers, and a restrained active line.

Fresh verification:

- TDD red receipt — the smoke test failed on the missing simple-surface token before the styling correction.
- `node site/smoke.test.mjs` — PASS, 3 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 39 assets.
- Browser desktop at `1280px` — PASS; 2 visible panes, 0 visible bordered cards, transparent card/output backgrounds, body width 1280px, and warm-only computed prompt/success colors.
- Browser mobile at `390px` — PASS; 2 visible panes, body width 390px, terminal surface width 358px, 0 visible headings, and 0 console errors/warnings.

Hosted verification is not complete for this correction.

## Launch imagery: terminal-only product scenes

Date: 2026-07-14

Rejected the previous 20-image batch after a side-by-side review against the real Linear capture. The four large images invented generic dashboard interfaces, while the smaller batch used unrelated gold line art and a literal paper receipt. None met the launch bar.

Replaced the four product-image slots with black terminal/Codex scenes derived from Linear's real dark code-surface asset. Every scene uses a supported Receipts command from the current CLI: `receipts run`, `receipts absorb`, `receipts conclude`, and `receipts next`. The 16 decorative avatar/icon images were removed from the site and archived outside the checkout; their visible placements now use small deterministic `>_` terminal marks.

The first browser pass caught the new images blending underneath the cloned Linear demo DOM. Root cause: `.SPbJba_grain` applied `opacity: .9` and `mix-blend-mode: overlay`, and the original sibling UI remained painted above the snapshot. The final CSS removes those siblings and renders each terminal image at its intrinsic aspect ratio.

Fresh verification after the last change:

- TDD red receipt: the new rejected-batch test failed on `receipts-01.png` before replacement; the compositor guard then failed before the CSS correction.
- `node site/smoke.test.mjs` — PASS, 4 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 43 assets.
- Rejected asset package check — PASS; no `receipts-05.png` through `receipts-20.png` in the Worker.
- Desktop browser — PASS; all four terminal images are visible at full aspect ratio with no cloned UI underneath.
- Mobile browser at `390x844` — PASS; 2 visible hero terminals, document width 375px inside the 390px viewport, no horizontal overflow.
- Browser console — PASS; 0 errors, 0 warnings.
- Local URL checked: `http://127.0.0.1:4175/`.

Exact next step: publish this verified source to the existing owner-only Sites project and confirm the production URL serves the new terminal assets.

## HTML/CSS product terminals

Date: 2026-07-14

Rebuilt all four generated product-image slots as real HTML/CSS terminals. Each scene now uses the hero terminal's exact DOM and visual grammar: black shell, three restrained controls, centered label, surface gradient, Berkeley Mono command stream, line reveal, blinking cursor, and bottom fade. Only the Receipts-specific command and output text changes between `receipts run`, `receipts absorb`, `receipts conclude`, and `receipts next`.

The raster files remain preserved in the checkout, but the page no longer references or requests them. The original cloned demo DOM in each slot is hidden whenever its replacement terminal is present.

Fresh verification after the last production change:

- TDD red receipt — the new DOM-terminal test failed with 0 of 4 feature terminals and found all four PNG references before implementation.
- `node site/smoke.test.mjs` — PASS, 4 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 43 assets.
- Static proof — 4 feature terminal articles, 6 CLI terminal articles total including the 2 hero terminals, and 0 references to `receipts-01.png` through `receipts-04.png`.
- Desktop browser at `1440x1200` — PASS; all four replacement terminals render with the hero shell and no cloned interface painted underneath.
- Mobile browser at `390x844` — PASS; document width equals viewport width, the responsive shell shows the first feature terminal at 358x384, and there is no horizontal overflow.
- Browser console — PASS; 0 errors, 0 warnings.
- Local URL checked: `http://127.0.0.1:4175/`.

Exact next step: publish this verified source to the existing owner-only Sites project and confirm the production HTML contains four feature terminals and no product PNG references.

## Receipts-owned brand and proof sweep

Date: 2026-07-14

Replaced the remaining borrowed visual identity with a Receipts-owned system. The header and footer now use a Fraunces `RECEIPTS` wordmark. The six benefit figures are inline SVGs for tamper-evident trust, deterministic execution, and verified handoff. Image generation was used as visual direction only; the shipped figures are deterministic HTML/SVG. The two proof cards use John's selected monochrome flow-field images, with content-hash cache keys so the deployed cards cannot retain superseded artwork.

Converted the calendar demo into a 34-hour harness timeline, renamed project-management states and tasks around receipt capture, verification, and handoff, and replaced customer identities, navigation labels, legal labels, and generic demo copy. A final browser investigation found the old customer-logo SVG nodes layered above the new card art; those nodes are suppressed, the clone-only pulse/version strip is removed, and the remaining visible blue/green diagram palette is remapped to the warm Receipts accent.

Fresh verification after the last production change:

- TDD red receipts — the residue guard first failed on missing wordmarks; card-art checks failed on `cover`/tiling; shell-copy checks failed on borrowed navigation; customer-card checks failed on visible legacy logo nodes; and palette checks failed on the cyan evidence bars.
- `node site/smoke.test.mjs` — PASS, 5 tests, 0 failures.
- `node site/build-worker.mjs` — PASS, generated Worker with 45 assets.
- Static proof — 2 Fraunces wordmarks, 6 owned proof SVGs, 8 elapsed-hour labels, 2 card-art references, 4 HTML/CSS feature terminals, and 0 OpenAI/Ramp/Linear names or links.
- Desktop browser at `1440x1200` — PASS; owned SVGs, harness timeline, neutral state diagram, clean proof cards, and complete horizontal card grid render correctly.
- Mobile browser at `390x844` — PASS; document width equals viewport width with no horizontal overflow.
- Browser console — PASS; 0 errors, 0 warnings.
- Local URL checked: `http://127.0.0.1:4175/`.

Final card-art override:

- Trust card asset SHA-256: `52772a430dc72ca175a74e2568ed7e31b43d4bb3ddafbb88ea278ede2c458f2b`.
- Handoff card asset SHA-256: `ab64328800bc7ca8f11af00261db881f0429308ddcdf11c32d856c48bec17918`.
- Browser card captures — PASS; both cards show the requested white flow fields on black, the copy remains legible, and the legacy customer marks remain absent.

Exact next step: commit and publish this verified artifact to the existing owner-only Sites project, then confirm the hosted HTML, CSS, wordmarks, proof figures, hour labels, and card images.
