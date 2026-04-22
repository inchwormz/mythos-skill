# mythos-skill

Explicit-state recurrent synthesis for AI agent orchestration. A deterministic packet compiler that takes raw subagent output and compiles a schema-validated, hash-provenanced next-pass packet that Prime can reason over without consuming raw subagent prose.

[![crates.io](https://img.shields.io/crates/v/mythos-skill)](https://crates.io/crates/mythos-skill) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Why

LLM agent pipelines drift when Prime (the orchestrating model) reads subagent chat directly. Claims slip in without provenance, contradictions get glossed over, and re-running the same objective produces different packets. Mythos enforces a hard boundary: subagents write fenced machine-readable records into a run directory, the compiler hashes and validates them, and Prime only ever sees the compiled packet.

## Mental model

Mythos splits into two kinds of artefact — a **runtime** you install once and **skill packages** you install per Prime surface.

```
                             ┌─────────────────────────────────┐
                             │           Runtime               │
                             │  (install once, used by all)    │
                             │                                 │
                             │  mythos          (Rust binary)  │
                             │  mythos-skill    (Node CLI)     │
                             └───────────────┬─────────────────┘
                                             │ PATH
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        │                                    │                                    │
        ▼                                    ▼                                    ▼
┌───────────────────┐              ┌───────────────────┐              ┌───────────────────┐
│  Claude Code      │              │  Codex            │              │  Custom / other   │
│  skill            │              │  skill            │              │  Prime surface    │
│                   │              │                   │              │                   │
│  ~/.claude/       │              │  ~/.codex/        │              │  direct CLI use   │
│  skills/mythos/   │              │  skills/mythos/   │              │                   │
│  SKILL.md         │              │  SKILL.md         │              │                   │
└─────────┬─────────┘              └─────────┬─────────┘              └─────────┬─────────┘
          │                                  │                                  │
          ▼                                  ▼                                  ▼
          Prime calls `mythos-skill` / `mythos` per the skill contract.
```

The runtime is the same for everyone. The skill package is a contract file the host AI surface reads to know *how* to call the runtime: which subagent lanes to spawn, when to ingest, when to compile, when to gate.

## How a run flows

```
 subagent isolated session
   └─> writes raw/subagents/<lane>.md
       (fenced mythos-evidence-jsonl + mythos-verifier-jsonl records)
         └─> mythos-skill ingest           (quarantine parser: validate + hash + attribute)
              └─> worker-results/*.jsonl / verifier-results/*.jsonl
                   └─> mythos-skill compile  (Rust: promote, hash-verify, detect contradictions)
                        └─> state/next_pass_packet.json
                             └─> Prime reads packet only (never raw subagent chat)
                                  └─> mythos-skill compile --record-synthesis "..."
                                       └─> advanced pass_id + recompiled packet
                                            └─> mythos-skill gate  (must exit 0 before halt)
```

Prime never consumes subagent prose directly. The ingest+compile path is the only promotion route into Prime's context.

## What you get

- **Deterministic compilation** — byte-identical packets from byte-identical inputs, verified by an integration test.
- **Hash-provenanced evidence** — every `file:` source reference is re-hashed at compile time; a tampered file produces a hash mismatch.
- **Agent attribution** — every evidence and verifier record carries `agent_id` and `lane`, stamped at ingest.
- **Auto-contradiction detection** — pairs of evidence from different agents on the same direct span with divergent summaries surface as `contradictions` in the packet, with severity graduated by evidence kind.
- **Strict gate** — a separate script checks coverage, traceability, direct-source-ref ratios, machine-specific path leakage, and non-passing verifier findings before a run is "done".
- **Concurrent-ingest safe** — O_EXCL advisory lock serializes parallel ingest appends, so 5 parallel micro-lanes never corrupt `evidence.jsonl`.
- **Round-trip integrity** — regression tests in `tests/packet_shape_integrity.test.js` assert that every input field survives into the packet.

## Install

### Runtime (once per machine)

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/inchwormz/mythos-skill/main/install.sh | sh
```

Windows PowerShell:

```powershell
iwr https://raw.githubusercontent.com/inchwormz/mythos-skill/main/install.ps1 | iex
```

Or manually:

```bash
cargo install mythos-skill                       # Rust compiler binary (mythos)
npm install -g github:inchwormz/mythos-skill     # Node CLI (mythos-skill)
mythos-skill ready                               # end-to-end self-test — must print "mythos readiness: passed"
```

### Skill package (once per Prime surface)

Install only the surface(s) you use. Each skill is a one-file contract that tells its Prime how to call the runtime.

**Claude Code** — installs to `~/.claude/skills/mythos/SKILL.md`:

```bash
curl -fsSL https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/claude/install.sh | sh
```

```powershell
iwr https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/claude/install.ps1 | iex
```

**Codex** — installs to `~/.codex/skills/mythos/SKILL.md`:

```bash
curl -fsSL https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/codex/install.sh | sh
```

```powershell
iwr https://raw.githubusercontent.com/inchwormz/mythos-skill/main/skills/codex/install.ps1 | iex
```

### From source (contributors)

```bash
git clone https://github.com/inchwormz/mythos-skill
cd mythos-skill
cargo install --path mythos-compiler   # builds and installs the mythos binary
npm install                             # installs the Node CLI locally
npm run ready                           # end-to-end fixture check
```

## Quick start

```bash
# 1. Scaffold a run directory
mythos-skill init my-run

# 2. Ingest subagent output (after a lane writes raw/subagents/lane-a.md)
mythos-skill ingest --run-dir my-run --lane lane-a --agent-id agent-1 --from my-run/raw/subagents/lane-a.md

# 3. Compile the run into state/next_pass_packet.json
mythos-skill compile --run-dir my-run

# 4. Record your synthesis and advance the pass id
mythos-skill compile --run-dir my-run --record-synthesis "one-paragraph summary with direct citations"

# 5. Verify the run passes the strict quality gate
mythos-skill gate --run-dir my-run
```

## Subagent output contract

Subagents write fenced blocks inside their assigned `raw/subagents/<lane>.md` file:

````markdown
```mythos-evidence-jsonl
{"id":"ev-example","kind":"observation","summary":"...","source_ids":["file:path:10"],"source_refs":[{"source_id":"file:path:10","path":"path","kind":"file","hash":"placeholder","span":"10","observed_at":"2026-04-21T00:00:00Z"}],"observed_at":"2026-04-21T00:00:00Z"}
```

```mythos-verifier-jsonl
{"id":"vf-example","status":"passed","verifier_score":1,"source_ids":["command:test"],"source_refs":[...]}
```
````

Prose outside fenced blocks does not reach the packet. A `BLOCKED <reason>` sentinel on its own line produces a `kind:"blocker"` evidence record so blocked lanes leave a machine-readable trace.

Preferred direct source id prefixes:

- `file:<repo-relative-path>:<line>` — file and line evidence
- `command:<stable-command-name>` — command output evidence
- `test:<test-name-or-suite>` — test-specific proof
- `log:<stable-log-name>` — log proof

## Layout

- `mythos-compiler/` — Rust crate (`mythos-skill` on crates.io, binary `mythos`)
- `bin/mythos-skill.mjs` — Node CLI dispatcher
- `scripts/ingest-subagent.mjs` — subagent output ingest
- `scripts/strict-gate.mjs` — packet quality gate
- `scripts/readiness.mjs` — end-to-end self-test
- `driver.mjs` — Node entrypoint that invokes the Rust compiler
- `skills/claude/` — Claude Code skill package + installers
- `skills/codex/` — Codex skill package + installers
- `tests/packet_shape_integrity.test.js` — round-trip regression tests

## Development

```bash
cargo test --manifest-path mythos-compiler/Cargo.toml
node --test tests/packet_shape_integrity.test.js
node scripts/readiness.mjs
```

## License

MIT — see [LICENSE](./LICENSE).
