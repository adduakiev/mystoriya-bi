import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) throw Error("Use Node >=22.13");
const tests = [];
function collect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["runtime", "node_modules"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(file);
    else if (entry.name.endsWith(".test.mjs")) tests.push(file);
  }
}
for (const dir of [".agents", "web/tests"]) collect(path.join(root, dir));
// Vercel build environments do not provide a disposable PostgreSQL server.
// Keep native PostgreSQL acceptance mandatory in GitHub Actions; only the
// Vercel preview build excludes these DB integration tests from prebuild.
const vercelPreview = process.env.VERCEL === "1" && process.env.GITHUB_ACTIONS !== "true";
if (vercelPreview) {
  const pgTests = tests.filter(file => /-postgres\.test\.mjs$/.test(path.basename(file)));
  if (pgTests.length === 0) throw Error("Expected PostgreSQL integration tests missing; refusing preview-only filter");
  for (const file of pgTests) tests.splice(tests.indexOf(file), 1);
  console.log(`Vercel prebuild: ${pgTests.length} native PostgreSQL integration test files deferred to mandatory GitHub Actions full check`);
}
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...tests],
  { cwd: root, stdio: "inherit", windowsHide: true });
process.exitCode = result.status ?? 1;
