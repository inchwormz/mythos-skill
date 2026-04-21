---
name: mythos
description: Codex-native Mythos packet compiler for explicit-state recurrent synthesis.
---
# Mythos

Mythos is a Codex-native explicit-state recurrence skill.

Codex is the main brain. The local runtime is the body: it creates run
directories, compiles raw artifacts into source-backed packets, and gives Codex
a stable packet to synthesize from.

Readiness means `npm run ready` passes in this directory.

## Important

Do not call `claude -p` from this skill. This is a Codex skill, not a Claude
batch runner.

If a future backend needs to spawn a Claude session, use a separate launch
backend modeled on Munin proactivity's `cmd.exe /k` session-spawn path. Keep
that separate from the Codex default.

## Architecture

```text
objective or run-dir
  -> driver.mjs
  -> mythos-compiler
  -> state/snapshot.json
  -> state/next_pass_packet.json
  -> state/decision_log.jsonl
  -> Codex reads packet and performs synthesis
```

No latent state. No hidden memory. Every pass is reconstructable from files.

## Run

Create a new run from an objective:

```powershell
node driver.mjs "your objective here"
```

Compile an existing run directory:

```powershell
node driver.mjs --run-dir .\mythos-compiler\tests\fixtures\run-basic
```

- stdout: `next_pass_packet.json` content
- stderr: generated paths and compiler status

## Next Pass Protocol

After Codex consumes the packet:

1. Launch packet-grounded subagent lanes:
   - 5 microagents immediately, unless there are fewer than 5 meaningful
     microtasks
   - default those microagents to `gpt-5.4` with low reasoning because it is the
     trusted baseline
   - use `gpt-5.3-codex-spark` only after a current run has recorded a passing
     capability profile for its practical context/prompt limits
   - up to 5 `gpt-5.4` low/medium agents immediately for broader bounded lanes
   - reserve high-effort GPT-5.4 only for architecture/root-cause/final-review
     jobs that genuinely need it
2. Do not let Codex Prime consume subagent chat directly.
3. Instruct each subagent to write its final output directly under
   `raw/subagents/` as fenced `mythos-evidence-jsonl` or
   `mythos-verifier-jsonl` records, and to return only a completion signal.
4. Run `node driver.mjs --run-dir <run-dir>` again.
5. Codex Prime consumes only the compiler-validated recompiled
   `next_pass_packet.json`.
6. Record Codex Prime's synthesis back into explicit state:

```powershell
node driver.mjs --run-dir <run-dir> --record-synthesis "<source-backed summary>"
```

This writes `raw/codex-synthesis-*.md`, appends `codex-synthesis` evidence,
marks the pending synthesis verifier as passed, advances the pass id, and
prints the recompiled packet.

7. Continue until verifier findings are passing or halt signals justify stopping.

The local binary cannot spawn Codex subagents. The Codex skill runner must do
that orchestration after packet compilation.

## Strict Gate

Before any final answer, halt, handoff, or next-pass conclusion for a
substantive run, run:

```powershell
node C:\Users\OEM\Projects\mythos-emulator\scripts\strict-gate.mjs --run-dir <run-dir>
```

If it fails, do the missing loop step and run it again. A worktree patch or
passing test suite is not enough; the run is only complete when subagent
evidence, verifier findings, recorded synthesis, and the final recompiled
packet all pass this gate.

Subagent final messages are completion signals, not Prime context. Ingest the
machine-readable file the subagent wrote under `raw/subagents/`:

```powershell
node C:\Users\OEM\Projects\mythos-emulator\scripts\ingest-subagent.mjs --run-dir <run-dir> --lane <lane> --agent-id <agent-id> --from <raw-output-file>
```

The ingester accepts only fenced `mythos-evidence-jsonl` and
`mythos-verifier-jsonl` blocks. Prose-only subagent output is not evidence.

Substantive records must carry direct provenance:

- root-cause, code-change, test-change, and high-score verifier records require
  `source_refs`
- each declared `source_refs[].source_id` must also appear in `source_ids`
- broad `raw:local-evidence.md` references are allowed as supporting context but
  are not enough for substantive claims

## Spark Policy

Spark limits are not assumed. If its context window, prompt ceiling, or
truncation behavior is unknown for the current run, use `gpt-5.4` low for
micro-lanes.

Spark may substitute for a micro-lane only when:

- the task is tiny, isolated, and non-critical-path
- the prompt is intentionally small
- the run records a capability profile as evidence
- the output is still written to the run directory and recompiled before Prime
  consumes it
