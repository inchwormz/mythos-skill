# Receipts Engine Plan - one engine: capture + compile

(Product renamed **Receipts** by John, 2026-07-12; engine lineage: Mythos.)

Date: 2026-07-12. Reviewed at commit `a616aaf` by Claude (Fable 5). Status: **RATIFIED 2026-07-12** (John: "Execute as written"). Live progress: `RECEIPTS-LEDGER.md`. M0 implemented and verified same day; M0.5 (forgiving ingest, field post-mortem) 2026-07-12; M1 (`mythos run` receipts) + M2 core (attestation ladder, mechanical refutation) 2026-07-13.

## The one-paragraph version

Mythos today is the top half of a trust engine: it quarantines subagent output, compiles it into a deterministic packet, and gates the result. The review below confirms the spine is right and the determinism is real, but the trust semantics have three load-bearing holes: "trusted facts" are not gated by anything, command/test provenance is decorative (the hash proves only that the claim has a name), and the whole pipeline only truly works when pointed at its own repository. The plan grafts the missing bottom half - runtime-minted execution receipts that agents cannot author - into the same binary, wires the promotion rules that already exist but are never called, and consolidates three languages of duplicated truth logic into one Rust engine with a CLI agents can use and humans can allowlist in one line. MCP comes later as a veneer; the CLI is the spine (John's call, 2026-07-12: dealer's choice, CLI chosen).

Vocabulary used below: **asserted** evidence = the agent wrote it about itself. **Attested** evidence = the runtime observed it happen and wrote the record. Today mythos has only asserted evidence dressed in hashes. The engine adds attested.

---

# Part 1 - Review of mythos-skill (built by GPT 5.5, April 2026)

Scope: every source file read end to end (Rust compiler, Node ingest/gate/driver/readiness, skills, schemas, tests, CI). Test suites re-run on this machine 2026-07-12; results in Part 4. Findings ordered by severity. "Plain English" lines are for John; file pointers are for the implementing session.

## What is genuinely good (keep, do not rewrite)

- **K1 - The doctrine.** Prime never reads subagent prose; the only route into context is ingest -> compile -> packet. This is the product and it is correct. (`README.md`, both `skills/*/SKILL.md`)
- **K2 - Deterministic compile, actually tested.** Byte-identical packet/snapshot/decision-log across two compiles of identical inputs. (`mythos-compiler/tests/compile_determinism.rs`)
- **K3 - The packet schema.** Evidence / trusted_facts / hypotheses / contradictions / recurring_failure_patterns / candidate_actions / verifier_findings / halt_signals is a well-shaped ontology, and `EvidenceRecord` already carries receipt-shaped fields nothing fills yet (`diff_ref`, `span_before`, `span_after` - `src/schema.rs:60-65`). The bottom half was anticipated in the data model.
- **K4 - The strict gate has real teeth and real negative tests.** Staleness fingerprint, raw-artifact tamper detection (proven by the readiness tamper probe), span-inside-file checks, machine-path leak rejection, laundering traceability (R5), direct-ref requirements for concrete claims (R6), agent coverage floor (R7). This gate has failed honestly before - readiness deliberately drives it red five different ways. (`scripts/strict-gate.mjs`, `scripts/readiness.mjs:350-472`)
- **K5 - Ingest quarantine mechanics.** Fence-anchored parsing, BLOCKED sentinel, duplicate-session guard, advisory lock proven against concurrent ingest, file hashes computed from disk at ingest (agents cannot declare a file hash into existence). (`scripts/ingest-subagent.mjs`)
- **K6 - Contradiction detection.** Conservative, deterministic, severity-graded, with a non-contradicting-kind-pairs table. (`src/compiler/contradictions.rs`)
- **K7 - Harness-neutral packaging.** Dual skill surfaces (Claude Code + Codex), 3-OS CI, one-liner installers. The strategic requirement was met on day one.

## Findings - broken or decorative

**F1 (P0) - `trusted_facts` are not trusted; the promotion engine is never called.**
Every evidence record - whatever its kind, contradicted or not - is promoted to a `CompiledFact` with agent-supplied confidence or a default 0.7 (`src/compiler/run_dir.rs:424-441`). The promotion rules that require repeated utility + verifier support + zero conflicts exist (`src/compiler/promotion.rs:14-17`) but have **no callers** outside their own tests. Same for the trust module (`src/compiler/trust.rs`). This violates the project's own founding hard rule: "Never auto-promote a directive without repeated utility or verifier support" (`munin-fork-plan.md:307`). Plain English: the section labeled "trusted facts" is the least trustworthy part of the packet - it is every agent claim, relabeled, with a self-graded confidence score.

**F2 (P0) - Command/test/log provenance is fake.**
For `command:`/`test:`/`log:` sources, ingest fills the required hash with `fnv1a(source_id string)` - a digest of the claim's own name (`scripts/ingest-subagent.mjs:542-548`, comment "H1"). The gate then dutifully verifies that this hash is a well-formed hash (`scripts/strict-gate.mjs:188-206`). Plain English: a subagent that says "test:build passed" gets a certificate that attests nothing except that it said so. This is the exact seam the receipts half fills, and until it does, these refs must be labeled unattested rather than hash-decorated.

**F3 (P1) - The pipeline only works against its own repository.**
Three separate resolvers anchor relative paths to the wrong root: ingest resolves against the mythos package dir (`scripts/ingest-subagent.mjs:304-307`), the gate falls back to the mythos package dir (`scripts/strict-gate.mjs:175-186`), and the Rust compiler falls back to `CARGO_MANIFEST_DIR` **baked at build time** (`src/compiler/run_dir.rs:400-422`) - for a `cargo install` binary that is the crates.io registry cache on the build machine. Plain English: point mythos at SiteSorted today and every file citation outside the run dir either fails or verifies against the wrong repo. Mythos has only ever been dogfooded on itself. Fix: explicit `repo_root` in `manifest.json`, resolved at runtime, no fallbacks.

**F4 (P1) - Attribution is forgeable, which breaks the diversity math.**
Records may override the caller's `--agent-id`/`--lane` ("subagents can override", `scripts/ingest-subagent.mjs:289-302`). One lane can therefore impersonate three agents to beat the R7 coverage floor (3 distinct agent_ids), and can dodge or manufacture contradictions, since contradiction detection only fires across *different* attribution (`src/compiler/contradictions.rs:105-115`). Fix: caller stamp always wins; record-declared attribution becomes `claimed_agent_id` at most.

**F5 (P1) - Cross-language drift has already shipped a broken flow.**
`mythos init` (Rust) seeds `vf-synthesis-pending` (`src/bin/mythos.rs:174-177`); the driver only knows how to consume `vf-codex-synthesis-pending` (`driver.mjs:224`). A run scaffolded by the shipped CLI's own init can never pass the gate - the pending finding is never flipped, and the gate requires all findings passing. Readiness never catches this because it always scaffolds through the JS path. Plain English: the two halves of the product, written in two languages, already disagree about the product; this is the empirical case for one engine in one language. (Also: fnv1a is implemented four times - three JS copies + one Rust - `ingest-subagent.mjs:77`, `driver.mjs:93`, `strict-gate.mjs:164`, `run_dir.rs:546`.)

**F6 (P2) - Gate escape hatches are string-matched, so they are gameable.**
A verifier finding dodges the direct-provenance requirement if its id or summary *contains the word* "subagent" or "synthesis" or "smoke-not-run" (`scripts/strict-gate.mjs:421-432`), and the "did subagents actually run" check is satisfiable by naming alone (`strict-gate.mjs:646-655`). A non-empty `closure_reason` waives direct provenance entirely (H6). Named trap: gate-by-vocabulary. Fix: typed exemptions keyed on record `kind` (which ingest controls), never on free text; `closure_reason` must cite the bounding decision's source.

**F7 (P2) - Ingest silently repairs lies.**
Out-of-range line spans are auto-clipped to the file's line count with only a stderr note (`scripts/ingest-subagent.mjs:507-529`). An agent citing line 99999 of a 10-line file ends up with a "verified" citation to line 10. Repairing evidence at ingest is laundering-lite. Fix: clip -> demote the record (asserted-only, never fact-eligible) or reject.

**F8 (P2) - Synthesis is self-certified.**
`--record-synthesis` flips the pending finding to `passed` with `verifier_score: 0.9` on the driver's own authority (`driver.mjs:222-243`). No check that the synthesis cites packet sources. Minor today; matters once synthesis quality gates anything.

**F9 (P3) - fnv1a-64 is a tripwire, not evidence.**
Fine against accidental drift; trivially forgeable on purpose, and 64 bits is collision-findable. Acceptable for the current threat model (sloppiness/confabulation); receipts should start on BLAKE3-256 and the schema should learn `hash_alg` plurality (1.2.0) rather than a flag-day.

**F10 (P3) - Run dirs default into the package install directory.**
`driver.mjs` creates runs under `<package>/.codex/mythos/runs` (`driver.mjs:255`) - for a global npm install that is inside global node_modules. The state-file self-citation guard is regex-coupled to that layout (`ingest-subagent.mjs:491`). Fix: runs live under the target project (`.mythos/runs/`), path passed explicitly.

**F11 (P3) - Windows spawn quoting.**
`spawnSync(..., { shell: true })` on win32 with interpolated paths (`driver.mjs:317-329`, `readiness.mjs:14`) breaks on paths with spaces (and is injection-adjacent). Goes away when the Node layer collapses into the Rust binary.

**F12 (P3) - Stale-packet fallback trusts mtimes.**
When the input fingerprint file is absent the gate falls back to an mtime+5ms heuristic (`strict-gate.mjs:105-112`). Make the fingerprint mandatory instead.

## Review verdict

The doctrine, the schema, the gate discipline, and the determinism are worth keeping and are ahead of anything comparable I know of in the agent-infra field (that comparison is inferred, knowledge to Jan 2026). The trust semantics are the weak layer: F1 + F2 together mean today's packet cannot distinguish "verified fact" from "confident story with citations". That is not a reason to discard mythos - it is precisely the hole the receipts half was designed for. GPT 5.5 built a good refinery and never built the wellhead.

---

# Part 2 - The one engine

## Shape

One Rust binary, `mythos`. The Node CLI survives only as an npm installer shim. Every subcommand is one allowlist-friendly prefix (`mythos ...`) - easy for agents to use and easy for humans to authorise in harness permission settings, which is why CLI beats MCP as the spine. An MCP server (`mythos serve-mcp`) can wrap the same journal later for harnesses without shell access; it adds no new semantics.

```
mythos init <dir> --repo-root <path>          scaffold run dir (repo_root recorded in manifest)
mythos run --run-dir <d> --lane <l> --agent <a> -- <command...>
                                              NEW - execute + mint an attested receipt
mythos ingest --run-dir <d> --lane <l> --agent <a> --from <file>
                                              ported from JS, caller-stamped attribution
mythos compile --run-dir <d> [--record-synthesis "..."]
mythos gate --run-dir <d>                     ported from JS, typed exemptions only
mythos report --run-dir <d>                   NEW - one HTML page, green/red/grey claims (John's window)
mythos ready                                  end-to-end self-test incl. red-team fixtures
```

## The receipt (the new primitive)

Minted only by `mythos run`, appended to `receipts/receipts.jsonl` in the run dir, hash-chained (`prev_receipt_hash`), BLAKE3-256, with output tails stored content-addressed under `receipts/artifacts/`:

```json
{"id":"rcpt-<n>","cmd":["cargo","test"],"cwd":"<repo-rel>","exit_code":0,
 "duration_ms":41230,"stdout_hash":"...","stderr_hash":"...","stdout_tail":"...",
 "tree_before":"<git rev + dirty-diff hash>","tree_after":"<same>",
 "started_at":"...","ended_at":"...","lane":"impl","agent_id":"grok-1",
 "writer":"mythos/0.2.0","prev_receipt_hash":"...","record_hash":"..."}
```

Trust boundary: agents never write this file. Ingest **rejects** any agent-authored record that claims kind `receipt` or cites a `receipt:<id>` absent from the journal. The wrapper writes what it observed; the agent may only point at it.

## The attestation ladder (replaces F1's flat promotion)

Compile sorts every claim into exactly one tier:

1. **Attested fact** - direct sources include at least one verified receipt (exit code and tree state consistent with the claim), no open contradiction. Goes to `trusted_facts` with `attestation: "attested"`.
2. **Verifier-backed fact** - promotion.rs rules, finally wired: verifier support + zero conflicts (+ repeated utility for standing directives). `attestation: "verifier"`.
3. **Asserted evidence** - agent claims with real file citations. Stays in `evidence`. Never enters `trusted_facts`.
4. **Hypothesis** - everything else, including span-clipped citations (F7 demotion).

Gate rule replacing F2: concrete-kind claims (`code-change`, `test-change`, and any `command:`/`test:` source) **require an attested receipt**. An unreceipted "tests passed" fails the gate. Fail-closed: no receipt = it did not happen.

## What each existing module becomes

| Today | In the engine |
|---|---|
| `scripts/ingest-subagent.mjs` | `mythos ingest` (Rust port; F4/F7 fixed in the port) |
| `scripts/strict-gate.mjs` | `mythos gate` (Rust port; F6/F12 fixed; + receipt verification) |
| `driver.mjs` | folded into `mythos compile` / `mythos report` |
| `promotion.rs`, `trust.rs` | wired into compile (attestation ladder) |
| fnv1a x4 | one hash module; BLAKE3 for receipts, fnv1a accepted read-only for legacy refs |
| `readiness.mjs` | `mythos ready` incl. red-team fixtures (lying lane, forged coverage, span lie) |

---

# Part 3 - Milestones

Campaign ledger: `MYTHOS-ENGINE-LEDGER.md` (created when execution starts). **The number: % of concrete claims in a real dogfooded fanout that are receipt-attested and gate-verified (target 100%), plus the standing red-team check: a planted lying lane must turn the gate red.** A gate that has never failed is not trusted; every milestone below ships with its red fixture.

- **M0 - Truth in labeling.** Fix F1 (wire promotion/attestation tiers minus receipts), F3 (repo_root), F4 (caller-wins attribution), F6 (typed exemptions), F7 (demote clipped spans), F12. Done when: new negative tests (forged coverage, span lie, unreceipted concrete claim marked asserted) are red before / green after, existing suites stay green.
- **M1 - `mythos run` capture.** The receipt primitive, journal, artifacts, git tree state. Done when: tampering with a receipt artifact or journal link turns the gate red; determinism test extended over receipts.
- **M2 - Attestation-aware compile + gate.** The ladder above; F2 dies here. Done when: the split-screen demo works on a fixture - a lane narrating success without receipts fails the gate, the same lane run through `mythos run` passes.
- **M3 - One binary.** Port ingest + gate to Rust, F5's drift class becomes impossible, Node reduced to installer shim. Done when: `mythos ready` green on Windows + CI matrix with no `.mjs` on the execution path.
- **M4 - Dogfood on a real external fanout.** First real grok/codex delegation inside normal blueprint work runs through the engine. Done when: the campaign number is measured on a real task and at least one week of discrepancy counts exists. This doubles as the Receipts product's founding metric.
- **M5 - Hardening.** Schema 1.2.0 (hash_alg plurality), receipt signing (wrapper-held key), `mythos report` polish, crates.io/npm release, optional `serve-mcp` veneer.

Sequencing note: this plan does not override the standing SiteSorted hard gate (all effort on blueprint-fill). M0-M3 are engine work awaiting John's go; M4 lands inside blueprint work whenever the next external fanout happens anyway.

---

# Part 4 - Verification receipts for this review (2026-07-12, this machine)

- Node round-trip suite `tests/packet_shape_integrity.test.js`: **19/19 pass** (verified, fresh).
- Rust suite + readiness: first attempt at `cargo test` died in an OOM compiling `serde_derive` AND my pipeline initially misreported it as green because `tail` swallowed the exit code - a live false-green specimen, recorded here deliberately. Re-run results recorded below.
- Rust suite re-run with in-log exit capture: **30/30 pass** (`29 unit + 1 determinism`), `CARGO_EXIT=0` (verified, fresh).
- Full readiness self-test `node scripts/readiness.mjs`: **passed**, `READY_EXIT=0` (verified, fresh). Node also emitted DEP0190 (shell:true arg concatenation) during the run - live corroboration of F11.

Claims labeling for Part 1: all file:line findings are **verified by reading the code**; F5's end-to-end breakage is **verified by code path analysis, not yet by executing the Rust-init flow** (M0 adds the failing test that proves it); market/comparison statements are **inferred** (knowledge cutoff Jan 2026).
