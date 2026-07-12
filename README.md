# mythos-skill

> **This engine is becoming [Receipts](./MYTHOS-ENGINE-PLAN.md)** — proof-of-work for AI agent claims. Product renamed 2026-07-12; the binary/crate/package renames land with milestone M3 of the plan. Campaign state: [RECEIPTS-LEDGER.md](./RECEIPTS-LEDGER.md).

Explicit-state recurrent synthesis for AI agent orchestration. A deterministic packet compiler that takes raw subagent output and compiles a schema-validated, hash-provenanced next-pass packet that Prime can reason over without consuming raw subagent prose.

[![crates.io](https://img.shields.io/crates/v/mythos-skill)](https://crates.io/crates/mythos-skill) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## Why

LLM agent pipelines drift when Prime (the orchestrating model) reads subagent chat directly. Claims slip in without provenance, contradictions get glossed over, and re-running the same objective produces different packets. Mythos enforces a hard boundary: subagents write fenced machine-readable records into a run directory, the compiler hashes and validates them, and Prime only ever sees the compiled packet. On top of that, runtime-minted execution receipts close the gap between a lane *claiming* "tests passed" and the orchestrator having actually watched it happen — the difference between **asserted** evidence (the agent wrote it about itself) and **attested** evidence (the runtime observed it).

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

The runtime is the same for everyone (product name Receipts, binaries still named `mythos` / `mythos-skill` — the rename lands at M3). The skill package is a contract file the host AI surface reads to know *how* to call the runtime: which subagent lanes to spawn, when to absorb their output, when to mint receipts, when to conclude.

## How a run flows

This is the current Prime loop. Two composite commands, `absorb` and `conclude`, collapse what used to be a 7-command dance (init, ingest, diff, run, compile, compile --record-synthesis, gate, report, next) into about four motions per pass.

```
Prime (Claude Code / Codex / custom)
  │
  ├─ mythos-skill init <run-dir> [--repo-root <path>]
  │     Scaffolds manifest.json, task.md, and a seed evidence + pending-
  │     synthesis finding. repo_root is recorded in manifest.json (defaults
  │     to cwd, or pass --repo-root explicitly) — every later file citation
  │     resolves against THAT path, never the installed package directory.
  │     Convention: put the run dir under <cwd>/.mythos/runs/<name> in the
  │     project you're actually working on.
  │
  ├─ per completed lane — a task-only brief, zero format burden (see
  │  "Subagent output contract" below), then:
  │     mythos-skill absorb --run-dir <d> --lane <l> --agent-id <a> --from <file>
  │       1. ingest  — quarantine the lane file, parse/repair/hash it
  │       2. diff    — mint a work:tree receipt of what changed on disk
  │                     (skip with --no-diff; non-fatal if repo_root isn't a git repo)
  │       3. compile — recompile state/next_pass_packet.json
  │     One JSON line on success: {"ok":true,"lane":...,"compiled":true,...}
  │
  ├─ per check Prime actually relies on:
  │     mythos-skill run --run-dir <d> --label test:<name> -- <command...>
  │       Mints a hash-chained execution receipt the lane cannot fake or
  │       edit. A passing receipt upgrades any claim citing that label to
  │       `attested`; a FAILING receipt mechanically refutes any "passed"
  │       claim citing the same label and turns the gate red — non-negotiable.
  │
  ├─ mythos-skill resolve --run-dir <d> --target <id> --reason "<why>" [--cite <source-id>]
  │     Only when a BLOCKING worklist item is genuinely dispositioned.
  │     Records a hash-chained adjudication; recompile to apply.
  │
  └─ mythos-skill conclude --run-dir <d> --synthesis "<source-backed summary>" [--skip-report]
        1. records Prime's synthesis and recompiles
        2. runs the strict gate, always writing state/gate-report.json
           (green or red)
        3. renders state/report.html (skip with --skip-report)
        4. prints the compressed Prime brief (`mythos-skill next`)
        Exit code = the gate's exit code — a red pass concludes red.
```

Prime never consumes subagent prose directly, and never reads the raw packet either. `mythos-skill next --run-dir <d> [--json]` — printed automatically at the end of `conclude`, or re-run any time — is what Prime actually reads: blocking worklist first, receipt-backed refutations, trusted facts, per-lane digests with drill-down handles into the quarantined raw text, receipts, and drift warnings.

## What you get

- **Execution receipts** — `mythos-skill run --run-dir <d> --label test:name -- <command>` executes the command and mints a tamper-evident, hash-chained receipt (content-addressed stdout/stderr artifacts, git tree state before/after, child exit code propagated). Receipts require ZERO agent cooperation — the orchestrator mints them — and compile into `attested`-tier facts.
- **Work receipts** — `mythos-skill diff --run-dir <d> [--note "..."] [--patch]` mints a receipt of what actually changed in the repo tree (numstat summary by default; `--patch` embeds the full diff, capped at 512KB). Work receipts attest tree state; they are invisible to claim attestation by design — the label `work:tree` never upgrades a lane's claims, so a lane can't buy trust just by diffing.
- **Mechanical refutation** — a "passed" verifier claim citing a label whose latest receipt actually FAILED is contradicted by ground truth at compile time (`con:receipt:*`) and turns the strict gate red, unconditionally.
- **Derived worklist + hash-chained resolutions** — the compiler derives `candidate_actions` from contradictions, gaps, and blockers and classifies each as `blocking` or advisory. `mythos-skill resolve --run-dir <d> --target <id> --reason "..." [--cite <source-id>]` records an append-only, hash-chained adjudication that clears a blocking item on the next compile.
- **Lane digests with drill-down** — every lane gets a digest (record / attested / verifier / asserted / warning / contradiction counts) plus a `read_recommendation` (skip-verified / read-adjudicate / read-unverified / blocked) and span-suffixed raw-source drill-down handles, so Prime can decide which lanes are worth opening in full without reading all of them.
- **Deterministic compilation** — byte-identical packets from byte-identical inputs, verified by an integration test.
- **Forgiving, zero-burden ingest** — lane briefs are task-only; agents get no format instructions. Fenced `mythos-evidence-jsonl` / `mythos-verifier-jsonl` blocks are parsed and repaired liberally when present; unlabeled prose gets its claims harvested sentence-by-sentence (any concrete path or `file.ext:line` citation becomes its own hash-verified record); anything left over becomes a single demoted `unstructured` record. Every repair is logged in the ingest report. Extraction can never manufacture trust — promotion still needs receipts or verifier backing.
- **The strict gate** — `mythos-skill gate --run-dir <d>` (folded into `conclude`) checks input freshness, coverage, subagent traceability, direct-source-ref ratios, machine-specific path leakage, receipt refutations, and unresolved blocking worklist items before a run counts as "done".
- **Hash-provenanced evidence** — every `file:` source is re-hashed at compile/gate time; a tampered run-dir artifact fails closed, while drift in the live repo tree (e.g. a post-review fix) is a warning, not a false failure — the ingest-time hash pins what the agent actually saw.
- **Agent attribution** — every record carries a caller-stamped `agent_id`/`lane`; a record's own declared identity is preserved only as `claimed_agent_id`/`claimed_lane` and can never override the caller.
- **Auto-contradiction detection** — evidence from different agents on the same direct span with divergent summaries surfaces as `contradictions`, severity-graded by evidence kind.
- **Concurrent-ingest safe** — an O_EXCL advisory-lock sidecar serializes parallel `ingest` appends, so several lanes finishing at once never corrupt `evidence.jsonl`.

## Install

### From source (the reliable path right now)

```bash
git clone https://github.com/inchwormz/mythos-skill
cd mythos-skill
cargo install --path mythos-compiler   # builds and installs the `mythos` binary
npm link                                # links bin/mythos-skill.mjs as the `mythos-skill` command
mythos-skill ready                      # end-to-end self-test — must print "mythos readiness: passed"
```

This always matches the checkout you're reading. Use it until the next crates.io/npm publish.

### One-liners (may lag behind this checkout)

The scripted installers and the `cargo install mythos-skill` / `npm install -g github:...` commands below pull whatever was last published to crates.io, npm, or the GitHub `main` branch. This repo ships faster than it publishes — a command documented in this README (for example, `absorb`/`conclude`) can be missing from a fresh one-liner install until the next version bump. If a command in this README doesn't exist after installing this way, use **From source** above instead.

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

## Quick start

```bash
# 1. Scaffold a run directory. repo_root is recorded from cwd (or pass
#    --repo-root); convention is to nest it under .mythos/runs/ in the
#    project you're actually working on.
mythos-skill init .mythos/runs/my-run

# 2. After a lane finishes and writes raw/subagents/lane-a.md, absorb it in
#    one motion: ingest -> work receipt -> recompile.
mythos-skill absorb --run-dir .mythos/runs/my-run --lane lane-a --agent-id agent-1 \
  --from .mythos/runs/my-run/raw/subagents/lane-a.md

# 3. Mint a receipt for every check you actually rely on. This is the ONLY
#    way a command/test claim becomes attested instead of merely asserted.
mythos-skill run --run-dir .mythos/runs/my-run --label test:suite -- cargo test

# 4. Clear a blocking worklist item once it's genuinely dispositioned
#    (see the id in `mythos-skill next`'s worklist).
mythos-skill resolve --run-dir .mythos/runs/my-run --target <id> --reason "<why this is adjudicated>"

# 5. Conclude the pass in one motion: synthesis -> recompile -> gate ->
#    report -> the Prime brief. Exit code is the gate's.
mythos-skill conclude --run-dir .mythos/runs/my-run \
  --synthesis "one-paragraph summary with direct citations"
```

`conclude` prints the brief for you; re-read it any time with `mythos-skill next --run-dir .mythos/runs/my-run`.

## Subagent output contract (forgiving by design)

The full contract an agent must get right is two fields:

````markdown
```mythos-evidence-jsonl
{"summary":"<one factual claim>","source_ids":["file:<repo-relative-path>:<line>"]}
```

```mythos-verifier-jsonl
{"summary":"<verdict>","status":"passed","verifier_score":1.0,"source_ids":["file:<path>:<line>"]}
```
````

Everything else is repaired at ingest and every repair is recorded in the
ingest report: missing ids/kinds/timestamps are defaulted; field synonyms
(`text`/`note`/`claim`, `type`, `sources`, `timestamp`...) are aliased; sloppy
JSON (single quotes, trailing commas, unquoted keys, pretty-printing, whole
arrays) is repaired; bare or mislabeled fences are classified by content; bare
`path:line` citations get the `file:` prefix. Do NOT write `source_refs` —
ingest discards hand-written refs and synthesizes hashed ones from your
`source_ids`.

What cannot be repaired, because it is the point of the system:

- **Cite real files at real lines.** A citation that does not resolve is
  downgraded to a non-provenance `log:` id and the claim can never become a
  trusted fact.
- **A "passed" verifier finding (score >= 0.9) needs a content-backed
  citation** or the strict gate goes red.
- **Prose-only reports are quarantined, not rewarded**: the lane survives as a
  single demoted `unstructured` record that counts for nothing.
- Stuck? Put `BLOCKED <reason>` on its own line — it becomes a machine-readable
  blocker record.

Direct source id prefixes: `file:<repo-relative-path>:<line>` (content-hashed —
real provenance) · `command:` / `test:` / `log:` (label-hashed identity keys —
not provenance unless an execution receipt with that label backs them; see
"What you get" above).

## Known gaps (not oversold)

- **Receipts authenticate execution, not the executor.** Any process on the
  box — including a lane with shell access — can invoke `mythos-skill run`
  itself, including choosing a passing label. Fine under a single-operator
  trust model; per-principal signing is a later hardening milestone.
- **Label semantics are coarse.** A passing label attests "this command ran
  green", not that the command semantically covers the specific claim citing
  it. A lane that bulk-cites plausible passing labels inflates its attested
  share; conservative lane-digest rules limit the damage, but the real fix
  (engine-side receipt<->claim association) is still open.
- **Content hashes are FNV-1a-64**, a fast tripwire against accidental drift
  and confabulation — not a cryptographic hash, and not intended to resist a
  deliberate adversary.

Full gap list, milestone state, and decisions: [RECEIPTS-LEDGER.md](./RECEIPTS-LEDGER.md).

## Layout

- `mythos-compiler/` — Rust crate (`mythos-skill` on crates.io, binary `mythos`; subcommands `init`, `run`, `diff`, `resolve`, `compile`, `report`, `next`)
- `bin/mythos-skill.mjs` — Node CLI dispatcher: passes `init`/`run`/`diff`/`resolve`/`next` straight through to the `mythos` binary, runs `compile`/`ingest`/`gate`/`ready` itself, and provides the composite commands `absorb` and `conclude` that chain the above into one motion per lane / per pass
- `scripts/ingest-subagent.mjs` — subagent output ingest (forgiving parser, quarantine, advisory lock)
- `scripts/strict-gate.mjs` — packet quality gate
- `scripts/readiness.mjs` — end-to-end self-test
- `driver.mjs` — Node entrypoint invoked by `mythos-skill compile`; creates or recompiles a run and prints the packet
- `skills/claude/` — Claude Code skill package + installers
- `skills/codex/` — Codex skill package + installers
- `tests/` — Node test suite: packet round-trip, M0 trust semantics, forgiving ingest, receipts/attestation, worklist/resolutions, the Prime brief, and the loop composites
- `RECEIPTS-LEDGER.md` — live campaign ledger: milestone state, known gaps, decisions

## Development

```bash
cargo test --manifest-path mythos-compiler/Cargo.toml
node --test tests/*.test.js
node scripts/readiness.mjs
```

## License

MIT — see [LICENSE](./LICENSE).
