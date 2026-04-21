use serde::{Deserialize, Serialize};

/// Current Mythos packet schema version. Bump when the `NextPassPacket` or
/// `Snapshot` shape changes in a way downstream consumers must react to.
pub const MYTHOS_SCHEMA_VERSION: &str = "1.1.0";

/// Canonical hash algorithm label emitted for every `SourceRef.hash` value.
/// The strict gate and ingester must reject source refs whose `hash_alg` does
/// not match, so bumping this is a breaking change for evidence in flight.
pub const MYTHOS_HASH_ALG: &str = "fnv1a-64";

fn default_hash_alg() -> String {
    MYTHOS_HASH_ALG.to_string()
}

fn default_schema_version() -> String {
    MYTHOS_SCHEMA_VERSION.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SourceRef {
    pub source_id: String,
    pub path: String,
    pub kind: String,
    pub hash: String,
    #[serde(default = "default_hash_alg")]
    pub hash_alg: String,
    pub span: Option<String>,
    pub observed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CompiledFact {
    pub id: String,
    pub statement: String,
    pub confidence: f32,
    pub objective_relevance: f32,
    pub novelty_gain: f32,
    pub needs_raw_drilldown: bool,
    pub source_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceRecord {
    pub id: String,
    pub kind: String,
    pub summary: String,
    pub source_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_refs: Vec<SourceRef>,
    pub observed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Hypothesis {
    pub id: String,
    pub statement: String,
    pub confidence: f32,
    pub verifier_score: Option<f32>,
    pub source_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Contradiction {
    pub id: String,
    pub summary: String,
    pub conflicting_item_ids: Vec<String>,
    pub severity: String,
    pub source_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecurringFailurePattern {
    pub id: String,
    pub summary: String,
    pub count: u32,
    pub last_seen_at: String,
    pub impact: String,
    pub source_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CandidateAction {
    pub id: String,
    pub title: String,
    pub rationale: String,
    pub actionability_score: f32,
    pub decision_dependency_ids: Vec<String>,
    pub source_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct VerifierFinding {
    pub id: String,
    pub summary: String,
    pub status: String,
    pub verifier_score: f32,
    pub source_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_refs: Vec<SourceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct HaltSignal {
    pub id: String,
    pub kind: String,
    pub contribution: f32,
    pub rationale: String,
    pub source_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct NextPassPacket {
    #[serde(default = "default_schema_version")]
    pub schema_version: String,
    pub objective_id: String,
    pub run_id: String,
    pub branch_id: String,
    pub pass_id: String,
    pub objective: String,
    pub evidence: Vec<EvidenceRecord>,
    pub trusted_facts: Vec<CompiledFact>,
    pub active_hypotheses: Vec<Hypothesis>,
    pub contradictions: Vec<Contradiction>,
    pub recurring_failure_patterns: Vec<RecurringFailurePattern>,
    pub candidate_actions: Vec<CandidateAction>,
    pub verifier_findings: Vec<VerifierFinding>,
    pub open_questions: Vec<String>,
    pub raw_drilldown_refs: Vec<SourceRef>,
    pub halt_signals: Vec<HaltSignal>,
    pub sources: Vec<SourceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SnapshotInput {
    pub id: String,
    pub kind: String,
    pub summary: String,
    pub ref_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkerResult {
    pub id: String,
    pub worker: String,
    pub status: String,
    pub output_ids: Vec<String>,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StateDelta {
    pub id: String,
    pub kind: String,
    pub target_id: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Snapshot {
    #[serde(default = "default_schema_version")]
    pub schema_version: String,
    pub run_id: String,
    pub pass_id: String,
    pub branch_id: String,
    pub created_at: String,
    pub inputs: Vec<SnapshotInput>,
    pub worker_results: Vec<WorkerResult>,
    pub state_delta: Vec<StateDelta>,
    pub artifact_refs: Vec<SourceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PromotionRecord {
    pub id: String,
    pub kind: String,
    pub source_ids: Vec<String>,
    pub decision: String,
    pub reason: String,
    pub expires_after_pass: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DecisionLogRecord {
    pub id: String,
    pub run_id: String,
    pub pass_id: String,
    pub decision_kind: String,
    pub summary: String,
    pub source_ids: Vec<String>,
    pub selected_action_ids: Vec<String>,
    pub created_at: String,
    pub promotion: Option<PromotionRecord>,
}
