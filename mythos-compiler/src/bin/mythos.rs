use mythos_skill::compiler::run_dir::compile_run_dir;
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
            let dir = parse_path_arg(args.collect(), "init")?;
            init_run_dir(&dir)
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
        other => Err(format!("unknown command `{other}` — try `mythos --help`").into()),
    }
}

fn print_help() {
    println!(
        "mythos {VERSION} — deterministic packet compiler for AI agent runs

USAGE:
    mythos <COMMAND> [ARGS]

COMMANDS:
    init <dir>              Scaffold a minimal run directory (manifest, task, empty input dirs)
    compile --run-dir <dir> Compile a run directory into state/next_pass_packet.json
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
    args.into_iter()
        .find(|a| !a.starts_with("--"))
        .map(PathBuf::from)
        .ok_or_else(|| {
            format!("`{cmd}` requires a directory path — try `mythos {cmd} my-run`").into()
        })
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

fn init_run_dir(dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
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
        "{{\n  \"run_id\": \"{}\",\n  \"objective_id\": \"obj-{}\",\n  \"objective\": \"{}\",\n  \"branch_id\": \"main\",\n  \"pass_id\": \"pass-0001\",\n  \"created_at\": \"{}\"\n}}\n",
        run_id,
        chrono_like_stamp(),
        objective.replace('"', "\\\""),
        iso_now()
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

    let seed_finding = format!(
        "{{\"id\":\"vf-synthesis-pending\",\"summary\":\"Synthesis has not consumed this packet yet\",\"status\":\"pending\",\"verifier_score\":0.0,\"source_ids\":[\"raw:objective.md\"]}}\n"
    );
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
