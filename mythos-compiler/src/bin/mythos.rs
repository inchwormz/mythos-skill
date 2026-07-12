use mythos_skill::compiler::receipts::{append_receipt, git_tree_state, store_artifact};
use mythos_skill::compiler::report::generate_report;
use mythos_skill::compiler::run_dir::compile_run_dir;
use mythos_skill::schema::ReceiptRecord;
use std::fs;
use std::path::{Path, PathBuf};

const VERSION: &str = env!("CARGO_PKG_VERSION");

fn main() {
    if let Err(error) = run() {
        eprintln!("mythos: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let command = match args.next() {
        Some(c) => c,
        None => {
            print_help();
            return Ok(());
        }
    };

    match command.as_str() {
        "--help" | "-h" | "help" => {
            print_help();
            Ok(())
        }
        "--version" | "-V" | "version" => {
            println!("mythos {VERSION}");
            Ok(())
        }
        "init" => {
            let rest: Vec<String> = args.collect();
            let dir = parse_path_arg(rest.clone(), "init")?;
            let repo_root = parse_flag_value(&rest, "--repo-root")
                .map(PathBuf::from)
                .unwrap_or(std::env::current_dir()?);
            init_run_dir(&dir, &repo_root)
        }
        "run" => {
            let rest: Vec<String> = args.collect();
            run_with_receipt(rest)
        }
        "compile" => {
            let run_dir = parse_run_dir(args.collect())?;
            preflight_run_dir(&run_dir)?;
            let report = compile_run_dir(&run_dir)?;
            println!(
                "compiled run_dir={} snapshot={} packet={} decisions={} evidence={} verifier_findings={}",
                run_dir.display(),
                report.snapshot_path.display(),
                report.packet_path.display(),
                report.decision_log_path.display(),
                report.evidence_count,
                report.verifier_finding_count
            );
            Ok(())
        }
        "report" => {
            let run_dir = parse_run_dir(args.collect())?;
            preflight_run_dir(&run_dir)?;
            let report_path = generate_report(&run_dir)?;
            println!("report written: {}", report_path.display());
            Ok(())
        }
        other => Err(format!("unknown command `{other}` — try `mythos --help`").into()),
    }
}

fn print_help() {
    println!(
        "mythos {VERSION} — deterministic packet compiler for AI agent runs

USAGE:
    mythos <COMMAND> [ARGS]

COMMANDS:
    init <dir> [--repo-root <path>]   Scaffold a run directory (repo_root defaults to cwd)
    run --run-dir <dir> [--lane L] [--agent-id A] [--label test:name] -- <command...>
                            Execute a command and mint a tamper-evident execution
                            receipt in receipts/receipts.jsonl (exit code = child's)
    compile --run-dir <dir> Compile a run directory into state/next_pass_packet.json
    report --run-dir <dir>  Render a human-readable state/report.html for the run
    --version, -V           Print version
    --help, -h              Print this help

A run directory contains:
    manifest.json                   run identity (id, objective, created_at)
    task.md                         human-readable objective
    raw/                            quarantined raw subagent artifacts
    worker-results/evidence.jsonl   fenced evidence records (one JSON per line)
    verifier-results/findings.jsonl fenced verifier records (one JSON per line)

After compile, state/ holds next_pass_packet.json, snapshot.json, decision_log.jsonl.

See https://github.com/inchwormz/mythos-skill for the JS runtime (ingest, gate, readiness)."
    );
}

fn parse_run_dir(args: Vec<String>) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut iter = args.into_iter();
    while let Some(arg) = iter.next() {
        if arg == "--run-dir" {
            return iter
                .next()
                .map(PathBuf::from)
                .ok_or_else(|| "`--run-dir` requires a path".into());
        }
    }
    Err("missing required `--run-dir <path>` — run `mythos --help` for usage".into())
}

fn parse_path_arg(args: Vec<String>, cmd: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut skip_next = false;
    for arg in args {
        if skip_next {
            skip_next = false;
            continue;
        }
        if arg.starts_with("--") {
            skip_next = true; // flags in init take a value
            continue;
        }
        return Ok(PathBuf::from(arg));
    }
    Err(format!("`{cmd}` requires a directory path — try `mythos {cmd} my-run`").into())
}

fn parse_flag_value(args: &[String], flag: &str) -> Option<String> {
    let index = args.iter().position(|arg| arg == flag)?;
    args.get(index + 1).cloned()
}

/// M1: execute a command and mint an execution receipt the agent cannot
/// author. Exits with the CHILD's exit code so orchestrator scripting sees
/// reality; the receipt is minted either way.
fn run_with_receipt(args: Vec<String>) -> Result<(), Box<dyn std::error::Error>> {
    let separator = args
        .iter()
        .position(|arg| arg == "--")
        .ok_or("`run` usage: mythos run --run-dir <dir> [--lane L] [--agent-id A] [--label test:name] -- <command...>")?;
    let (flags, command_line) = args.split_at(separator);
    let command_line = &command_line[1..];
    if command_line.is_empty() {
        return Err("`run` requires a command after `--`".into());
    }
    let flags: Vec<String> = flags.to_vec();
    let run_dir = PathBuf::from(
        parse_flag_value(&flags, "--run-dir").ok_or("`run` requires --run-dir <dir>")?,
    );
    preflight_run_dir(&run_dir)?;
    let lane = parse_flag_value(&flags, "--lane");
    let agent_id = parse_flag_value(&flags, "--agent-id");
    let label = parse_flag_value(&flags, "--label");

    let repo_root: Option<String> = fs::read_to_string(run_dir.join("manifest.json"))
        .ok()
        .and_then(|text| serde_json::from_str::<serde_json::Value>(&text).ok())
        .and_then(|value| value["repo_root"].as_str().map(str::to_string));

    let cwd = std::env::current_dir()?;
    let tree_before = git_tree_state(repo_root.as_deref());
    let started_at = iso_now();
    let start = std::time::Instant::now();
    let output = std::process::Command::new(&command_line[0])
        .args(&command_line[1..])
        .current_dir(&cwd)
        .output()
        .map_err(|err| {
            format!(
                "failed to launch `{}`: {err}. Note: shell builtins and .cmd scripts need an explicit shell, e.g. mythos run ... -- bash -lc \"<line>\"",
                command_line[0]
            )
        })?;
    let duration_ms = start.elapsed().as_millis() as u64;
    let ended_at = iso_now();
    let tree_after = git_tree_state(repo_root.as_deref());
    let exit_code = i64::from(output.status.code().unwrap_or(-1));

    let (stdout_hash, stdout_artifact) = store_artifact(&run_dir, &output.stdout)?;
    let (stderr_hash, stderr_artifact) = store_artifact(&run_dir, &output.stderr)?;
    let tail = |bytes: &[u8]| -> String {
        let text = String::from_utf8_lossy(bytes);
        let chars: Vec<char> = text.chars().collect();
        let start = chars.len().saturating_sub(2000);
        chars[start..].iter().collect()
    };

    let record = append_receipt(
        &run_dir,
        ReceiptRecord {
            id: String::new(),
            label,
            cmd: command_line.to_vec(),
            cwd: cwd.to_string_lossy().to_string(),
            exit_code,
            duration_ms,
            started_at,
            ended_at,
            stdout_hash,
            stderr_hash,
            stdout_tail: tail(&output.stdout),
            stderr_tail: tail(&output.stderr),
            tree_before,
            tree_after,
            lane,
            agent_id,
            writer: format!("mythos/{VERSION}"),
            prev_record_hash: String::new(),
            record_hash: String::new(),
        },
    )?;

    println!(
        "{}",
        serde_json::json!({
            "ok": true,
            "receipt": record.id,
            "record_hash": record.record_hash,
            "label": record.label,
            "exit_code": exit_code,
            "duration_ms": duration_ms,
            "stdout_artifact": stdout_artifact,
            "stderr_artifact": stderr_artifact,
            "cite_as": format!("receipt:{}", record.id),
        })
    );
    std::process::exit(exit_code as i32);
}

fn preflight_run_dir(run_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if !run_dir.exists() {
        return Err(format!(
            "run directory `{}` does not exist — scaffold one with `mythos init {}`",
            run_dir.display(),
            run_dir.display()
        )
        .into());
    }
    let manifest = run_dir.join("manifest.json");
    if !manifest.exists() {
        return Err(format!(
            "`{}` is missing manifest.json — scaffold a valid run dir with `mythos init {}`",
            run_dir.display(),
            run_dir.display()
        )
        .into());
    }
    Ok(())
}

fn init_run_dir(dir: &Path, repo_root: &Path) -> Result<(), Box<dyn std::error::Error>> {
    if dir.exists() && fs::read_dir(dir)?.next().is_some() {
        return Err(format!(
            "`{}` exists and is not empty — refusing to overwrite. Pick a new path.",
            dir.display()
        )
        .into());
    }

    fs::create_dir_all(dir.join("raw"))?;
    fs::create_dir_all(dir.join("worker-results"))?;
    fs::create_dir_all(dir.join("verifier-results"))?;

    let run_id = format!("run-{}", chrono_like_stamp());
    let objective = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("new-run")
        .to_string();

    let manifest = format!(
        "{{\n  \"run_id\": \"{}\",\n  \"objective_id\": \"obj-{}\",\n  \"objective\": \"{}\",\n  \"branch_id\": \"main\",\n  \"pass_id\": \"pass-0001\",\n  \"created_at\": \"{}\",\n  \"repo_root\": {}\n}}\n",
        run_id,
        chrono_like_stamp(),
        objective.replace('"', "\\\""),
        iso_now(),
        json_escape_string(&repo_root.to_string_lossy())
    );
    fs::write(dir.join("manifest.json"), manifest)?;

    let task = format!(
        "# {}\n\nDescribe the objective of this run here.\n",
        objective
    );
    fs::write(dir.join("task.md"), task)?;

    let objective_md = format!(
        "# Objective\n\n{}\n\n# Note\n\nThis run was scaffolded by `mythos init`. Ingest subagent output with `mythos-skill ingest` or append evidence directly to worker-results/evidence.jsonl.\n",
        objective
    );
    fs::write(dir.join("raw/objective.md"), objective_md)?;

    let now = iso_now();
    let seed_evidence = format!(
        "{{\"id\":\"ev-objective\",\"kind\":\"objective\",\"summary\":{},\"source_ids\":[\"raw:objective.md\"],\"observed_at\":\"{}\"}}\n",
        json_escape_string(&objective),
        now
    );
    fs::write(dir.join("worker-results/evidence.jsonl"), seed_evidence)?;

    // F5: this id MUST match what the synthesis recorder consumes
    // (`vf-codex-synthesis-pending`) — the Rust and JS halves shipping
    // different ids made every Rust-scaffolded run permanently gate-red.
    let seed_finding = "{\"id\":\"vf-codex-synthesis-pending\",\"summary\":\"Codex synthesis has not consumed this packet yet\",\"status\":\"pending\",\"verifier_score\":0.0,\"source_ids\":[\"raw:objective.md\"],\"finding_kind\":\"synthesis\"}\n".to_string();
    fs::write(dir.join("verifier-results/findings.jsonl"), seed_finding)?;

    println!(
        "scaffolded run directory: {}\n\
         next steps:\n\
           1. append evidence records to {}/worker-results/evidence.jsonl\n\
           2. append verifier records to {}/verifier-results/findings.jsonl\n\
           3. run `mythos compile --run-dir {}`\n\
         \n\
         for the full subagent ingest + strict gate flow, install the JS runtime:\n\
           git clone https://github.com/inchwormz/mythos-skill && cd mythos-skill && npm run ready",
        dir.display(),
        dir.display(),
        dir.display(),
        dir.display()
    );
    Ok(())
}

fn json_escape_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn iso_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (year, month, day, hour, min, sec) = unix_to_utc(secs);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn chrono_like_stamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let (year, month, day, hour, min, sec) = unix_to_utc(secs);
    format!(
        "{:04}{:02}{:02}T{:02}{:02}{:02}Z",
        year, month, day, hour, min, sec
    )
}

// Minimal inline UTC conversion to avoid adding a `chrono` dependency.
fn unix_to_utc(mut secs: u64) -> (i32, u32, u32, u32, u32, u32) {
    let sec = (secs % 60) as u32;
    secs /= 60;
    let min = (secs % 60) as u32;
    secs /= 60;
    let hour = (secs % 24) as u32;
    let days = secs / 24;

    // Days since 1970-01-01 → civil date. Howard Hinnant's chrono algorithm.
    let z = days as i64 + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32, hour, min, sec)
}
