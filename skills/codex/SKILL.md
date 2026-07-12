---
name: mythos
description: Codex-native Mythos packet compiler for explicit-state recurrent synthesis.
keywords:
  - mythos
  - recurrent depth
  - next-pass packet
  - explicit-state
---
# Mythos — Codex skill

Use this skill when the user invokes `/mythos` or asks to run the local Mythos explicit-state recurrence loop from OpenAI Codex.

## Runtime Boundary

Codex is Prime. The local runtime (Rust `mythos` binary + Node `mythos-skill` CLI) is the body. Prime reads compiled packets only — never raw subagent chat.

This is a Codex skill, not a Claude batch runner. Do not spawn Claude sessions from within this skill.

## Entrypoints

```bash
mythos-skill init <dir>                                  # scaffold a run directory
mythos-skill run --run-dir <dir> --label test:<name> -- <command...>
                                                         # execute + mint a tamper-evident receipt
mythos-skill compile --run-dir <dir>                     # recompile
mythos-skill compile --run-dir <dir> --record-synthesis "…"  # record Prime's synthesis
mythos-skill ingest --run-dir <dir> --lane <lane> --agent-id <id> --from <raw.md>
mythos-skill diff --run-dir <dir> [--note <text>]        # WORK receipt: what changed on disk
mythos-skill resolve --run-dir <dir> --target <id> --reason "…"  # clear a blocking worklist item
mythos-skill next --run-dir <dir> [--json]               # the compressed Prime brief - READ THIS, not the raw packet
mythos-skill gate --run-dir <dir>                        # strict quality gate
mythos-skill ready                                       # end-to-end self-test
```

**Receipts rule (M1/M2): never trust a command/test claim - mint the receipt
yourself.** Prime runs every check it relies on through `mythos-skill run`
with a `--label` matching the claim's cited id. Receipts compile into
`attested` facts with zero lane cooperation; failing receipts mechanically
refute "passed" claims citing their label and turn the gate red.

Readiness means `mythos-skill ready` passes.

## Invocation Protocol

### Bare invocation

If the user invokes `/mythos` with no substantive objective, run:

```bash
mythos-skill ready
```

### New objective

1. `mythos-skill init <slug>` — scaffold
2. Read `state/next_pass_packet.json`. Treat it as explicit state.
3. Launch packet-grounded Codex subagent lanes (below).
4. Instruct each subagent to write its output to `<run-dir>/raw/subagents/<lane>.md`.
5. `mythos-skill ingest ... --from <file>` per lane.
6. `mythos-skill compile --run-dir <run-dir>` — recompile.
7. Prime synthesizes from ONLY the recompiled packet.
8. `mythos-skill compile --run-dir <run-dir> --record-synthesis "<source-backed summary>"` — advance pass id.
9. `mythos-skill gate --run-dir <run-dir>` — must exit 0 before halting.

### Existing run directory

If the user provides a run directory, skip init. Read the latest packet, continue synthesis.

## Subagent Lanes

The local binary cannot spawn Codex subagents; the Codex skill runner must. Launch after packet compilation:

- 5 micro-lanes (parallel, isolated) for tiny focused jobs — one file inspection, one evidence record, one assumption check, one verifier proposal, one blocker probe.
- 0–5 broader lanes for architecture review, multi-file root-cause, verification-strategy review.

Model / reasoning-effort policy is environment-specific and not part of the Mythos contract — configure it in `mythos-agent-policy.json` if desired. Mythos cares only that subagents run in isolation and write machine-readable records.

## Prime Consumption Rule

Codex Prime must not directly consume subagent chat. Required flow:

```text
subagent isolated session
  -> final reply: "DONE <path>" or "BLOCKED <reason>"
  -> writes <run-dir>/raw/subagents/<lane>.md with fenced
     mythos-evidence-jsonl / mythos-verifier-jsonl records
  -> mythos-skill ingest         (extracts + validates + stamps agent_id/lane)
  -> worker-results/*.jsonl, verifier-results/*.jsonl
  -> mythos-skill compile        (Rust: hash + promotion + contradictions)
  -> state/next_pass_packet.json
  -> Codex Prime reads packet only
  -> mythos-skill compile --record-synthesis "…"
  -> advanced pass id + recompiled packet
```

Subagent replies are completion signals, not context. Prime consumes only the recompiled packet.

## Subagent Output Contract (zero-burden - lanes owe you NOTHING)

Lane briefs are TASK-ONLY: no format instructions, no schemas. Ingest
structures whatever comes back: fenced `mythos-evidence-jsonl` /
`mythos-verifier-jsonl` blocks if present (liberally repaired; hand-written
`source_refs` discarded and resynthesized with real hashes); otherwise
claims are HARVESTED from natural prose (sentences citing concrete paths or
`file.ext:line` become asserted-tier records with hash-verified citations);
otherwise one demoted `unstructured` record. `BLOCKED <reason>` anywhere
becomes a blocker record. Optional courtesy line for richer packets: "cite
file paths with line numbers for anything you'd want checked." NEVER
re-prompt a lane over format. Trust comes from ingest-computed hashes,
caller-stamped attribution, receipts Prime mints, and the gate - never from
lane compliance.

## Strict Gate

```bash
mythos-skill gate --run-dir <run-dir>
```

If it fails, do the missing loop step and re-run. A worktree patch or passing test suite is not enough — the run is complete only when subagent evidence, verifier findings, recorded synthesis, and the final recompiled packet all pass this gate.

## Hard Rules

- Packet state is explicit state, not latent memory.
- Substantive runs use subagents after packet compilation.
- Prime consumes recompiled packets, not raw subagent chat.
- Substantive evidence must cite real `file:<path>:<line>` sources (ingest synthesizes the hashed `source_refs`).
- Subagent chat is a completion signal, not context.
- Do not claim readiness unless `mythos-skill ready` passes.
