---
name: mythos
description: Claude Code native Mythos packet compiler for explicit-state recurrent synthesis.
keywords:
  - mythos
  - recurrent depth
  - next-pass packet
  - explicit-state
---
# Mythos — Claude Code skill

Use this skill when the user invokes `/mythos` or asks to run the local Mythos explicit-state recurrence loop from Claude Code.

## Runtime Boundary

Claude is Prime. The local runtime (Rust `mythos` binary + Node `mythos-skill` CLI) is the body. Prime reads compiled packets only — never raw subagent chat.

Do not call `claude -p`. Do not spawn nested Claude CLI sessions. Use Claude Code's native Task tool with the installed Mythos agents (`mythos-evidence-worker`, `mythos-critic-worker`, `mythos-verifier-worker`) for subagent lanes.

## Entrypoints

```bash
mythos-skill init <dir>                                  # scaffold a run directory
mythos-skill run --run-dir <dir> --label test:<name> -- <command...>
                                                         # execute + mint a tamper-evident receipt
mythos-skill compile --run-dir <dir>                     # recompile
mythos-skill compile --run-dir <dir> --record-synthesis "…"  # record Prime's synthesis
mythos-skill ingest --run-dir <dir> --lane <lane> --agent-id <id> --from <raw.md>
mythos-skill gate --run-dir <dir>                        # strict quality gate
mythos-skill ready                                       # end-to-end self-test
```

**Receipts rule (M1/M2): never trust a command/test claim - mint the receipt
yourself.** Prime runs every check it relies on through `mythos-skill run`
with a `--label` matching the claim's cited id (e.g. `test:cargo-suite`).
Receipts compile into `attested` facts with zero lane cooperation; a passing
receipt upgrades lane claims citing that label; a FAILING receipt mechanically
refutes any "passed" claim citing it and turns the gate red. Lanes cannot
mint, fake, or edit receipts (hash-chained journal, verified at compile).

Readiness means `mythos-skill ready` passes.

## Invocation Protocol

### Bare invocation

If the user invokes `/mythos` with no substantive objective, run:

```bash
mythos-skill ready
```

Report whether readiness passed.

### New objective

If the user gives an objective:

1. `mythos-skill init <slug-of-objective>` — scaffold the run dir
2. Read the emitted `state/next_pass_packet.json`. Treat it as explicit state.
3. Launch the mandatory Claude subagent lanes (below).
4. Instruct each subagent to write its output to `<run-dir>/raw/subagents/<lane>.md`.
5. Ingest each file with `mythos-skill ingest --run-dir <run-dir> --lane <lane> --agent-id <id> --from <file>`.
6. `mythos-skill compile --run-dir <run-dir>` — recompile.
7. Synthesize the next answer as Claude Prime, consuming ONLY the recompiled packet.
8. `mythos-skill compile --run-dir <run-dir> --record-synthesis "<source-backed summary>"` — advance pass id.
9. `mythos-skill gate --run-dir <run-dir>` — must exit 0 before halting.

### Existing run directory

If the user provides a run directory, skip init. Read the latest packet, continue synthesis.

## Mandatory Subagent Lanes

For every substantive objective, Mythos must use Claude Code subagents. The local runtime cannot spawn them; Claude Code must. After compiling the first packet, immediately launch the maximum useful parallel fanout:

- 5 microagents for tiny isolated jobs, unless there are fewer than 5 meaningful microtasks.
- `mythos-evidence-worker` — source mapping, artifact inspection, compact evidence extraction
- `mythos-verifier-worker` — proof commands, gate checks, verifier records
- `mythos-critic-worker` — contradiction hunting, missing provenance, strict-gate risk
- Broader default Claude Task agents only when the packet justifies it: architecture review, multi-file root-cause, regression risk.

Prime's first job is **scheduling**, not solving.

### Agent budgeting

Use tiny lanes for: inspect one file, summarize one log, extract one evidence record, check one assumption, propose one verifier command.

Use broader lanes for: architecture review, multi-file root-cause analysis, verification-strategy review, final critic synthesis.

Do not spend broad agents on small extraction tasks.

## Prime Consumption Rule

Claude Prime must not directly consume subagent conclusions as authoritative context.

Required flow:

```text
subagent isolated session (Task tool)
  -> final chat says only "DONE <path>" or "BLOCKED <reason>"
  -> writes file at <run-dir>/raw/subagents/<lane>.md with fenced
     mythos-evidence-jsonl / mythos-verifier-jsonl records
  -> mythos-skill ingest        (extracts + validates + stamps agent_id/lane)
  -> worker-results/*.jsonl, verifier-results/*.jsonl
  -> mythos-skill compile       (Rust: hash + promotion + contradiction detection)
  -> state/next_pass_packet.json
  -> Claude Prime reads packet only
  -> mythos-skill compile --record-synthesis "…"
  -> advanced pass id + recompiled packet
```

Subagent responses are **completion signals**, not context. Prime consumes only the recompiled packet.

## Subagent Output Contract (forgiving - do not over-specify to lanes)

Tell subagents only this: end your report with a fenced block, one JSON object
per claim, two fields required:

````markdown
```mythos-evidence-jsonl
{"summary":"<one factual claim>","source_ids":["file:<repo-relative-path>:<line>"]}
```

```mythos-verifier-jsonl
{"summary":"<verdict>","status":"passed","verifier_score":1.0,"source_ids":["file:<path>:<line>"]}
```
````

Ingest repairs everything else and reports what it repaired: missing
ids/kinds/timestamps defaulted, field synonyms aliased, sloppy JSON (single
quotes, trailing commas, arrays, pretty-print) repaired, bare/mislabeled
fences classified by content, bare `path:line` citations prefixed. Subagents
must NOT write `source_refs` - hand-written refs are discarded and
resynthesized with real hashes from `source_ids`. Never escalate format
demands at a lane; if ingest reports repairs, that is the system working.

The unrepairable rules (the actual contract): citations must resolve to real
files and lines (else downgraded to non-provenance and never fact-eligible);
a passed finding with score >= 0.9 needs a content-backed citation or the
gate goes red; prose-only output survives only as one demoted `unstructured`
record; `BLOCKED <reason>` on its own line reports a stuck lane.

## Strict Gate

Before any final answer, halt, handoff, or next-pass conclusion, run:

```bash
mythos-skill gate --run-dir <run-dir>
```

Typical failures and required repairs:

- still `pass-0001`: record synthesis and recompile
- only objective evidence: launch/record subagent evidence, then recompile
- stale packet: `mythos-skill compile --run-dir <run-dir>`
- no `codex-synthesis` evidence: `mythos-skill compile --run-dir <run-dir> --record-synthesis "…"`
- summary-only code-change/root-cause/test-change claims: the record needs a real `file:<path>:<line>` citation in `source_ids` (ingest builds the hashed `source_refs` itself), then re-ingest/recompile
- pending verifier findings: satisfy them OR record a source-backed `passed` finding with `closure_reason` explaining the intentional bound
- packet not `ready-to-halt`: continue the recurrence

A run is not done merely because code changed or tests passed. It is done only when the compiler has promoted the evidence into a clean packet and the strict gate passes.

## Hard Rules

- Packet state is explicit state, not latent memory.
- Substantive runs use subagents after packet compilation.
- Prime consumes recompiled packets, not raw subagent chat.
- Every important packet item preserves source references.
- Do not answer from raw intuition if the packet says raw drilldown is needed.
- Do not claim readiness unless `mythos-skill ready` passes.
