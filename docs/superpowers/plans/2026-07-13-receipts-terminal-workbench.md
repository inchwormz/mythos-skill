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
- [ ] Commit the site change, save a new private Sites version, deploy it, and verify the hosted HTML/CSS/asset routes.
