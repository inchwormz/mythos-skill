# Receipts Terminal Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the borrowed product UI/code mockups with a realistic two-terminal Receipts workbench showing a subagent summary and a Prime CLI handoff.

**Architecture:** Keep the blueprint-emitted Linear shell and existing section anchors. Replace the hero application mockup and the illustration under “Review receipts and agent output” with semantic HTML terminal panels styled in `site/styles.css`; keep all data static and representative of Mythos/Receipts output.

**Tech Stack:** Static HTML, CSS, inline JavaScript, Node smoke tests, Sites Worker bundle.

---

### Task 1: Replace the visual mockups with terminal panels

**Files:**
- Modify: `site/index.html`
- Modify: `site/styles.css`

- [x] Replace the hero application mockup with a two-panel `receipts-terminal-workbench` containing a `Subagent / verifier` conversation on the left and a `Prime agent / CLI` receipt on the right.
- [x] Replace the illustration inside `Review receipts and agent output` with the same product-specific terminal composition so that section demonstrates the review workflow directly.
- [x] Include representative fields: `run_id`, `receipt_id`, `exit_code`, `content_hash`, `source_refs`, `artifacts`, `gate`, `next_action`, and `next_pass_packet.json`.
- [x] Add responsive CSS that stacks the terminals below 800px and preserves readable monospace text without horizontal page overflow.

### Task 2: Guard the product surface

**Files:**
- Modify: `site/smoke.test.mjs`

- [x] Require the terminal headings, representative receipt fields, and the two terminal pane markers.
- [x] Reject the old hero screenshot wrapper and old editable diff marker so the borrowed mockups cannot silently return.

### Task 3: Verify and publish

**Files:**
- Modify: `site/build-worker.mjs` only if the generated bundle needs regeneration.
- Modify: `site/SESSION_LOG.md`

- [x] Run the smoke test, rebuild the Worker, run the Worker route check, and inspect the real browser at desktop and 390px mobile widths.
- [x] Run the Mythos compiler tests without touching unrelated working-tree edits.
- [x] Commit the site change, save a new private Sites version, deploy it, and verify the hosted HTML/CSS/asset routes.

### Task 4: Restore the removed surface depth and typography

**Files:**
- Modify: `site/index.html`
- Modify: `site/styles.css`
- Modify: `site/smoke.test.mjs`
- Add: `site/assets/files/geist.woff2`

- [x] Rebuild each terminal with layered chrome, tabs, conversation/activity rows, evidence metadata, line-numbered output, and status bars at the density of the removed compiler-emitted surfaces.
- [x] Use the embedded SiteSorted GeistSans font for core UI and all H1 elements, while preserving the existing header and Berkeley Mono/sub-font treatment.
- [x] Re-run static, browser, Worker, and compiler checks before republishing.
- [ ] Complete hosted verification after the private Sites deployment leaves `pending` and serves version 4.

### Task 5: Simplify copy and remove AI-color/orb treatment

**Files:** `site/index.html`, `site/styles.css`, `site/smoke.test.mjs`

- [x] Replace explanatory terminal paragraphs with compact labels and state values.
- [x] Use warm monochrome/amber terminal accents with no green or blue AI palette.
- [x] Remove terminal orb markers and hide the harvested grid-dot orb visuals.
- [x] Apply Geist to all main-content headings while preserving the header font.
- [x] Re-run static, Worker, and desktop/mobile browser checks.
- [ ] Republish and verify the hosted correction after the Sites queue clears.
