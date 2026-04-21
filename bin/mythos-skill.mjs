#!/usr/bin/env node
// mythos-skill CLI — Node wrapper around the Rust `mythos` binary plus the
// JS pipeline (ingest, strict-gate, readiness). This is what an npm-installed
// user actually interacts with.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

const COMMANDS = {
  init: { script: null, description: "Scaffold a minimal run directory (delegates to mythos binary)" },
  compile: { script: "driver.mjs", description: "Compile a run directory into state/next_pass_packet.json" },
  ingest: { script: "scripts/ingest-subagent.mjs", description: "Ingest a subagent markdown file into evidence/findings JSONL" },
  gate: { script: "scripts/strict-gate.mjs", description: "Verify a run dir passes the strict quality gate" },
  ready: { script: "scripts/readiness.mjs", description: "Run the end-to-end readiness fixture" },
  help: { script: null, description: "Print this help" },
  version: { script: null, description: "Print the mythos-skill version" },
};

function printHelp() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  process.stdout.write(
    `mythos-skill ${pkg.version} — explicit-state recurrent synthesis for AI agent runs\n\n` +
      `USAGE:\n    mythos-skill <COMMAND> [ARGS]\n\n` +
      `COMMANDS:\n` +
      Object.entries(COMMANDS)
        .map(([name, info]) => `    ${name.padEnd(10)}  ${info.description}`)
        .join("\n") +
      `\n\n` +
      `EXAMPLES:\n` +
      `    mythos-skill ready                         # confirm the pipeline works end-to-end\n` +
      `    mythos-skill init my-run                   # scaffold a fresh run directory\n` +
      `    mythos-skill compile --run-dir my-run      # compile a run\n` +
      `    mythos-skill ingest --run-dir my-run --lane L1 --agent-id a --from agent.md\n` +
      `    mythos-skill gate --run-dir my-run\n\n` +
      `The Rust compiler binary \`mythos\` is required for compile. Install it with\n` +
      `\`cargo install mythos-skill\` if it is not on PATH.\n`
  );
}

function which(cmd) {
  const probe = spawnSync(process.platform === "win32" ? "where" : "which", [cmd], {
    stdio: "pipe",
    encoding: "utf8",
  });
  return probe.status === 0 ? probe.stdout.split(/\r?\n/)[0].trim() : null;
}

function run(command, args) {
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return 0;
    case "version":
    case "--version":
    case "-V": {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
      process.stdout.write(`mythos-skill ${pkg.version}\n`);
      return 0;
    }
    case "init": {
      const mythos = which("mythos");
      if (!mythos) {
        process.stderr.write(
          "mythos-skill: the `mythos` binary is not on PATH.\n" +
            "Install it with: cargo install mythos-skill\n"
        );
        return 127;
      }
      const r = spawnSync(mythos, ["init", ...args], { stdio: "inherit" });
      return r.status ?? 1;
    }
  }

  const info = COMMANDS[command];
  if (!info || !info.script) {
    process.stderr.write(`mythos-skill: unknown command \`${command}\` — try \`mythos-skill help\`\n`);
    return 2;
  }
  const scriptPath = path.join(root, info.script);
  if (!fs.existsSync(scriptPath)) {
    process.stderr.write(`mythos-skill: missing ${info.script} — is this package installed correctly?\n`);
    return 1;
  }
  const r = spawnSync(process.execPath, [scriptPath, ...args], { stdio: "inherit" });
  return r.status ?? 1;
}

const [, , command = "help", ...rest] = process.argv;
process.exit(run(command, rest));
