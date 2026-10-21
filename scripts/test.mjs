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
const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", ...tests],
  { cwd: root, stdio: "inherit", windowsHide: true });
process.exitCode = result.status ?? 1;
