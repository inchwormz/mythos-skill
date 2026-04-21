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

```bash
cargo install mythos-skill
```

Then clone this repo for the JS runtime:

```bash
git clone https://github.com/inchwormz/mythos-skill
cd mythos-skill
npm run ready
```

## Quick start

```bash
# Compile a new objective
node driver.mjs "your objective here"

# Ingest a subagent's output
node scripts/ingest-subagent.mjs --run-dir <run> --lane <lane> --agent-id <id> --from <file.md>

# Recompile after ingest
node driver.mjs --run-dir <run>

# Record Prime's synthesis and advance pass id
node driver.mjs --run-dir <run> --record-synthesis "your summary"

# Verify the packet is fit to ship
node scripts/strict-gate.mjs --run-dir <run>
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
