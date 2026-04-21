#!/usr/bin/env node
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

function resolveSourcePath(sourcePath) {
  if (!sourcePath) return null;
  return path.isAbsolute(sourcePath) ? sourcePath : path.resolve(root, sourcePath);
}

function isDirectSourceId(sourceId) {
  return typeof sourceId === "string" && /^(file|command|test|log):/.test(sourceId);
}

function normalizeSourceRefs(record, observedAt, runCreatedAt) {
  const sourceRefs = Array.isArray(record.source_refs) ? record.source_refs : [];
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
        throw new Error(
          `source_ref ${next.source_id ?? "<unknown>"} points at compiler-generated state/ file (${normalizedPath}); evidence must cite stable inputs, not derived outputs`,
        );
      }
      const resolved = resolveSourcePath(next.path);
      if (!resolved || !fs.existsSync(resolved)) {
        throw new Error(`source_ref ${next.source_id ?? "<unknown>"} file path does not exist: ${next.path}`);
      }
      next.hash = fnv1aHash(fs.readFileSync(resolved));
    }
    return next;
  });

  const sourceIds = new Set(Array.isArray(record.source_ids) ? record.source_ids : []);
  for (const source of normalizedRefs) {
    if (!source.source_id) throw new Error(`record ${record.id ?? "<unknown>"} has source_ref without source_id`);
    sourceIds.add(source.source_id);
  }
  const declaredRefs = new Set(normalizedRefs.map((source) => source.source_id));
  for (const sourceId of sourceIds) {
    if (isDirectSourceId(sourceId) && !declaredRefs.has(sourceId)) {
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
  const blocks = parseBlocks(rawText);
  if (blocks.length === 0) {
    fail(
      `subagent output quarantined at ${rawPath}, but no mythos-evidence-jsonl or mythos-verifier-jsonl block was found`,
    );
  }

  const evidence = [];
  const findings = [];
  for (const block of blocks) {
    const records = parseJsonlBlock(block).map((record) => {
      validateObservedAt(record.id, record.observed_at, runCreatedAt);
      const normalized = normalizeSourceRefs(record, observedAt, runCreatedAt);
      if (block.type === "verifier") return normalizeVerifierRecord(normalized);
      return normalized;
    });
    if (block.type === "evidence") evidence.push(...records);
    if (block.type === "verifier") findings.push(...records);
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
