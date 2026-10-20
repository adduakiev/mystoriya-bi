import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const [cwd, args] of [
  [root, ["scripts/test.mjs"]],
  [path.join(root, "web"), ["node_modules/typescript/bin/tsc", "--noEmit"]],
  [path.join(root, "web"), ["node_modules/next/dist/bin/next", "build"]]
]) {
  const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
