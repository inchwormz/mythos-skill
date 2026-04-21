use mythos_skill::compiler::run_dir::compile_run_dir;
use std::path::PathBuf;

fn main() {
    if let Err(error) = run() {
        eprintln!("mythos: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let command = args.next().ok_or("missing command: expected `compile`")?;

    match command.as_str() {
        "compile" => {
            let run_dir = parse_run_dir(args.collect())?;
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
        other => Err(format!("unknown command `{other}`").into()),
    }
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
    Err("missing required `--run-dir <path>`".into())
}
