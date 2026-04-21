# Munin Fork Plan For Mythos Compiler

## Goal

Build a `mythos-compiler` by forking the useful compiler kernel from `munin-memory` and retargeting it from:

- cross-session user/project memory

to:

- explicit-state recurrent synthesis for a single objective/run/branch/pass loop

The hosted model remains the main brain. The forked local compiler becomes the typed state-shaping layer that feeds the next reasoning pass.

## Decision

Do a **surgical fork**, not a full product fork.

- Keep Munin's compiler mechanics.
- Drop Munin's user-memory product surfaces.
- Rewrite the schema around `objective/run/branch/pass/evidence/action`.

## Keep / Fork

These are the files and concepts worth stealing first.

### Core schema and typed projections

- `munin-memory/src/core/memory_os.rs`
  - Why: already defines typed packet/projection/report shapes instead of prose blobs.
  - Reuse: packet section model, selection model, evidence records, promotion report ideas.
  - Rewrite target: `mythos_state.rs`.

### Compiler kernel

- `munin-memory/src/core/tracking/kernel.rs`
  - Why: kernel assembly logic is the closest thing to "compiled state from raw evidence".
  - Reuse: assembly pattern, stable packet construction, output shaping.

- `munin-memory/src/core/tracking/read_model.rs`
  - Why: read-model split is exactly the right boundary for `raw -> compiled -> served`.
  - Reuse: projection discipline and query-facing compiled views.

- `munin-memory/src/core/tracking/checkpoint.rs`
  - Why: the checkpoint/snapshot pattern maps cleanly to run-pass snapshots.
  - Reuse: capture envelope idea, versioned snapshots.
  - Rename target: `snapshot.rs`.

- `munin-memory/src/core/tracking/journal.rs`
  - Why: append-first journal discipline is correct for replayable explicit state.
  - Reuse: append-only event flow and deterministic rebuild assumptions.

- `munin-memory/src/core/tracking/evidence.rs`
  - Why: evidence should be first-class, typed, and provenance-backed.
  - Reuse: evidence record structure and collection patterns.

### Trust / promotion / recall

- `munin-memory/src/core/tracking/trust.rs`
  - Why: prevents unsafe packetization and forces trust decisions to be explicit.
  - Reuse: `allow/deny/review` model, packetization gate, taint handling.
  - Rewrite target: tune for "should this be promoted into next-pass context?" rather than only privacy/trust.

- `munin-memory/src/core/tracking/promotion_gate.rs`
  - Why: promotion thresholds are one of the hardest parts to get right.
  - Reuse: gate mechanics and explicit promotion criteria.

- `munin-memory/src/core/tracking/recall.rs`
  - Why: compiled-state retrieval with provenance is directly useful.
  - Reuse: provenance-heavy retrieval path and "no fake fallback" discipline.
  - Rewrite target: `evidence lookup`, not human recall UX.

### Signal extraction

- `munin-memory/src/core/tracking/signals.rs`
  - Why: this is where raw repeated patterns become actionable typed findings.
  - Reuse: contradiction/fix/repeated-pattern extraction mindset.
  - Rewrite target: detect recurrent failure, branch conflict, verifier disagreement, and stalled loops.

### Output / reporting

- `munin-memory/src/core/tracking/reports.rs`
  - Why: report generation is useful once the new schema exists.
  - Reuse: render compact machine + human views from compiled state.

### Artifact handling

- `munin-memory/src/core/artifacts.rs`
  - Why: artifact references, hashes, dedupe, and append-only storage are directly useful.
  - Reuse: artifact id/hash/index approach.

## Drop / Do Not Fork

These are Munin product features, not compiler-kernel necessities.

- `src/session_brain/*`
- `src/proactivity_cmd.rs`
- `src/strategy_cmd.rs`
- `src/core/proactivity.rs`
- `src/core/strategy.rs`
- `src/core/access_layer/*`
- installer / slash-command / resolver UX around `munin`
- broad "what do you know about me?" surfaces
- cross-agent user profile projections

These are valuable in Munin, but they would distort this system toward memory-product behavior rather than recurrent synthesis behavior.

## New Mythos Schema

Munin's ontology is roughly:

- session
- checkpoint
- observation
- claim
- rule
- promotion

Mythos compiler should instead use:

- objective
- run
- branch
- pass
- snapshot
- evidence
- hypothesis
- contradiction
- action_candidate
- verifier_finding
- promoted_directive

## Rename Map

- `session_id` -> `run_id`
- `packet_id` -> `pass_id`
- `checkpoint` -> `snapshot`
- `claim` -> `compiled_fact`
- `rule` -> `promoted_directive`
- `recall` -> `evidence_lookup`
- `friction` -> `recurring_failure_pattern`
- `scope` -> `objective_scope` / `run_scope` / `branch_scope`

## New Fields To Add

Munin is not primarily optimized for recurrent next-pass control. Add these:

- `objective_relevance`
- `novelty_gain`
- `branch_id`
- `branch_conflict`
- `verifier_score`
- `decision_dependency_ids`
- `expires_after_pass`
- `needs_raw_drilldown`
- `actionability_score`
- `halt_signal_contribution`
- `merge_confidence`

## New Packet Types

The compiler should emit a next-pass packet, not a human memory brief.

### `next_pass_packet.json`

```json
{
  "objective_id": "obj_001",
  "run_id": "run_0014",
  "branch_id": "main",
  "pass_id": "pass_0006",
  "objective": "string",
  "evidence": [],
  "trusted_facts": [],
  "active_hypotheses": [],
  "contradictions": [],
  "recurring_failure_patterns": [],
  "candidate_actions": [],
  "verifier_findings": [],
  "open_questions": [],
  "raw_drilldown_refs": [],
  "halt_signals": [
    {
      "id": "halt_1",
      "kind": "continue",
      "contribution": 0.2,
      "rationale": "Verifier still reports an unresolved build failure",
      "source_ids": ["verifier_2"]
    }
  ],
  "sources": []
}
```

### `snapshot.json`

```json
{
  "run_id": "run_0014",
  "pass_id": "pass_0006",
  "branch_id": "main",
  "created_at": "2026-04-21T00:00:00Z",
  "inputs": [],
  "worker_results": [],
  "state_delta": [],
  "artifact_refs": []
}
```

### `decision_log.jsonl`

```json
{
  "id": "decision_123",
  "run_id": "run_0014",
  "pass_id": "pass_0006",
  "decision_kind": "promote",
  "summary": "Promote verifier-backed directive into working set",
  "source_ids": ["evidence_1", "verifier_2"],
  "selected_action_ids": ["act_7"],
  "created_at": "2026-04-21T00:00:00Z",
  "promotion": {
    "id": "promo_123",
    "kind": "promoted_directive",
    "source_ids": ["evidence_1", "verifier_2"],
    "decision": "allow",
    "reason": "Repeatedly useful across 4 passes with verifier support",
    "expires_after_pass": null
  }
}
```

## Recommended New Module Layout

Create a new Rust crate or submodule named `mythos-compiler` with:

- `src/compiler/journal.rs`
- `src/compiler/artifacts.rs`
- `src/compiler/evidence.rs`
- `src/compiler/snapshot.rs`
- `src/compiler/trust.rs`
- `src/compiler/promotion.rs`
- `src/compiler/signals.rs`
- `src/compiler/lookup.rs`
- `src/compiler/packets.rs`
- `src/schema.rs`
- `src/compiler/reports.rs`

## Mapping Table

| Munin file | Mythos role | Action |
|---|---|---|
| `core/memory_os.rs` | typed schema seed | fork and rename |
| `core/artifacts.rs` | artifact store | fork mostly intact |
| `core/tracking/journal.rs` | append-only event log | fork mostly intact |
| `core/tracking/checkpoint.rs` | run-pass snapshotting | fork and retarget |
| `core/tracking/evidence.rs` | evidence model | fork and retarget |
| `core/tracking/trust.rs` | packet trust gate | fork and retarget |
| `core/tracking/promotion_gate.rs` | promotion logic | fork and retarget |
| `core/tracking/recall.rs` | evidence lookup | fork and retarget |
| `core/tracking/signals.rs` | repeated-pattern extraction | fork and retarget |
| `core/tracking/kernel.rs` | compiler assembly | fork and simplify |
| `core/tracking/read_model.rs` | compiled serving layer | fork and simplify |
| `core/tracking/reports.rs` | packet/report output | fork selectively |

## First Implementation Slice

Do not build the whole system first. Build only the minimum compiler loop.

### Slice 1: explicit-state compiler MVP

Inputs:

- raw task file
- local worker outputs
- verifier outputs
- prior pass packet

Outputs:

- `snapshot.json`
- `next_pass_packet.json`
- `decision_log.jsonl`

Fork only:

- `memory_os.rs`
- `artifacts.rs`
- `tracking/journal.rs`
- `tracking/checkpoint.rs`
- `tracking/evidence.rs`
- `tracking/trust.rs`
- `tracking/promotion_gate.rs`
- `tracking/signals.rs`

Defer:

- advanced recall UX
- user/profile memory
- proactivity
- strategy
- install surfaces

## Hard Rules

- Never let compiled packets exist without raw source refs.
- Never silently fall back from compiled packet to vague narrative summary.
- Never auto-promote a directive without repeated utility or verifier support.
- Never let one packet be authoritative after a newer contradictory snapshot exists.
- Keep the compiler local and deterministic.
- Keep the main brain external, but feed it only explicit packets.

## Success Criteria

The fork is working when:

- one run can be reconstructed from raw artifacts plus snapshots
- every packet item links back to source evidence
- the compiler can emit a useful next-pass packet in under a few seconds
- recurring failure patterns are surfaced as typed findings
- promotion is explicit, logged, and reversible
- the hosted model can work mostly from packets instead of raw dumps

## Recommendation

Start by forking the compiler kernel into a new crate rather than editing Munin in place.

Best path:

1. Create `mythos-compiler`
2. Copy the kernel files above
3. Replace the schema first
4. Rewire trust/promotion second
5. Add next-pass packet assembly third
6. Only then connect it to the recurrent controller

That keeps the Munin source of truth clean while giving Mythos a purpose-built explicit-state compiler.
