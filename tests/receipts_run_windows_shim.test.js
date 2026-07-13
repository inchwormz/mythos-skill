import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const compilerDir = path.join(repoRoot, "receipts-compiler");

test("PowerShell npm-style shim mints through --exe and repeated --arg", { skip: process.platform !== "win32" }, (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "receipts-ps-shim-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const targetDir = path.join(root, "target");
  const build = spawnSync("cargo", ["build", "--quiet", "--bin", "receipts-core"], {
    cwd: compilerDir,
    encoding: "utf8",
    env: { ...process.env, CARGO_TARGET_DIR: targetDir },
  });
  assert.equal(build.status, 0, `build stderr=${build.stderr}`);
  const core = path.join(targetDir, "debug", "receipts-core.exe");
  const runDir = path.join(root, "run");
  const init = spawnSync(core, ["init", runDir, "--repo-root", repoRoot], { encoding: "utf8" });
  assert.equal(init.status, 0, `init stderr=${init.stderr}`);

  const shim = path.join(root, "receipts.ps1");
  fs.writeFileSync(
    shim,
    `& node.exe '${path.join(repoRoot, "bin", "receipts.mjs").replaceAll("'", "''")}' @args\nexit $LASTEXITCODE\n`,
    "utf8",
  );
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", shim,
      "run", "--run-dir", runDir, "--label", "test:ps-exe",
      "--exe", "node", "--arg", "-e", "--arg", "process.exit(0)",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${path.dirname(core)}${path.delimiter}${process.env.PATH}` },
    },
  );
  assert.equal(result.status, 0, `stdout=${result.stdout}\nstderr=${result.stderr}`);
  const receipts = fs.readFileSync(path.join(runDir, "receipts", "receipts.jsonl"), "utf8");
  const row = JSON.parse(receipts.trim().split(/\r?\n/).at(-1));
  assert.deepEqual(row.cmd, ["node", "-e", "process.exit(0)"]);
});
