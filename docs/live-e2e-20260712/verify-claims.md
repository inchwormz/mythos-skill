# Verification: FNV-1a 64-bit hash implementation map

Independently re-opened every cited file:line range in evidence-map.md and
compared against the actual source. Also ran an independent sweep for the
literal `0xcbf29ce484222325` (case-insensitive) across the whole repo
(excluding .git, .codex, target; tests/fixtures does not exist), plus a
decimal-form check (`14695981039346656037`) and a wrapping_mul/prime-multiply
pattern check, to look for any implementation the evidence agent might have
missed.

Result: all 10 evidence records (9 implementation claims + 1 aggregate count
claim) check out exactly as stated — line ranges match within the file, and
constants (offset-basis `0xcbf29ce484222325`, prime `0x100000001b3`) match in
every case. The independent sweep found matches in exactly the same 7 files
the evidence agent cites (driver.mjs, scripts/strict-gate.mjs,
scripts/readiness.mjs, scripts/ingest-subagent.mjs,
tests/packet_shape_integrity.test.js, tests/m0_trust_semantics.test.js,
mythos-compiler/src/compiler/run_dir.rs) — no additional implementation was
missed. All other `fnv1a` hits found (MYTHOS-ENGINE-PLAN.md,
mythos-compiler/schemas/*.json, mythos-compiler/src/compiler/{snapshot,packets,
lookup,evidence}.rs, mythos-compiler/src/schema.rs, mythos-compiler/src/lib.rs,
mythos-compiler/README.md) were confirmed to be only the string label
`"fnv1a-64"` used as a hash_alg tag/schema enum/doc reference, not algorithm
implementations, consistent with the evidence agent's claim.

```mythos-evidence-jsonl
{"id":"ev-verify-method","kind":"measurement","summary":"Re-checked all 10 evidence records (9 implementation claims + 1 aggregate) against cited file:line ranges and constants, all matched; an independent repo-wide sweep for 0xcbf29ce484222325 and a decimal/pattern cross-check found the same 7 files and no missed implementation.","source_ids":["file:mythos-compiler/src/compiler/run_dir.rs:682-689"],"observed_at":"2026-07-12T00:00:00Z"}
```

```mythos-verifier-jsonl
{"id":"vf-verify-ev-map-1","summary":"Confirmed: driver.mjs:93-102 defines fnv1aHash(buffer) with offset-basis 0xcbf29ce484222325n and prime 0x100000001b3n, BigInt masked to 64 bits, returned as 16-char hex, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:driver.mjs:93-102"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-2","summary":"Confirmed: scripts/strict-gate.mjs:160-169 defines fnv1aHash(buffer) with offset-basis 0xcbf29ce484222325n and prime 0x100000001b3n, identical body to driver.mjs, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:scripts/strict-gate.mjs:160-169"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-3","summary":"Confirmed: scripts/readiness.mjs:66-75 defines fnv1aHash(buffer) with offset-basis 0xcbf29ce484222325n and prime 0x100000001b3n, identical body to driver.mjs, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:scripts/readiness.mjs:66-75"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-4","summary":"Confirmed: scripts/ingest-subagent.mjs:77-86 defines fnv1aHash(buffer) with offset-basis 0xcbf29ce484222325n and prime 0x100000001b3n, identical body to driver.mjs, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:scripts/ingest-subagent.mjs:77-86"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-5","summary":"Confirmed: tests/packet_shape_integrity.test.js:245-255 defines fnv1aHashString(input) over UTF-8 bytes with offset-basis 0xcbf29ce484222325n and prime 0x100000001b3n, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:tests/packet_shape_integrity.test.js:245-255"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-6","summary":"Confirmed: tests/packet_shape_integrity.test.js:257-266 defines a second, separate fnv1aHashBytes(buffer) with the same offset-basis and prime constants, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:tests/packet_shape_integrity.test.js:257-266"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-7","summary":"Confirmed: tests/packet_shape_integrity.test.js:1488-1497 contains a nested function fnv1a(buffer) defined inside a test case body with the same offset-basis and prime constants, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:tests/packet_shape_integrity.test.js:1488-1497"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-8","summary":"Confirmed: tests/m0_trust_semantics.test.js:21-30 defines its own fnv1aHashBytes(buffer) identical in body to the other JS implementations, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:tests/m0_trust_semantics.test.js:21-30"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-9","summary":"Confirmed: mythos-compiler/src/compiler/run_dir.rs:682-689 defines fn fnv1a_hash(bytes: &[u8]) -> String with offset-basis 0xcbf29ce484222325u64 and prime 0x100000001b3 applied via wrapping_mul, formatted as 16-char lowercase hex, exactly as claimed.","status":"passed","verifier_score":1.0,"source_ids":["file:mythos-compiler/src/compiler/run_dir.rs:682-689"],"observed_at":"2026-07-12T00:00:00Z"}
{"id":"vf-verify-ev-map-10","summary":"Confirmed: independent repo-wide sweep for 0xcbf29ce484222325 (plus decimal-form and wrapping_mul/prime pattern cross-checks) found matches in exactly the same 7 files backing the 9 claimed implementations, no additional implementation missed, so the count of 9 and constant-agreement claim hold.","status":"passed","verifier_score":1.0,"source_ids":["file:mythos-compiler/src/compiler/run_dir.rs:682-689"],"observed_at":"2026-07-12T00:00:00Z"}
```
