# Receipts Linear Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

## Goal

Repurpose a verified Linear capture into a Receipts product site for Prime agents and people building agent orchestrations. The page should explain execution evidence, next-pass packets, gates, and handoffs in plain English while preserving the Linear-like workbench visual language.

## Architecture

Use the SiteSorted blueprint compiler as the source-of-truth shell pipeline:

- Input bundle: `C:\Users\johnr\.codex\runs\perfectclone\web-capture\runs\current-050678da-full176-final-layout-proof-20260713-0531-c01\linear\wide-1728x1000\bundle.json`
- Pinned compiler: `C:\Users\johnr\sitesorted\src\lib\builder\screenshot-to-code\web-compiler-rust\target\release\web-compiler-cli.exe`
- `emit-clean` materializes the shell and assets; `scripts/emit-blueprint-shell.ts` emits the blueprint-marked HTML/CSS shell.
- The site uses static HTML/CSS/inline JavaScript, a Node Worker bundle generator, the Node test runner, and private Sites hosting.

## Task 1: Emit and repurpose the blueprint shell

- [x] Run `web-compiler-cli.exe emit-clean <bundle> <out-dir>` and verify `status PASS`, `copiedAssets=34`, and no failures.
- [x] Run `npx tsx scripts/emit-blueprint-shell.ts --slug=receipts-linear ...` and verify `schemaVersion=web-clean-emit/v1`.
- [x] Copy the emitted shell, styles, and materialized assets into `site/`.
- [x] Replace visible clone copy with Receipts language: execution evidence, runs, packets, gates, Prime handoffs, and `next_pass_packet.json`.
- [x] Replace cloned header/footer marks with a Receipts receipt/check icon.
- [x] Replace the post-hero customer-logo strip with text labels: Claude, Codex, Grok, and Gemini.
- [x] Keep product actions local and deterministic: clicking the run action updates the status surface with the captured receipt state.

## Task 2: Serve assets and guard the contract

- [x] Update `site/build-worker.mjs` to recursively embed HTML, CSS, assets, and favicon with correct content types and 404 behavior.
- [x] Update `site/smoke.test.mjs` to require Receipts copy, blueprint markers, local anchors, model labels, local assets, responsive CSS, and the local action hook.
- [x] Add stale-copy guards for Linear branding, borrowed demo wording, and the old customer logo marquee.

## Task 3: Verify and publish

- [x] Verify `http://127.0.0.1:4175/` in a real browser at desktop and 390px mobile widths.
- [x] Verify no console errors or warnings, no horizontal overflow at mobile width, and the model labels render with spacing.
- [x] Run the site smoke test, Worker route check, generated bundle build, and `git diff --check` after the final source change.
- [x] Run the existing Mythos compiler test suite without modifying its unrelated working-tree changes.
- [x] Commit only the product-site files and push the exact site-bearing commit to the existing Sites source repository.
- [x] Package, save Sites version 2, deploy it privately, poll to success, and record the hosted URL in `site/SESSION_LOG.md`.
