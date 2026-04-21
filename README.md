# mythos-skill

Explicit-state recurrent synthesis for AI agent orchestration. A deterministic packet compiler that takes raw subagent output and compiles a schema-validated, hash-provenanced next-pass packet that Prime can reason over without consuming raw subagent prose.

## Why

LLM agent pipelines drift when Prime (the orchestrating model) reads subagent chat directly. Claims slip in without provenance, contradictions get glossed over, and re-running the same objective produces different packets. Mythos enforces a hard boundary: subagents write fenced machine-readable records into a run directory, the compiler hashes and validates them, and Prime only ever sees the compiled packet.

## What you get

- **Deterministic compilation**: byte-identical packets from byte-identical inputs, verified by an integration test.
- **Hash-provenanced evidence**: every `file:` source reference is re-hashed at compile time; a tampered file produces a hash mismatch.
- **Agent attribution**: every evidence and verifier record carries `agent_id` and `lane`, stamped at ingest.
- **Auto-contradiction detection**: pairs of evidence from different agents on the same direct span with divergent summaries surface as `contradictions` in the packet.
- **Strict gate**: a separate script checks coverage, traceability, direct-source-ref ratios, and non-passing verifier findings before a run is "done".
- **Round-trip integrity**: regression tests in `tests/packet_shape_integrity.test.js` assert that every input field survives into the packet.

## Architecture

```
subagent markdown  (raw/subagents/<lane>.md)
  -> ingest-subagent.mjs       (fenced-block extraction, attribution stamping, path normalization)
  -> worker-results/*.jsonl    (machine-valid records)
  -> driver.mjs --run-dir      (invokes the Rust compiler)
  -> mythos-skill Rust crate   (hash verification, promotion, packet assembly)
  -> state/next_pass_packet.json
  -> Prime reads packet only
  -> driver.mjs --record-synthesis
  -> next pass id + recompiled packet
```

## Layout

- `mythos-compiler/` — Rust crate (`mythos-skill` on crates.io, binary `mythos`)
- `scripts/ingest-subagent.mjs` — subagent output ingest
- `scripts/strict-gate.mjs` — packet quality gate
- `scripts/readiness.mjs` — end-to-end fixture check
- `driver.mjs` — Node entrypoint that invokes the Rust compiler via `cargo run --bin mythos`
- `tests/packet_shape_integrity.test.js` — round-trip regression tests
- `SKILL.md` — the Claude Code skill contract

## Install

Mythos ships as two artefacts — a Rust compiler binary (`mythos`) and a Node runtime (`mythos-skill`). You need both for the full pipeline; the Rust binary is a hard requirement for `compile`.

### One-shot (recommended)

```bash
cargo install mythos-skill       # installs the `mythos` Rust compiler binary
npm install -g mythos-skill      # installs the `mythos-skill` Node CLI (ingest, gate, ready, orchestrator)
mythos-skill ready               # end-to-end self-test — must print "mythos readiness: passed"
```

### Rust binary only (just the compiler)

```bash
cargo install mythos-skill
mythos init my-run               # scaffold a minimal run dir
mythos compile --run-dir my-run  # compile it
```

No Node runtime; you manage `evidence.jsonl` / `findings.jsonl` by hand or from your own tooling.

### From source

```bash
git clone https://github.com/inchwormz/mythos-skill
cd mythos-skill
cargo install --path mythos-compiler   # builds & installs the mythos binary
npm install                             # installs the Node CLI locally (+ postinstall verifies mythos)
npm run ready                           # end-to-end fixture check
```

## Quick start

```bash
# 1. Scaffold a run directory (manifest.json, task.md, raw/, worker-results/, verifier-results/, seed evidence)
mythos-skill init my-run

# 2. Ingest subagent output
mythos-skill ingest --run-dir my-run --lane lane-a --agent-id agent-1 --from agent-a.md

# 3. Compile the run into state/next_pass_packet.json
mythos-skill compile --run-dir my-run

# 4. Record your synthesis and advance the pass id
mythos-skill compile --run-dir my-run --record-synthesis "one-paragraph summary with direct citations"

# 5. Verify the run passes the strict quality gate
mythos-skill gate --run-dir my-run
```

## Subagent output contract

Subagents write fenced blocks inside their `raw/subagents/<lane>.md` file:

````markdown
```mythos-evidence-jsonl
{"id":"ev-example","kind":"observation","summary":"...","source_ids":["file:path:10"],"source_refs":[...],"observed_at":"..."}
```

```mythos-verifier-jsonl
{"id":"vf-example","status":"passed","verifier_score":1,"source_ids":["command:test"],"source_refs":[...]}
```
````

Prose outside fenced blocks does not reach the packet. A `BLOCKED <reason>` sentinel on its own line produces a `kind:"blocker"` evidence record so blocked lanes leave a machine-readable trace.

## Development

```bash
cargo test --manifest-path mythos-compiler/Cargo.toml
node --test tests/packet_shape_integrity.test.js
node scripts/readiness.mjs
```

## License

MIT — see [LICENSE](./LICENSE).
