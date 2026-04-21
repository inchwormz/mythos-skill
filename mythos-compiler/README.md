# mythos-compiler

`mythos-compiler` is the first local compiler slice for the hosted-brain /
local-body Mythos architecture.

It retargets the useful kernel ideas from `munin-memory` away from:

- cross-session user memory

toward:

- explicit-state recurrent synthesis for a single objective/run/branch/pass loop

## First slice

This crate currently provides:

- typed evidence records
- typed packet and snapshot schemas
- append-only journal helpers
- artifact/source references
- trust gating for next-pass packetization
- promotion scoring for reusable directives
- recurring failure signal extraction
- packet assembly from compiler inputs

## Target outputs

- `next_pass_packet.json`
- `snapshot.json`
- `decision_log.jsonl`

`promotion_record` remains part of the typed log surface, but it is no longer a
competing top-level output contract.

## CLI

```powershell
cargo run --bin mythos -- compile --run-dir tests/fixtures/run-basic
```

Expected run directory shape:

- `manifest.json`
- `task.md`
- `raw/`
- `worker-results/evidence.jsonl`
- `verifier-results/findings.jsonl`

The command writes outputs to `state/` inside the run directory.

Evidence and verifier records may include `source_refs` alongside `source_ids`.
Use this for direct provenance such as file lines, command output, test proof,
or log spans. The compiler promotes declared `source_refs` into the packet source
registry, and strict gates can reject substantive records that only cite a broad
raw markdown summary.

Minimal direct-provenance evidence shape:

```json
{
  "id": "ev-example",
  "kind": "code-change",
  "summary": "The timeout helper is now used by Firecrawl API calls.",
  "source_ids": ["file:skills/foo.js:42"],
  "source_refs": [
    {
      "source_id": "file:skills/foo.js:42",
      "path": "skills/foo.js",
      "kind": "file",
      "hash": "stable-hash",
      "span": "42",
      "observed_at": "2026-04-21T00:00:00Z"
    }
  ],
  "observed_at": "2026-04-21T00:00:00Z"
}
```

## Relationship to Munin

This crate is not a full Munin fork. It is a surgical retargeting of the
compiler-kernel shape described in:

- `../munin-fork-plan.md`

The hosted model remains the control plane. This crate exists to make the
compiler state explicit, local, replayable, and inspectable.
