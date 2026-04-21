use crate::compiler::artifacts::ArtifactRef;
use crate::compiler::journal::append_decision_log;
use crate::compiler::packets::{CompilerInputBundle, build_next_pass_packet};
use crate::compiler::signals::detect_recurring_failure_patterns;
use crate::compiler::snapshot::build_snapshot;
use crate::schema::{
    CandidateAction, CompiledFact, DecisionLogRecord, EvidenceRecord, HaltSignal, Hypothesis,
    MYTHOS_HASH_ALG, SnapshotInput, SourceRef, StateDelta, VerifierFinding, WorkerResult,
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RunManifest {
    pub objective_id: String,
    pub run_id: String,
    pub branch_id: String,
    pub pass_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RunDirCompileReport {
    pub snapshot_path: PathBuf,
    pub packet_path: PathBuf,
    pub decision_log_path: PathBuf,
    pub evidence_count: usize,
    pub verifier_finding_count: usize,
}

pub fn compile_run_dir(run_dir: &Path) -> Result<RunDirCompileReport, Box<dyn std::error::Error>> {
    let manifest = read_json::<RunManifest>(&run_dir.join("manifest.json"))?;
    let objective = fs::read_to_string(run_dir.join("task.md"))?
        .trim()
        .to_string();
    let raw_sources = load_sources(&run_dir.join("raw"), &manifest.created_at)?;
    let worker_evidence =
        read_jsonl::<EvidenceRecord>(&run_dir.join("worker-results/evidence.jsonl"))?;
    let verifier_findings =
        read_jsonl::<VerifierFinding>(&run_dir.join("verifier-results/findings.jsonl"))?;

    verify_declared_file_refs(run_dir, &worker_evidence, &verifier_findings)?;

    let mut sources = raw_sources.clone();
    sources.extend(evidence_declared_sources(&worker_evidence));
    sources.extend(verifier_declared_sources(&verifier_findings));
    sources.extend(evidence_sources(&worker_evidence));
    sources.extend(verifier_sources(&verifier_findings, &manifest.created_at));
    dedupe_sources_strict(&mut sources)?;

    let artifact_refs: Vec<ArtifactRef> = sources.clone();
    let snapshot = build_snapshot(
        manifest.run_id.clone(),
        manifest.pass_id.clone(),
        manifest.branch_id.clone(),
        manifest.created_at.clone(),
        vec![SnapshotInput {
            id: "input:task".to_string(),
            kind: "task".to_string(),
            summary: objective.clone(),
            ref_ids: raw_sources
                .first()
                .map(|source| vec![source.source_id.clone()])
                .unwrap_or_default(),
        }],
        worker_evidence
            .iter()
            .map(|evidence| WorkerResult {
                id: format!("worker:{}", evidence.id),
                worker: "local-evidence-ingest".to_string(),
                status: "ok".to_string(),
                output_ids: evidence.source_ids.clone(),
                notes: evidence.summary.clone(),
            })
            .collect(),
        state_delta_from_evidence(&worker_evidence),
        artifact_refs,
    )?;

    let recurring_patterns =
        detect_recurring_failure_patterns(&verifier_findings, &manifest.created_at);
    let packet = build_next_pass_packet(CompilerInputBundle {
        objective_id: manifest.objective_id.clone(),
        run_id: manifest.run_id.clone(),
        branch_id: manifest.branch_id.clone(),
        pass_id: manifest.pass_id.clone(),
        objective,
        evidence: worker_evidence.clone(),
        trusted_facts: facts_from_evidence(&worker_evidence),
        active_hypotheses: hypotheses_from_failures(&verifier_findings),
        contradictions: vec![],
        recurring_failure_patterns: recurring_patterns,
        candidate_actions: actions_from_failures(&verifier_findings),
        verifier_findings: verifier_findings.clone(),
        open_questions: open_questions_from_failures(&verifier_findings),
        raw_drilldown_refs: raw_sources,
        halt_signals: halt_signals_from_findings(&verifier_findings, &manifest.created_at),
        sources,
    })?;

    let state_dir = run_dir.join("state");
    fs::create_dir_all(&state_dir)?;
    let snapshot_path = state_dir.join("snapshot.json");
    let packet_path = state_dir.join("next_pass_packet.json");
    let decision_log_path = state_dir.join("decision_log.jsonl");

    write_json(&snapshot_path, &snapshot)?;
    write_json(&packet_path, &packet)?;
    append_decision_log(
        &decision_log_path,
        &DecisionLogRecord {
            id: format!("decision:{}:{}", manifest.run_id, manifest.pass_id),
            run_id: manifest.run_id,
            pass_id: manifest.pass_id,
            decision_kind: "compile-next-pass-packet".to_string(),
            summary: "Compiled raw run artifacts into a source-backed next-pass packet."
                .to_string(),
            source_ids: packet
                .sources
                .iter()
                .map(|source| source.source_id.clone())
                .collect(),
            selected_action_ids: packet
                .candidate_actions
                .iter()
                .map(|action| action.id.clone())
                .collect(),
            created_at: manifest.created_at,
            promotion: None,
        },
    )?;

    Ok(RunDirCompileReport {
        snapshot_path,
        packet_path,
        decision_log_path,
        evidence_count: packet.evidence.len(),
        verifier_finding_count: packet.verifier_findings.len(),
    })
}

fn read_json<T>(path: &Path) -> Result<T, Box<dyn std::error::Error>>
where
    T: for<'de> Deserialize<'de>,
{
    let file = File::open(path)?;
    Ok(serde_json::from_reader(file)?)
}

fn write_json<T>(path: &Path, value: &T) -> Result<(), Box<dyn std::error::Error>>
where
    T: Serialize,
{
    let mut file = File::create(path)?;
    serde_json::to_writer_pretty(&mut file, value)?;
    file.write_all(b"\n")?;
    Ok(())
}

fn read_jsonl<T>(path: &Path) -> Result<Vec<T>, Box<dyn std::error::Error>>
where
    T: for<'de> Deserialize<'de>,
{
    if !path.exists() {
        return Ok(vec![]);
    }

    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let mut values = Vec::new();

    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        values.push(serde_json::from_str(&line)?);
    }

    Ok(values)
}

fn load_sources(
    raw_dir: &Path,
    observed_at: &str,
) -> Result<Vec<SourceRef>, Box<dyn std::error::Error>> {
    if !raw_dir.exists() {
        return Ok(vec![]);
    }

    let mut sources = Vec::new();
    collect_raw_sources(raw_dir, raw_dir, observed_at, &mut sources)?;
    sources.sort_by(|left, right| left.source_id.cmp(&right.source_id));
    Ok(sources)
}

fn collect_raw_sources(
    raw_dir: &Path,
    current_dir: &Path,
    observed_at: &str,
    sources: &mut Vec<SourceRef>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Sort entries so traversal order is stable across file systems.
    let mut entries: Vec<_> = fs::read_dir(current_dir)?.collect::<Result<Vec<_>, _>>()?;
    entries.sort_by_key(|entry| entry.file_name());
    for entry in entries {
        let path = entry.path();
        if path.is_dir() {
            collect_raw_sources(raw_dir, &path, observed_at, sources)?;
            continue;
        }
        if path.is_file() {
            let bytes = fs::read(&path)?;
            let source_path = path
                .strip_prefix(raw_dir)?
                .to_string_lossy()
                .replace('\\', "/")
                .to_string();
            sources.push(SourceRef {
                source_id: format!("raw:{source_path}"),
                path: format!("raw/{source_path}"),
                kind: "raw".to_string(),
                hash: fnv1a_hash(&bytes),
                hash_alg: MYTHOS_HASH_ALG.to_string(),
                span: None,
                observed_at: observed_at.to_string(),
            });
        }
    }
    Ok(())
}

fn evidence_sources(evidence: &[EvidenceRecord]) -> Vec<SourceRef> {
    evidence
        .iter()
        .map(|item| SourceRef {
            source_id: format!("evidence:{}", item.id),
            path: "worker-results/evidence.jsonl".to_string(),
            kind: item.kind.clone(),
            hash: fnv1a_hash(item.summary.as_bytes()),
            hash_alg: MYTHOS_HASH_ALG.to_string(),
            span: Some(item.id.clone()),
            observed_at: item.observed_at.clone(),
        })
        .collect()
}

fn evidence_declared_sources(evidence: &[EvidenceRecord]) -> Vec<SourceRef> {
    evidence
        .iter()
        .flat_map(|item| item.source_refs.clone())
        .collect()
}

fn verifier_sources(findings: &[VerifierFinding], observed_at: &str) -> Vec<SourceRef> {
    findings
        .iter()
        .map(|finding| SourceRef {
            source_id: format!("verifier:{}", finding.id),
            path: "verifier-results/findings.jsonl".to_string(),
            kind: "verifier".to_string(),
            hash: fnv1a_hash(finding.summary.as_bytes()),
            hash_alg: MYTHOS_HASH_ALG.to_string(),
            span: Some(finding.id.clone()),
            observed_at: observed_at.to_string(),
        })
        .collect()
}

fn verifier_declared_sources(findings: &[VerifierFinding]) -> Vec<SourceRef> {
    findings
        .iter()
        .flat_map(|finding| finding.source_refs.clone())
        .collect()
}

/// Dedupe packet sources by `source_id`, and fail hard when two refs share an
/// id but disagree on content-hash or hash algorithm. Path and observed_at are
/// treated as non-canonical (tools may report absolute vs relative paths or
/// different ingest timestamps). The first-seen record wins.
fn dedupe_sources_strict(sources: &mut Vec<SourceRef>) -> Result<(), Box<dyn std::error::Error>> {
    sources.sort_by(|left, right| left.source_id.cmp(&right.source_id));

    let mut seen: HashMap<String, SourceRef> = HashMap::new();
    for source in sources.iter() {
        if let Some(prior) = seen.get(&source.source_id) {
            if prior.hash != source.hash || prior.hash_alg != source.hash_alg {
                return Err(format!(
                    "source_id `{}` declared twice with divergent hash: `{}` ({}) vs `{}` ({})",
                    source.source_id, prior.hash, prior.hash_alg, source.hash, source.hash_alg,
                )
                .into());
            }
            continue;
        }
        seen.insert(source.source_id.clone(), source.clone());
    }
    sources.dedup_by(|left, right| left.source_id == right.source_id);
    Ok(())
}

fn verify_declared_file_refs(
    run_dir: &Path,
    evidence: &[EvidenceRecord],
    findings: &[VerifierFinding],
) -> Result<(), Box<dyn std::error::Error>> {
    for record in evidence {
        verify_record_file_refs(run_dir, "evidence", &record.id, &record.source_refs)?;
    }
    for finding in findings {
        verify_record_file_refs(
            run_dir,
            "verifier_finding",
            &finding.id,
            &finding.source_refs,
        )?;
    }
    Ok(())
}

fn verify_record_file_refs(
    run_dir: &Path,
    label: &str,
    id: &str,
    refs: &[SourceRef],
) -> Result<(), Box<dyn std::error::Error>> {
    for source in refs {
        if source.hash_alg != MYTHOS_HASH_ALG {
            return Err(format!(
                "{label} `{id}` source_ref `{}` uses unsupported hash_alg `{}` (expected `{MYTHOS_HASH_ALG}`)",
                source.source_id, source.hash_alg
            )
            .into());
        }
        if source.kind != "file" {
            continue;
        }
        let resolved = resolve_source_path(run_dir, &source.path);
        let bytes = fs::read(&resolved).map_err(|err| {
            format!(
                "{label} `{id}` source_ref `{}` file path not readable: {} ({err})",
                source.source_id,
                resolved.display()
            )
        })?;
        let actual = fnv1a_hash(&bytes);
        if source.hash != actual {
            return Err(format!(
                "{label} `{id}` source_ref `{}` hash mismatch: expected `{actual}`, got `{}`",
                source.source_id, source.hash
            )
            .into());
        }
        verify_line_span(&source.span, &bytes, label, id, &source.source_id)?;
    }
    Ok(())
}

fn verify_line_span(
    span: &Option<String>,
    bytes: &[u8],
    label: &str,
    id: &str,
    source_id: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let Some(span) = span else {
        return Ok(());
    };
    let line_count = std::str::from_utf8(bytes)
        .map(|text| text.lines().count().max(1))
        .unwrap_or(1);
    let (start_str, end_str) = match span.split_once('-') {
        Some((a, b)) => (a, b),
        None => (span.as_str(), span.as_str()),
    };
    let start: usize = start_str.parse().map_err(|_| {
        format!("{label} `{id}` source_ref `{source_id}` span `{span}` is not a line range")
    })?;
    let end: usize = end_str.parse().map_err(|_| {
        format!("{label} `{id}` source_ref `{source_id}` span `{span}` is not a line range")
    })?;
    if start < 1 || end < start || end > line_count {
        return Err(format!(
            "{label} `{id}` source_ref `{source_id}` span `{span}` is outside file line range 1-{line_count}"
        )
        .into());
    }
    Ok(())
}

fn resolve_source_path(run_dir: &Path, source_path: &str) -> PathBuf {
    let candidate = PathBuf::from(source_path);
    if candidate.is_absolute() {
        return candidate;
    }

    // Prefer paths inside run_dir (raw/, worker-results/, verifier-results/).
    let inside_run = run_dir.join(&candidate);
    if inside_run.exists() {
        return inside_run;
    }

    // Fall back to repo-root resolution so file:/test:/command: refs that live
    // outside run_dir (e.g. the source tree) still verify.
    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(parent) = repo_root.parent() {
        let candidate_abs = parent.join(&candidate);
        if candidate_abs.exists() {
            return candidate_abs;
        }
    }
    candidate
}

fn facts_from_evidence(evidence: &[EvidenceRecord]) -> Vec<CompiledFact> {
    evidence
        .iter()
        .map(|item| CompiledFact {
            id: format!("fact:{}", item.id),
            statement: item.summary.clone(),
            confidence: 0.7,
            objective_relevance: 0.8,
            novelty_gain: 0.3,
            needs_raw_drilldown: false,
            source_ids: item.source_ids.clone(),
        })
        .collect()
}

fn hypotheses_from_failures(findings: &[VerifierFinding]) -> Vec<Hypothesis> {
    findings
        .iter()
        .filter(|finding| finding.status != "passed")
        .map(|finding| Hypothesis {
            id: format!("hypothesis:{}", finding.id),
            statement: format!("Resolve verifier finding: {}", finding.summary),
            confidence: 0.6,
            verifier_score: Some(finding.verifier_score),
            source_ids: finding.source_ids.clone(),
        })
        .collect()
}

fn actions_from_failures(findings: &[VerifierFinding]) -> Vec<CandidateAction> {
    findings
        .iter()
        .filter(|finding| finding.status != "passed")
        .map(|finding| CandidateAction {
            id: format!("action:{}", finding.id),
            title: format!("Fix {}", finding.summary),
            rationale: "Verifier finding is not passing and needs a concrete next action."
                .to_string(),
            actionability_score: 0.8,
            decision_dependency_ids: vec![finding.id.clone()],
            source_ids: finding.source_ids.clone(),
        })
        .collect()
}

fn open_questions_from_failures(findings: &[VerifierFinding]) -> Vec<String> {
    findings
        .iter()
        .filter(|finding| finding.status != "passed")
        .map(|finding| format!("What concrete change resolves `{}`?", finding.summary))
        .collect()
}

fn halt_signals_from_findings(findings: &[VerifierFinding], created_at: &str) -> Vec<HaltSignal> {
    let failed: Vec<&VerifierFinding> = findings
        .iter()
        .filter(|finding| finding.status != "passed")
        .collect();

    if failed.is_empty() {
        return vec![HaltSignal {
            id: format!("halt:{created_at}:ready"),
            kind: "ready-to-halt".to_string(),
            contribution: 1.0,
            rationale: "All verifier findings are passing.".to_string(),
            source_ids: dedupe_source_ids(
                findings
                    .iter()
                    .flat_map(|finding| finding.source_ids.clone()),
            ),
        }];
    }

    vec![HaltSignal {
        id: format!("halt:{created_at}:continue"),
        kind: "continue".to_string(),
        contribution: 1.0,
        rationale: format!(
            "{} verifier finding(s) are still not passing.",
            failed.len()
        ),
        source_ids: dedupe_source_ids(failed.iter().flat_map(|finding| finding.source_ids.clone())),
    }]
}

fn state_delta_from_evidence(evidence: &[EvidenceRecord]) -> Vec<StateDelta> {
    evidence
        .iter()
        .map(|item| StateDelta {
            id: format!("delta:{}", item.id),
            kind: "evidence-observed".to_string(),
            target_id: item.id.clone(),
            summary: item.summary.clone(),
        })
        .collect()
}

/// Preserve the original lossy `dedupe_sources` for internal compatibility.
/// `compile_run_dir` uses `dedupe_sources_strict` instead so the compiler fails
/// fast on divergent hashes, but library consumers that construct packets
/// manually can still opt into the soft behavior.
#[allow(dead_code)]
fn dedupe_sources(sources: &mut Vec<SourceRef>) {
    sources.sort_by(|left, right| left.source_id.cmp(&right.source_id));
    sources.dedup_by(|left, right| left.source_id == right.source_id);
}

fn dedupe_source_ids(source_ids: impl IntoIterator<Item = String>) -> Vec<String> {
    let mut set: BTreeSet<String> = BTreeSet::new();
    let mut out = Vec::new();
    for id in source_ids {
        if set.insert(id.clone()) {
            out.push(id);
        }
    }
    out
}

fn fnv1a_hash(bytes: &[u8]) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

#[cfg(test)]
mod tests {
    use super::compile_run_dir;
    use crate::schema::{MYTHOS_HASH_ALG, MYTHOS_SCHEMA_VERSION, NextPassPacket};
    use std::fs;

    #[test]
    fn compiles_fixture_run_dir() {
        let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        let run_dir = repo_root.join("tests/fixtures/run-basic");
        let state_dir = run_dir.join("state");
        let _ = fs::remove_dir_all(&state_dir);

        let report = compile_run_dir(&run_dir).expect("compile fixture");

        assert!(report.snapshot_path.exists());
        assert!(report.packet_path.exists());
        assert!(report.decision_log_path.exists());
        assert_eq!(report.evidence_count, 2);
        assert_eq!(report.verifier_finding_count, 2);

        let packet_json = fs::read_to_string(&report.packet_path).expect("read packet");
        assert!(packet_json.contains("\"evidence\""));
        assert!(packet_json.contains("\"halt_signals\""));

        let packet: NextPassPacket =
            serde_json::from_str(&packet_json).expect("packet is valid NextPassPacket");
        assert_eq!(packet.schema_version, MYTHOS_SCHEMA_VERSION);
        assert!(!packet.sources.is_empty(), "packet must include sources");

        for source in &packet.sources {
            assert_eq!(source.hash_alg, MYTHOS_HASH_ALG);
            assert_eq!(
                source.hash.len(),
                16,
                "hash must be 16-char fnv1a-64 digest"
            );
            assert!(
                source.hash.chars().all(|ch| ch.is_ascii_hexdigit()),
                "hash must be hex",
            );
            if source.kind == "raw" {
                assert!(
                    !source.path.contains('\\'),
                    "raw path `{}` leaked backslashes",
                    source.path,
                );
                assert!(
                    !source.path.starts_with('/') && !source.path.contains(':'),
                    "raw path `{}` leaked absolute/drive-letter prefix",
                    source.path,
                );
                assert!(
                    source.path.starts_with("raw/"),
                    "raw path `{}` must start with `raw/`",
                    source.path,
                );
                assert_eq!(
                    source.observed_at, "2026-04-21T00:00:00Z",
                    "raw observed_at must anchor to manifest.created_at, not placeholder literals",
                );
            }
        }

        let _ = fs::remove_dir_all(&state_dir);
    }

    #[test]
    fn compile_detects_tampered_declared_file_ref() {
        let tmp = std::env::temp_dir().join("mythos-compile-tamper");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(tmp.join("raw")).unwrap();
        fs::create_dir_all(tmp.join("worker-results")).unwrap();
        fs::create_dir_all(tmp.join("verifier-results")).unwrap();

        fs::write(
            tmp.join("manifest.json"),
            serde_json::json!({
                "objective_id": "obj-tamper",
                "run_id": "run-tamper",
                "branch_id": "main",
                "pass_id": "pass-0001",
                "created_at": "2026-04-21T00:00:00Z"
            })
            .to_string(),
        )
        .unwrap();
        fs::write(tmp.join("task.md"), "Tamper detection task").unwrap();

        let target_rel = "tamper-target.md";
        fs::write(tmp.join(target_rel), "real content\n").unwrap();
        // Deliberately write the wrong hash to simulate a forged declared ref.
        let evidence = serde_json::json!({
            "id": "ev-tampered",
            "kind": "root-cause",
            "summary": "hash must match file contents",
            "source_ids": [format!("file:{target_rel}"), "raw:objective.md"],
            "source_refs": [{
                "source_id": format!("file:{target_rel}"),
                "path": target_rel,
                "kind": "file",
                "hash": "deadbeefdeadbeef",
                "hash_alg": "fnv1a-64",
                "span": "1",
                "observed_at": "2026-04-21T00:00:00Z"
            }],
            "observed_at": "2026-04-21T00:00:00Z"
        });
        fs::write(
            tmp.join("raw/objective.md"),
            "# Objective\nTamper detection objective\n",
        )
        .unwrap();
        fs::write(
            tmp.join("worker-results/evidence.jsonl"),
            format!("{}\n", evidence),
        )
        .unwrap();
        fs::write(tmp.join("verifier-results/findings.jsonl"), "").unwrap();

        let err = compile_run_dir(&tmp).expect_err("tampered hash must fail compile");
        let msg = format!("{err}");
        assert!(
            msg.contains("hash mismatch"),
            "expected hash mismatch error, got: {msg}",
        );

        let _ = fs::remove_dir_all(&tmp);
    }
}
