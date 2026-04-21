#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function usage() {
  return [
    "Usage:",
    "  node scripts/strict-gate.mjs --run-dir <path>",
    "",
    "Fails unless a substantive Mythos run has completed the explicit-state",
    "subagent -> evidence/findings/raw -> recompile -> recorded synthesis loop.",
  ].join("\n");
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const runDirFlag = argv.indexOf("--run-dir");
  const runDir = runDirFlag === -1 ? null : argv[runDirFlag + 1];
  if (!runDir || runDir.startsWith("--")) fail(usage(), 2);
  return { runDir: path.resolve(runDir) };
}

function readJson(file, errors, label) {
  if (!fs.existsSync(file)) {
    errors.push(`missing ${label}: ${file}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`invalid ${label}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function readJsonl(file, errors, label) {
  if (!fs.existsSync(file)) {
    errors.push(`missing ${label}: ${file}`);
    return [];
  }
  const records = [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      errors.push(
        `invalid ${label} line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return records;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        files.push(full);
      }
    }
  }
  return files;
}

function mtimeMs(file) {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
}

function inputFiles(runDir) {
  const inputDirs = ["raw", "worker-results", "verifier-results"];
  return [
    path.join(runDir, "manifest.json"),
    path.join(runDir, "task.md"),
    ...inputDirs.flatMap((dir) => walkFiles(path.join(runDir, dir))),
  ].filter((file) => fs.existsSync(file)).sort();
}

function inputFingerprint(runDir) {
  return inputFiles(runDir).map((file) => {
    const stat = fs.statSync(file);
    return {
      path: path.relative(runDir, file).replace(/\\/g, "/"),
      size: stat.size,
      hash: fnv1aHash(fs.readFileSync(file)),
    };
  });
}

function stalePacket(runDir, packetPath) {
  const fingerprintPath = path.join(runDir, "state", "input_fingerprint.json");
  if (fs.existsSync(fingerprintPath)) {
    return JSON.stringify(readJson(fingerprintPath, [], "input_fingerprint")) !== JSON.stringify(inputFingerprint(runDir));
  }
  const files = inputFiles(runDir);
  return mtimeMs(packetPath) + 5 < Math.max(0, ...files.map(mtimeMs));
}

function hasSourceIds(records) {
  return records.every((record) => Array.isArray(record.source_ids) && record.source_ids.length > 0);
}

function sourceRefs(record) {
  return Array.isArray(record.source_refs) ? record.source_refs : [];
}

function isDirectSourceId(sourceId) {
  return typeof sourceId === "string" && /^(file|command|test|log):/.test(sourceId);
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

function checkSourceKind(source, errors, prefix) {
  if (!source.kind) return;
  if (!ALLOWED_SOURCE_KINDS.has(source.kind)) {
    errors.push(
      `${prefix} source_ref ${source.source_id ?? "<unknown>"} kind "${source.kind}" is not in the allowed set (${[...ALLOWED_SOURCE_KINDS].join("|")})`,
    );
  }
}

function checkObservedAtWindow(observedAt, anchorMs, errors, prefix, label) {
  if (!observedAt || anchorMs === null) return;
  const ts = Date.parse(observedAt);
  if (Number.isNaN(ts)) {
    errors.push(`${prefix} ${label} "${observedAt}" is not a valid ISO8601 timestamp`);
    return;
  }
  const driftDays = Math.abs(ts - anchorMs) / 86_400_000;
  if (driftDays > MAX_OBSERVED_AT_DRIFT_DAYS) {
    errors.push(
      `${prefix} ${label} "${observedAt}" is outside the ${MAX_OBSERVED_AT_DRIFT_DAYS}-day window around run created_at`,
    );
  }
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

function resolveSourcePath(runDir, sourcePath) {
  if (!sourcePath) return null;
  if (path.isAbsolute(sourcePath)) return sourcePath;

  // raw/worker-results/verifier-results paths are run-dir-relative. Prefer
  // resolving inside run_dir first so the integrity check follows the exact
  // artifact the compiler just hashed.
  const insideRun = path.resolve(runDir, sourcePath);
  if (fs.existsSync(insideRun)) return insideRun;

  return path.resolve(root, sourcePath);
}

function checkHashAlg(source, errors, prefix) {
  if (source.hash_alg && source.hash_alg !== "fnv1a-64") {
    errors.push(
      `${prefix} source_ref ${source.source_id} uses unsupported hash_alg "${source.hash_alg}" (expected "fnv1a-64")`,
    );
  }
  // Require a hash for every source_ref regardless of kind. Previously the hash
  // format check only fired when hash was truthy, which let command/test/log
  // kind refs omit the hash entirely and bypass integrity verification.
  if (source.hash === undefined || source.hash === null || source.hash === "") {
    errors.push(
      `${prefix} source_ref ${source.source_id ?? "<unknown>"} is missing hash (required for every source_ref)`,
    );
  } else if (!/^[0-9a-f]{16}$/.test(String(source.hash))) {
    errors.push(
      `${prefix} source_ref ${source.source_id} hash "${source.hash}" is not a valid fnv1a-64 digest`,
    );
  }
}

function checkFileSourceRef(source, runDir, errors, prefix) {
  if (source.kind !== "file") return;

  const resolved = resolveSourcePath(runDir, source.path);
  if (!resolved || !fs.existsSync(resolved)) {
    errors.push(`${prefix} file source_ref ${source.source_id} path does not exist: ${source.path}`);
    return;
  }

  const bytes = fs.readFileSync(resolved);
  const actualHash = fnv1aHash(bytes);
  if (source.hash !== actualHash) {
    errors.push(
      `${prefix} file source_ref ${source.source_id} hash mismatch: expected ${actualHash}, got ${source.hash}`,
    );
  }

  if (source.span) {
    const lineCount = bytes.toString("utf8").split(/\r?\n/).length;
    const match = /^(\d+)(?:-(\d+))?$/.exec(String(source.span));
    if (!match) {
      errors.push(`${prefix} file source_ref ${source.source_id} span must be a line or line range`);
      return;
    }
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (start < 1 || end < start || end > lineCount) {
      errors.push(
        `${prefix} file source_ref ${source.source_id} span ${source.span} is outside file line range 1-${lineCount}`,
      );
    }
  }
}

function checkRawSourceRef(source, runDir, errors, prefix) {
  if (source.kind !== "raw") return;
  // Raw artifacts are always resolved relative to run_dir. Absolute legacy
  // paths are tolerated for backwards compatibility, but we re-verify the
  // hash so quarantined subagent output cannot be mutated after ingest.
  const candidate = path.isAbsolute(source.path) ? source.path : path.resolve(runDir, source.path);
  if (!fs.existsSync(candidate)) {
    errors.push(
      `${prefix} raw source_ref ${source.source_id} path does not exist under run_dir: ${source.path}`,
    );
    return;
  }
  const actualHash = fnv1aHash(fs.readFileSync(candidate));
  if (source.hash !== actualHash) {
    errors.push(
      `${prefix} raw source_ref ${source.source_id} hash mismatch: expected ${actualHash}, got ${source.hash}`,
    );
  }
}

function hasDirectSource(record) {
  const declaredIds = sourceRefs(record).map((source) => source.source_id).filter(Boolean);
  return declaredIds.some(isDirectSourceId);
}

function packetSourceIds(packet) {
  return new Set((packet?.sources ?? []).map((source) => source.source_id).filter(Boolean));
}

function checkDeclaredSourceRefs(records, runDir, errors, label, anchorMs) {
  for (const record of records) {
    const declared = sourceRefs(record);
    const declaredIds = new Set(declared.map((source) => source.source_id).filter(Boolean));
    for (const sourceId of record.source_ids ?? []) {
      if (isDirectSourceId(sourceId) && !declaredIds.has(sourceId)) {
        errors.push(
          `${label} ${record.id ?? "<unknown>"} lists direct source_id ${sourceId} without matching source_refs entry`,
        );
      }
    }
    if (declared.length === 0) continue;

    const sourceIds = new Set(record.source_ids ?? []);
    for (const source of declared) {
      const prefix = `${label} ${record.id ?? "<unknown>"}`;
      if (!source.source_id) errors.push(`${prefix} has source_ref without source_id`);
      if (!source.path) errors.push(`${prefix} has source_ref ${source.source_id ?? "<unknown>"} without path`);
      if (!source.kind) errors.push(`${prefix} has source_ref ${source.source_id ?? "<unknown>"} without kind`);
      if (!source.hash) errors.push(`${prefix} has source_ref ${source.source_id ?? "<unknown>"} without hash`);
      if (!source.observed_at) {
        errors.push(`${prefix} has source_ref ${source.source_id ?? "<unknown>"} without observed_at`);
      }
      if (source.source_id && !sourceIds.has(source.source_id)) {
        errors.push(`${prefix} declares source_ref ${source.source_id} but does not list it in source_ids`);
      }
      checkSourceKind(source, errors, prefix);
      checkHashAlg(source, errors, prefix);
      checkFileSourceRef(source, runDir, errors, prefix);
      checkRawSourceRef(source, runDir, errors, prefix);
      checkObservedAtWindow(source.observed_at, anchorMs, errors, prefix, "source_ref observed_at");
    }
    checkObservedAtWindow(
      record.observed_at,
      anchorMs,
      errors,
      `${label} ${record.id ?? "<unknown>"}`,
      "record observed_at",
    );
  }
}

function checkPacketSourceIntegrity(packet, runDir, errors, anchorMs) {
  // Packet.sources is synthesized by the compiler. Its `kind` field is the
  // record's category (e.g. "evidence", "verifier") OR — for legacy synthesis
  // paths — the evidence record's own semantic kind (e.g. "root-cause",
  // "subagent-session"). Do NOT enforce the source_ref kind allowlist on
  // packet.sources; that check is reserved for user-authored source_refs on
  // evidence/verifier records.
  for (const source of packet?.sources ?? []) {
    const prefix = `packet sources ${source.source_id ?? "<unknown>"}`;
    checkHashAlg(source, errors, prefix);
    checkFileSourceRef(source, runDir, errors, prefix);
    checkRawSourceRef(source, runDir, errors, prefix);
    checkObservedAtWindow(source.observed_at, anchorMs, errors, prefix, "observed_at");
  }
}

function checkPacketSchemaVersion(packet, errors) {
  if (!packet) return;
  if (packet.schema_version !== "1.1.0") {
    errors.push(
      `packet schema_version "${packet.schema_version ?? "<missing>"}" is not the expected "1.1.0"`,
    );
  }
}

function checkCompiledSourceRefs(records, packet, errors, label) {
  const compiled = packetSourceIds(packet);
  for (const record of records) {
    for (const source of sourceRefs(record)) {
      if (source.source_id && !compiled.has(source.source_id)) {
        errors.push(
          `${label} ${record.id ?? "<unknown>"} source_ref ${source.source_id} was not compiled into next_pass_packet.sources`,
        );
      }
    }
    // Catch dangling direct source_ids: ids that are declared on the record but
    // never promoted into packet.sources (e.g. because the matching source_ref
    // was silently dropped). A direct source_id with no compiled counterpart is
    // laundering — fail the gate.
    for (const sourceId of record.source_ids ?? []) {
      if (isDirectSourceId(sourceId) && !compiled.has(sourceId)) {
        errors.push(
          `${label} ${record.id ?? "<unknown>"} direct source_id ${sourceId} was not compiled into next_pass_packet.sources`,
        );
      }
    }
  }
}

function requiresDirectEvidence(record) {
  const kind = String(record.kind ?? "").toLowerCase();
  if (["objective", "process", "subagent-session", "codex-synthesis"].includes(kind)) return false;
  return true;
}

function requiresDirectVerifier(record) {
  const id = String(record.id ?? "").toLowerCase();
  const summary = String(record.summary ?? "").toLowerCase();
  if (id.includes("subagent") || summary.includes("subagent")) return false;
  if (id.includes("synthesis") || summary.includes("codex synthesis")) return false;
  if (id.includes("smoke-not-run")) return false;
  return Number(record.verifier_score ?? 0) >= 0.9 || id.includes("syntax") || id.includes("test");
}

function statusSummary(records) {
  return records.map((record) => ({
    id: record.id ?? "<unknown>",
    status: record.status ?? "<missing>",
    verifier_score: record.verifier_score ?? null,
  }));
}

function main() {
  const { runDir } = parseArgs(process.argv.slice(2));
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(runDir)) fail(`run dir does not exist: ${runDir}`);

  const manifestPath = path.join(runDir, "manifest.json");
  const packetPath = path.join(runDir, "state", "next_pass_packet.json");
  const evidencePath = path.join(runDir, "worker-results", "evidence.jsonl");
  const findingsPath = path.join(runDir, "verifier-results", "findings.jsonl");
  const rawDir = path.join(runDir, "raw");
  const rawSubagentDir = path.join(rawDir, "subagents");

  const manifest = readJson(manifestPath, errors, "manifest");
  const packet = readJson(packetPath, errors, "next_pass_packet");
  const evidence = readJsonl(evidencePath, errors, "evidence");
  const findings = readJsonl(findingsPath, errors, "verifier findings");

  if (manifest && packet && manifest.pass_id !== packet.pass_id) {
    errors.push(`manifest pass_id ${manifest.pass_id} does not match packet pass_id ${packet.pass_id}`);
  }

  if (manifest?.pass_id === "pass-0001") {
    errors.push("run is still pass-0001; strict gate requires at least one promoted recurrence pass");
  }

  if (stalePacket(runDir, packetPath)) {
    errors.push("next_pass_packet.json is stale; re-run driver.mjs --run-dir before proceeding");
  }

  if (evidence.length <= 1) {
    errors.push("run has only objective evidence; subagent/compiler promotion has not happened");
  }

  checkPacketSchemaVersion(packet, errors);
  const anchorMs = manifest?.created_at ? Date.parse(manifest.created_at) : null;
  const anchor = Number.isFinite(anchorMs) ? anchorMs : null;
  if (!hasSourceIds(evidence)) errors.push("one or more evidence records lack source_ids");
  if (!hasSourceIds(findings)) errors.push("one or more verifier findings lack source_ids");
  checkDeclaredSourceRefs(evidence, runDir, errors, "evidence", anchor);
  checkDeclaredSourceRefs(findings, runDir, errors, "verifier finding", anchor);
  checkCompiledSourceRefs(evidence, packet, errors, "evidence");
  checkCompiledSourceRefs(findings, packet, errors, "verifier finding");
  checkPacketSourceIntegrity(packet, runDir, errors, anchor);

  const summaryOnlyEvidence = evidence.filter(
    (record) => requiresDirectEvidence(record) && !hasDirectSource(record),
  );
  if (summaryOnlyEvidence.length > 0) {
    errors.push(
      `summary-only evidence lacks direct file/command provenance: ${summaryOnlyEvidence
        .map((record) => record.id)
        .join(", ")}`,
    );
  }

  const summaryOnlyFindings = findings.filter(
    (record) => requiresDirectVerifier(record) && !hasDirectSource(record),
  );
  if (summaryOnlyFindings.length > 0) {
    errors.push(
      `summary-only verifier findings lack direct file/command provenance: ${summaryOnlyFindings
        .map((record) => record.id)
        .join(", ")}`,
    );
  }

  const hasSubagentEvidence = evidence.some((record) => {
    const text = `${record.id ?? ""} ${record.kind ?? ""} ${record.summary ?? ""}`.toLowerCase();
    return text.includes("subagent") || text.includes("fanout") || text.includes("micro-lane");
  });
  const hasSubagentFinding = findings.some((record) => {
    const text = `${record.id ?? ""} ${record.summary ?? ""}`.toLowerCase();
    return text.includes("subagent") && record.status === "passed";
  });
  if (!hasSubagentEvidence && !hasSubagentFinding) {
    errors.push("no passed subagent/fanout evidence found; Prime likely did work outside the compiler path");
  }
  const subagentSessionEvidence = evidence.filter((record) => record.kind === "subagent-session");
  const rawSubagentFiles = walkFiles(rawSubagentDir);
  const compiledSources = packetSourceIds(packet);
  if (rawSubagentFiles.length === 0) {
    errors.push("no raw/subagents session artifacts found; subagent outputs were not quarantined");
  }
  if (rawSubagentFiles.length > 0) {
    const hasCompiledRawSubagent = [...compiledSources].some((sourceId) => sourceId.startsWith("raw:subagents/"));
    if (!hasCompiledRawSubagent) {
      errors.push("raw/subagents artifacts were not compiled into next_pass_packet.sources");
    }
  }
  if (subagentSessionEvidence.length === 0) {
    errors.push("no subagent-session evidence records found; raw subagent output was not ingested mechanically");
  }
  for (const record of subagentSessionEvidence) {
    const refsRawSubagent = (record.source_ids ?? []).some((sourceId) => sourceId.startsWith("raw:subagents/"));
    if (!refsRawSubagent) {
      errors.push(`subagent-session evidence ${record.id ?? "<unknown>"} does not reference raw:subagents/*`);
    }
    const rawSourceRefs = sourceRefs(record).filter((source) => source.source_id?.startsWith("raw:subagents/"));
    if (rawSourceRefs.length === 0) {
      errors.push(`subagent-session evidence ${record.id ?? "<unknown>"} does not declare raw:subagents/* source_refs`);
    }
    for (const source of rawSourceRefs) {
      if (!compiledSources.has(source.source_id)) {
        errors.push(
          `subagent-session evidence ${record.id ?? "<unknown>"} raw source_ref ${source.source_id} was not compiled into next_pass_packet.sources`,
        );
      }
    }
  }

  const hasSynthesisEvidence = evidence.some((record) => record.kind === "codex-synthesis");
  const hasSynthesisRaw = walkFiles(rawDir).some((file) => path.basename(file).startsWith("codex-synthesis-"));
  if (!hasSynthesisEvidence || !hasSynthesisRaw) {
    errors.push("Codex synthesis was not recorded through driver.mjs --record-synthesis");
  }

  const nonPassingFindings = findings.filter((record) => record.status !== "passed");
  if (nonPassingFindings.length > 0) {
    errors.push(`non-passing verifier findings remain: ${nonPassingFindings.map((record) => record.id).join(", ")}`);
  }

  const haltKinds = (packet?.halt_signals ?? []).map((signal) => signal.kind);
  if (!haltKinds.includes("ready-to-halt")) {
    errors.push("packet is not ready-to-halt");
  }
  if ((packet?.candidate_actions ?? []).length > 0) {
    errors.push("packet still has candidate_actions; resolve or record them before finalizing");
  }

  if ((packet?.sources ?? []).length < evidence.length + findings.length) {
    warnings.push("packet source count is lower than evidence+finding count; inspect source promotion");
  }

  const report = {
    ok: errors.length === 0,
    run_dir: runDir,
    pass_id: manifest?.pass_id ?? null,
    packet_pass_id: packet?.pass_id ?? null,
    evidence_count: evidence.length,
    verifier_findings: statusSummary(findings),
    halt_kinds: haltKinds,
    candidate_actions: (packet?.candidate_actions ?? []).length,
    errors,
    warnings,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (errors.length > 0) process.exit(1);
}

main();
