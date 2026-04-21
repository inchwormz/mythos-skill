#!/usr/bin/env node
// Mythos subagent ingest.
//
// Input contract (two shapes):
// 1. Fenced records. The subagent markdown contains one or both of:
//      ```mythos-evidence-jsonl  ... ```
//      ```mythos-verifier-jsonl  ... ```
//    Each fenced block is parsed one JSON record per line and appended to the
//    run-dir's worker-results/verifier-results files.
//
// 2. BLOCKED sentinel. A bare-prose subagent response that ends (or contains)
//    a line shaped `BLOCKED <reason>` is accepted even when NO fenced block is
//    present. Ingest synthesizes a `kind:"blocker"` evidence record whose
//    summary is `BLOCKED: <reason>`, whose only source_id is the quarantined
//    raw file, and exits 0. This is how subagents report unrecoverable halts
//    without forging evidence.
//
// Empty / prose-only input without a BLOCKED sentinel remains an error — the
// compiler must not absorb unprovenanced prose as evidence.
//
// Every extracted record is stamped with the caller's `--agent-id` and `--lane`
// unless the record already declares its own (subagents can override).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function usage() {
  return [
    "Usage:",
    "  node scripts/ingest-subagent.mjs --run-dir <path> --lane <name> --agent-id <id> --from <file>",
    "",
    "Quarantines exact subagent output as raw state, then extracts only fenced",
    "mythos-evidence-jsonl and mythos-verifier-jsonl records into run files.",
    "If the input contains a `BLOCKED <reason>` sentinel and no fenced records,",
    "a synthetic blocker evidence record is emitted instead.",
  ].join("\n");
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const value = (flag) => {
    const index = argv.indexOf(flag);
    if (index === -1) return null;
    const next = argv[index + 1];
    return next && !next.startsWith("--") ? next : null;
  };
  const runDir = value("--run-dir");
  const lane = value("--lane");
  const agentId = value("--agent-id");
  const from = value("--from");
  const stdin = argv.includes("--stdin");
  if (stdin) fail("stdin subagent ingest is disabled; write output under raw/subagents and pass --from", 2);
  if (!runDir || !lane || !agentId || !from) fail(usage(), 2);
  return { runDir: path.resolve(runDir), lane, agentId, from: path.resolve(from) };
}

function slugify(input) {
  return (
    String(input)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "subagent"
  );
}

function utcStamp() {
  return new Date().toISOString().replace(/[-:.]/g, "").replace(/\d{3}Z$/, "Z");
}

function fnv1aHash(buffer) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const byte of buffer) {
    hash ^= BigInt(byte);
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function readInput(args) {
  return fs.readFileSync(args.from, "utf8");
}

function isInsideDir(file, dir) {
  const relative = path.relative(dir, file);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeRawName(rawDir, rawPath) {
  return path.relative(rawDir, rawPath).replace(/\\/g, "/");
}

function appendJsonl(file, records) {
  if (records.length === 0) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

// Parse fenced blocks anchored to line starts. Inline triple-backticks embedded
// in prose (e.g. narrative that mentions ```jsonl) no longer break extraction.
// Opening and closing fences must both begin at column 0.
function parseBlocks(text) {
  const blocks = [];
  const fence = /(?:^|\r?\n)```([^\n`]*)\r?\n([\s\S]*?)(?:^|\r?\n)```(?=\r?\n|$)/gm;
  let match;
  while ((match = fence.exec(text)) !== null) {
    const header = match[1].trim().toLowerCase();
    const body = match[2].trim();
    let matched = false;
    if (header === "mythos-evidence-jsonl") {
      blocks.push({ type: "evidence", body });
      matched = true;
    }
    if (header === "mythos-verifier-jsonl") {
      blocks.push({ type: "verifier", body });
      matched = true;
    }
    // Back-compat: accept a "jsonl" fence when preceded by an explicit
    // "mythos-evidence-jsonl" or "mythos-verifier-jsonl" heading within 240
    // characters. The older "suggested evidence/verifier" preamble is still
    // accepted for legacy subagents but is now case-insensitive and trimmed.
    if (!matched && (header === "jsonl" || header.includes(" jsonl"))) {
      const preamble = text.slice(Math.max(0, match.index - 240), match.index).toLowerCase();
      if (preamble.includes("mythos-evidence-jsonl") || preamble.includes("suggested evidence")) {
        blocks.push({ type: "evidence", body });
      }
      if (preamble.includes("mythos-verifier-jsonl") || preamble.includes("suggested verifier")) {
        blocks.push({ type: "verifier", body });
      }
    }
  }
  return blocks;
}

const ALLOWED_SOURCE_KINDS = new Set([
  "file",
  "raw",
  "command",
  "test",
  "log",
  "packet",
  "verifier",
  "evidence",
  "objective",
]);

const MAX_OBSERVED_AT_DRIFT_DAYS = 7;

function readRunCreatedAt(runDir) {
  try {
    const manifestPath = path.join(runDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return null;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return typeof manifest.created_at === "string" ? manifest.created_at : null;
  } catch {
    return null;
  }
}

function validateObservedAt(recordId, observedAt, runCreatedAt) {
  if (!observedAt) return;
  const recordMs = Date.parse(observedAt);
  if (Number.isNaN(recordMs)) {
    throw new Error(`record ${recordId ?? "<unknown>"} observed_at "${observedAt}" is not a valid ISO8601 timestamp`);
  }
  if (!runCreatedAt) return;
  const anchorMs = Date.parse(runCreatedAt);
  if (Number.isNaN(anchorMs)) return;
  const driftDays = Math.abs(recordMs - anchorMs) / 86_400_000;
  if (driftDays > MAX_OBSERVED_AT_DRIFT_DAYS) {
    throw new Error(
      `record ${recordId ?? "<unknown>"} observed_at "${observedAt}" is outside the ${MAX_OBSERVED_AT_DRIFT_DAYS}-day window around run created_at "${runCreatedAt}"`,
    );
  }
}

function normalizeVerifierRecord(record) {
  const next = { ...record };
  if (typeof next.status !== "string") next.status = "pending";
  if (typeof next.verifier_score !== "number") next.verifier_score = 0;
  if (!["pending", "proposed", "passed", "failed", "skipped"].includes(next.status)) {
    throw new Error(
      `verifier finding ${record.id ?? "<unknown>"} status "${next.status}" is not in the allowed set (pending|proposed|passed|failed|skipped)`,
    );
  }
  // H6: accept `closure_reason` as an optional, typed field that records
  // why a "passed" finding is a bounded-audit / bounded-investigation closure
  // rather than a genuine green. Normalize whitespace; drop if empty.
  if (typeof next.closure_reason === "string") {
    const trimmed = next.closure_reason.trim();
    if (trimmed.length > 0) {
      next.closure_reason = trimmed;
    } else {
      delete next.closure_reason;
    }
  } else if (next.closure_reason !== undefined && next.closure_reason !== null) {
    throw new Error(
      `verifier finding ${record.id ?? "<unknown>"} closure_reason must be a string when present`,
    );
  } else if (next.closure_reason === null) {
    delete next.closure_reason;
  }
  return next;
}

function parseJsonlBlock(block) {
  return block.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid ${block.type} JSONL line ${index + 1}: ${error.message}`);
      }
    });
}

// Scan for a `BLOCKED <reason>` sentinel. Match is anchored to line starts
// and tolerates leading/trailing whitespace, so subagents can put it on the
// last line of an otherwise-prose response or inline in a report section.
function findBlockedSentinel(text) {
  const match = text.match(/^[ \t]*BLOCKED[ \t]+(.+?)[ \t]*$/m);
  if (!match) return null;
  const reason = match[1].trim();
  return reason.length > 0 ? reason : null;
}

// Stamp lane + agent_id onto every extracted record so downstream consumers
// can trace each evidence/verifier line back to the worker that produced it.
// If the subagent already supplied explicit attribution (e.g. a co-signing
// agent handoff), preserve that value.
function stampAttribution(record, { agentId, lane }) {
  const next = { ...record };
  if (next.agent_id === undefined || next.agent_id === null || next.agent_id === "") {
    next.agent_id = agentId;
  }
  if (next.lane === undefined || next.lane === null || next.lane === "") {
    next.lane = lane;
  }
  return next;
}

function resolveSourcePath(sourcePath) {
  if (!sourcePath) return null;
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(root, sourcePath);
}

function isDirectSourceId(sourceId) {
  return typeof sourceId === "string" && /^(file|command|test|log):/.test(sourceId);
}

// G1+G10: normalize a `file:<path>:<span>` source_id. When the path portion is
// absolute AND resolves to something inside `repoRoot`, rewrite it to
// `file:<repo-relative>:<span>` with forward slashes preserved. Absolute paths
// that resolve OUTSIDE the repo root are left as-is (still machine-specific,
// but at least honest). Non-file source_ids are returned unchanged.
const pathNormalizationLog = new Set();
function normalizeFileSourceId(sourceId, repoRoot) {
  if (typeof sourceId !== "string") return sourceId;
  // Only rewrite `file:...:line` forms. `command:`, `test:`, `log:` etc. pass
  // through untouched because they don't carry filesystem paths.
  const match = /^file:(.+):(\d+(?:-\d+)?)$/.exec(sourceId);
  if (!match) return sourceId;
  const rawPath = match[1];
  const span = match[2];
  // Repo-relative paths never need rewriting. `path.isAbsolute` detects
  // drive-letter (C:\, C:/) and POSIX-absolute forms on both platforms.
  if (!path.isAbsolute(rawPath)) return sourceId;
  // Some agents emit POSIX-absolute paths like `/c/Users/...`. Node's
  // `path.isAbsolute` returns true for those but `path.relative` treats them
  // as starting from filesystem root rather than the drive. Normalize to
  // forward slashes before comparing.
  let absolute;
  try {
    absolute = path.resolve(rawPath);
  } catch {
    return sourceId;
  }
  const normalizedAbs = absolute.replace(/\\/g, "/");
  const normalizedRoot = repoRoot.replace(/\\/g, "/");
  // Must strictly live inside repoRoot (not just share a prefix).
  const relative = path.relative(normalizedRoot, normalizedAbs);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return sourceId;
  }
  const relForwardSlash = relative.replace(/\\/g, "/");
  const next = `file:${relForwardSlash}:${span}`;
  if (next !== sourceId) {
    const key = `${sourceId}->${next}`;
    if (!pathNormalizationLog.has(key)) {
      pathNormalizationLog.add(key);
      process.stderr.write(`ingest: normalized ${sourceId} -> ${next}\n`);
    }
  }
  return next;
}

// G1+G10: normalize a bare path string (as found in source_ref.path). Mirrors
// normalizeFileSourceId: absolute-and-inside-repo => repo-relative-forward-slash.
function normalizeFilePath(rawPath, repoRoot) {
  if (typeof rawPath !== "string" || rawPath.length === 0) return rawPath;
  if (!path.isAbsolute(rawPath)) return rawPath;
  let absolute;
  try {
    absolute = path.resolve(rawPath);
  } catch {
    return rawPath;
  }
  const normalizedAbs = absolute.replace(/\\/g, "/");
  const normalizedRoot = repoRoot.replace(/\\/g, "/");
  const relative = path.relative(normalizedRoot, normalizedAbs);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return rawPath;
  }
  return relative.replace(/\\/g, "/");
}

// H1 kind allowlist: non-file source_refs whose hash is missing or not already a
// valid fnv1a-64 digest get auto-hashed from the source_id bytes. "raw" refs
// still hash from disk when the path resolves under the run dir — that branch
// is handled in normalizeSourceRefs itself.
const AUTO_HASH_KINDS = new Set(["command", "test", "log", "raw", "packet", "verifier", "evidence", "objective"]);

// H3 helper: parse a direct source_id of the form `file:<path>:<line>` /
// `command:<name>` / `test:<name>` / `log:<name>` into the fields a synthesized
// source_ref needs.
function parseDirectSourceId(sourceId) {
  if (typeof sourceId !== "string") return null;
  const fileMatch = /^file:(.+):(\d+(?:-\d+)?)$/.exec(sourceId);
  if (fileMatch) {
    return { kind: "file", path: fileMatch[1], span: fileMatch[2] };
  }
  const prefixMatch = /^(command|test|log):(.+)$/.exec(sourceId);
  if (prefixMatch) {
    return { kind: prefixMatch[1], path: prefixMatch[2], span: null };
  }
  return null;
}

function normalizeSourceRefs(record, observedAt, runCreatedAt, runDir) {
  // G1+G10: normalize every source_id and source_ref.path up front so the rest
  // of the pipeline (dedupe, contradiction detection, packet sources) sees the
  // same shape regardless of whether the agent cited an absolute or
  // repo-relative path. Mutate a shallow clone so the original record stays
  // untouched for diffability.
  const normalizedRecord = { ...record };
  if (Array.isArray(normalizedRecord.source_ids)) {
    normalizedRecord.source_ids = normalizedRecord.source_ids.map((id) =>
      normalizeFileSourceId(id, root),
    );
  }
  if (Array.isArray(normalizedRecord.source_refs)) {
    normalizedRecord.source_refs = normalizedRecord.source_refs.map((ref) => {
      if (!ref || typeof ref !== "object") return ref;
      const next = { ...ref };
      if (typeof next.source_id === "string") {
        next.source_id = normalizeFileSourceId(next.source_id, root);
      }
      // Only rewrite the path when we know this is a file-kind ref AND the
      // path is absolute-inside-repo. Raw/command/test/log paths keep their
      // declared form because they're not filesystem citations.
      if (next.kind === "file" && typeof next.path === "string") {
        next.path = normalizeFilePath(next.path, root);
      }
      return next;
    });
  }

  const declaredRefs = Array.isArray(normalizedRecord.source_refs)
    ? normalizedRecord.source_refs
    : [];
  const declaredIds = new Set(
    declaredRefs
      .map((source) => (source && typeof source.source_id === "string" ? source.source_id : null))
      .filter(Boolean),
  );

  // H3: for every direct source_id the record declares, synthesize a
  // source_ref if the author didn't hand-write one. Downstream normalization
  // will fill in the hash (from disk for file/raw, from source_id bytes for
  // command/test/log).
  const synthesizedRefs = [];
  for (const sourceId of Array.isArray(normalizedRecord.source_ids)
    ? normalizedRecord.source_ids
    : []) {
    if (!isDirectSourceId(sourceId) || declaredIds.has(sourceId)) continue;
    const parsed = parseDirectSourceId(sourceId);
    if (!parsed) continue;
    synthesizedRefs.push({
      source_id: sourceId,
      path: parsed.path,
      kind: parsed.kind,
      hash: "placeholder-will-be-filled",
      hash_alg: "fnv1a-64",
      span: parsed.span,
      observed_at: normalizedRecord.observed_at ?? observedAt,
    });
    declaredIds.add(sourceId);
  }

  record = normalizedRecord;
  const sourceRefs = [...declaredRefs, ...synthesizedRefs];

  const normalizedRefs = sourceRefs.map((source) => {
    const next = { ...source };
    if (!next.kind) {
      throw new Error(`source_ref ${next.source_id ?? "<unknown>"} is missing kind`);
    }
    if (!ALLOWED_SOURCE_KINDS.has(next.kind)) {
      throw new Error(
        `source_ref ${next.source_id ?? "<unknown>"} kind "${next.kind}" is not in the allowed set (${[...ALLOWED_SOURCE_KINDS].join("|")})`,
      );
    }
    if (!next.observed_at) next.observed_at = observedAt;
    validateObservedAt(next.source_id, next.observed_at, runCreatedAt);
    if (!next.hash_alg) next.hash_alg = "fnv1a-64";
    if (next.hash_alg !== "fnv1a-64") {
      throw new Error(
        `source_ref ${next.source_id ?? "<unknown>"} hash_alg "${next.hash_alg}" is not supported (expected "fnv1a-64")`,
      );
    }
    if (next.kind === "file") {
      // Block self-referential state/ files: the compiler regenerates
      // <run-dir>/state/next_pass_packet.json, snapshot.json, and
      // decision_log.jsonl on every recompile, so hashing them at ingest
      // guarantees a drift-mismatch on the next recurrence. Evidence must cite
      // stable inputs (source code, raw/*, worker-results/*, verifier-results/*)
      // not compiler outputs.
      const normalizedPath = String(next.path ?? "").replace(/\\/g, "/");
      if (/\.codex\/mythos\/runs\/[^/]+\/state\//.test(normalizedPath)) {
        // H5: tell the agent what to cite instead, not just what not to.
        throw new Error(
          `source_ref ${next.source_id ?? "<unknown>"} points at compiler-generated state/ file (${normalizedPath}); evidence must cite stable inputs — try the run's raw/ or worker-results/ files, or the original source code, not derived compiler outputs`,
        );
      }
      const resolved = resolveSourcePath(next.path);
      if (!resolved || !fs.existsSync(resolved)) {
        throw new Error(`source_ref ${next.source_id ?? "<unknown>"} file path does not exist: ${next.path}`);
      }
      const bytes = fs.readFileSync(resolved);
      next.hash = fnv1aHash(bytes);
      // H2: clip out-of-range spans on file refs to the actual line count
      // instead of hard-failing. Agents frequently guess end-of-range; auto-
      // clipping keeps the ingest contract useful without letting them point
      // at lines that do not exist.
      if (next.span) {
        const match = /^(\d+)(?:-(\d+))?$/.exec(String(next.span));
        if (match) {
          const parts = bytes.toString("utf8").split(/\r?\n/);
          if (parts.length > 0 && parts[parts.length - 1] === "") parts.pop();
          const lineCount = Math.max(1, parts.length);
          let start = Number(match[1]);
          let end = Number(match[2] ?? match[1]);
          const original = next.span;
          if (start < 1) start = 1;
          if (end < 1) end = 1;
          if (start > lineCount) start = lineCount;
          if (end > lineCount) end = lineCount;
          if (start > end) start = end;
          const clipped = start === end ? String(start) : `${start}-${end}`;
          if (clipped !== String(original)) {
            process.stderr.write(
              `ingest: clipped source_ref ${next.source_id ?? "<unknown>"} span "${original}" -> "${clipped}" (file has ${lineCount} line(s))\n`,
            );
            next.span = clipped;
          }
        }
      }
    } else if (next.kind === "raw") {
      // raw refs: if the path resolves under the run dir, prefer the on-disk
      // hash (existing behavior). Otherwise fall through to H1 auto-hashing.
      const rawCandidate = runDir && next.path
        ? (path.isAbsolute(next.path) ? next.path : path.resolve(runDir, next.path))
        : null;
      if (rawCandidate && fs.existsSync(rawCandidate)) {
        next.hash = fnv1aHash(fs.readFileSync(rawCandidate));
      } else if (!/^[0-9a-f]{16}$/.test(String(next.hash ?? ""))) {
        // H1 fallback for raw refs whose path didn't resolve on disk.
        next.hash = fnv1aHash(Buffer.from(String(next.source_id ?? ""), "utf8"));
      }
    } else if (AUTO_HASH_KINDS.has(next.kind)) {
      // H1: command/test/log/packet/verifier/evidence/objective — there is no
      // on-disk artifact to hash, so stable-hash the source_id bytes whenever
      // the agent left a placeholder or forgot a valid digest.
      if (!/^[0-9a-f]{16}$/.test(String(next.hash ?? ""))) {
        next.hash = fnv1aHash(Buffer.from(String(next.source_id ?? ""), "utf8"));
      }
    }
    return next;
  });

  const sourceIds = new Set(Array.isArray(record.source_ids) ? record.source_ids : []);
  for (const source of normalizedRefs) {
    if (!source.source_id) throw new Error(`record ${record.id ?? "<unknown>"} has source_ref without source_id`);
    sourceIds.add(source.source_id);
  }
  const normalizedRefIds = new Set(normalizedRefs.map((source) => source.source_id));
  for (const sourceId of sourceIds) {
    if (isDirectSourceId(sourceId) && !normalizedRefIds.has(sourceId)) {
      // H3 should prevent this branch for parseable direct ids, but keep the
      // throw for defensive coverage (e.g. file:something with no colon+line).
      throw new Error(
        `record ${record.id ?? "<unknown>"} lists direct source_id ${sourceId} without matching source_refs entry`,
      );
    }
  }

  return {
    ...record,
    observed_at: record.observed_at ?? observedAt,
    source_ids: [...sourceIds],
    ...(normalizedRefs.length > 0 ? { source_refs: normalizedRefs } : {}),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.runDir)) fail(`run dir does not exist: ${args.runDir}`);

  const rawText = readInput(args);
  if (!rawText.trim()) fail("subagent output is empty");

  const stamp = utcStamp();
  const observedAt = new Date().toISOString();
  const runCreatedAt = readRunCreatedAt(args.runDir);
  const rawDir = path.join(args.runDir, "raw", "subagents");
  fs.mkdirSync(rawDir, { recursive: true });
  const directRaw = isInsideDir(args.from, rawDir);
  const rawPath = directRaw ? args.from : path.join(rawDir, `${stamp}-${slugify(args.lane)}-${slugify(args.agentId)}.md`);
  if (!directRaw) {
    fs.writeFileSync(
      rawPath,
      [
        `# Subagent Session ${stamp}`,
        "",
        `lane: ${args.lane}`,
        `agent_id: ${args.agentId}`,
        "",
        rawText.trim(),
        "",
      ].join("\n"),
      "utf8",
    );
  }

  const rawName = normalizeRawName(rawDir, rawPath);
  const rawSourceId = `raw:subagents/${rawName}`;

  // G9: refuse to append a second subagent-session record for the same raw
  // file. Retrying ingest against the same --from already-quarantined file is
  // almost always an error — it double-counts the session and double-stamps
  // raw:subagents/... source_ids. Detect BEFORE block parsing so the fail path
  // is deterministic regardless of whether the raw file has fenced records.
  const existingEvidencePath = path.join(args.runDir, "worker-results", "evidence.jsonl");
  if (fs.existsSync(existingEvidencePath)) {
    const existingLines = fs.readFileSync(existingEvidencePath, "utf8").split(/\r?\n/);
    for (const line of existingLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (parsed && parsed.kind === "subagent-session") {
        const sourceIds = Array.isArray(parsed.source_ids) ? parsed.source_ids : [];
        if (sourceIds.includes(rawSourceId)) {
          fail(
            `duplicate ingest: raw/subagents/${rawName} already has a subagent-session record (${parsed.id ?? "<unknown>"}); remove the prior record or use a new --from path`,
          );
        }
      }
    }
  }

  const blocks = parseBlocks(rawText);
  const blockedReason = findBlockedSentinel(rawText);
  if (blocks.length === 0 && !blockedReason) {
    fail(
      `subagent output quarantined at ${rawPath}, but no mythos-evidence-jsonl or mythos-verifier-jsonl block was found`,
    );
  }

  const evidence = [];
  const findings = [];
  for (const block of blocks) {
    const records = parseJsonlBlock(block).map((record) => {
      validateObservedAt(record.id, record.observed_at, runCreatedAt);
      const normalized = normalizeSourceRefs(record, observedAt, runCreatedAt, args.runDir);
      const stamped = stampAttribution(normalized, { agentId: args.agentId, lane: args.lane });
      // H4: every evidence/verifier record ingested from a quarantined raw file
      // must carry that raw file's source_id so R5 traceability passes without
      // post-ingest hand-patching. Prepend so the raw reference appears before
      // the agent's explicit citations, and de-dupe to avoid stamping twice.
      const withRaw = {
        ...stamped,
        source_ids: (stamped.source_ids ?? []).includes(rawSourceId)
          ? stamped.source_ids
          : [rawSourceId, ...(stamped.source_ids ?? [])],
      };
      if (block.type === "verifier") return normalizeVerifierRecord(withRaw);
      return withRaw;
    });
    if (block.type === "evidence") evidence.push(...records);
    if (block.type === "verifier") findings.push(...records);
  }

  // Blocker synthesis: any subagent that signals BLOCKED emits a machine-
  // readable blocker record, whether or not it also supplied fenced evidence.
  // A partial success can still report "this lane is blocked on X" without
  // discarding the evidence it did gather.
  if (blockedReason) {
    evidence.push(
      stampAttribution(
        {
          id: `ev-blocker-${stamp}-${slugify(args.lane)}`,
          kind: "blocker",
          summary: `BLOCKED: ${blockedReason}`,
          source_ids: [rawSourceId],
          observed_at: observedAt,
        },
        { agentId: args.agentId, lane: args.lane },
      ),
    );
  }

  const runRelativeRawPath = path.relative(args.runDir, rawPath).replace(/\\/g, "/");
  evidence.unshift({
    id: `ev-subagent-session-${stamp}-${slugify(args.lane)}`,
    kind: "subagent-session",
    summary: `Captured quarantined subagent output for lane ${args.lane}; machine records were extracted without Prime synthesis.`,
    source_ids: [rawSourceId],
    source_refs: [
      {
        source_id: rawSourceId,
        path: runRelativeRawPath,
        kind: "raw",
        hash: fnv1aHash(fs.readFileSync(rawPath)),
        hash_alg: "fnv1a-64",
        span: null,
        observed_at: observedAt,
      },
    ],
    observed_at: observedAt,
    agent_id: args.agentId,
    lane: args.lane,
  });

  appendJsonl(path.join(args.runDir, "worker-results", "evidence.jsonl"), evidence);
  appendJsonl(path.join(args.runDir, "verifier-results", "findings.jsonl"), findings);

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        raw_path: rawPath,
        raw_source_id: rawSourceId,
        evidence_records: evidence.length,
        verifier_records: findings.length,
      },
      null,
      2,
    )}\n`,
  );
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
