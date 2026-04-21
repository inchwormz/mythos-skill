#!/usr/bin/env node
// Post-install hint: verify the `mythos` Rust binary is on PATH and print
// clear instructions if it's missing. We do NOT fail install on its absence —
// users may only want `ready` / `ingest` / `gate` (Node-only subset).
import { spawnSync } from "node:child_process";

const probe = spawnSync(process.platform === "win32" ? "where" : "which", ["mythos"], {
  stdio: "pipe",
  encoding: "utf8",
});

if (probe.status === 0) {
  const version = spawnSync("mythos", ["--version"], { stdio: "pipe", encoding: "utf8" });
  const v = version.status === 0 ? version.stdout.trim() : "mythos (installed)";
  process.stdout.write(`mythos-skill: Rust compiler detected: ${v}\n`);
  process.stdout.write(`mythos-skill: run \`mythos-skill ready\` to verify the pipeline.\n`);
} else {
  process.stdout.write(
    `mythos-skill: the Rust compiler \`mythos\` is NOT on PATH.\n` +
      `              Install it with:  cargo install mythos-skill\n` +
      `              Without it, \`mythos-skill compile\` will not work; \`ingest\`/\`gate\` remain usable.\n`
  );
}
