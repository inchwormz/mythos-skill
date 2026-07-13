import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

for (const spelling of ["--help", "-h", "help"]) {
  test(`receipts compile ${spelling} prints help without creating a run`, (t) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "receipts-compile-help-"));
    t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
    const result = spawnSync(process.execPath, [path.join(repoRoot, "bin/receipts.mjs"), "compile", spelling], {
      cwd,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `stderr=${result.stderr}`);
    assert.match(result.stdout, /USAGE:|Usage:/);
    assert.equal(fs.existsSync(path.join(cwd, ".receipts")), false);
  });
}
