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
mythos-skill compile --run-dir <dir>                     # recompile
mythos-skill compile --run-dir <dir> --record-synthesis "…"  # record Prime's synthesis
mythos-skill ingest --run-dir <dir> --lane <lane> --agent-id <id> --from <raw.md>
mythos-skill gate --run-dir <dir>                        # strict quality gate
mythos-skill ready                                       # end-to-end self-test
```

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

## Subagent Output Contract

Subagents write fenced blocks inside their `raw/subagents/<lane>.md` file:

````markdown
```mythos-evidence-jsonl
{"id":"ev-example","kind":"observation","summary":"...","source_ids":["file:path:10"],"source_refs":[{"source_id":"file:path:10","path":"path","kind":"file","hash":"placeholder","span":"10","observed_at":"2026-04-21T00:00:00Z"}],"observed_at":"2026-04-21T00:00:00Z"}
```

```mythos-verifier-jsonl
{"id":"vf-example","summary":"...","status":"passed","verifier_score":1,"source_ids":["command:test"],"source_refs":[...]}
```
````

Preferred direct source ids:

- `file:<repo-relative-path>:<line>` for file and line evidence
- `command:<stable-command-name>` for command output evidence
- `test:<test-name-or-suite>` for test-specific proof
- `log:<stable-log-name>` for log proof

Prose outside fenced blocks does not reach the packet. `BLOCKED <reason>` on its own line produces a `kind:"blocker"` evidence record.

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
- summary-only code-change/root-cause/test-change claims: add direct `source_refs`, then recompile
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
