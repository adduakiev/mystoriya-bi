import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, cpSync, symlinkSync, rmSync, openSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const web = fileURLToPath(new URL("../", import.meta.url));
// Execute the real transport in a server harness, with only Next's boundary marker
// and cache replaced. The separate Next build below enforces the real client guard.
register(`data:text/javascript,${encodeURIComponent(`
  export function resolve(specifier, context, nextResolve) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "next/cache")
      return { url: "data:text/javascript,export const unstable_cache = fn => fn;", shortCircuit: true };
    return nextResolve(specifier, context);
  }
`)}`, import.meta.url);
const source = await import("../lib/data/source.ts");

const secret = "sb_secret_issue25_test_only";
const legacy = "eyJ.test-service-role.signature";
const password = "issue25-test-password";
const anon = readFileSync(path.join(web, "lib/data/source.ts"), "utf8")
  .match(/const BI_SUPABASE_ANON_KEY =\s*"([^"]+)"/)[1];

function configure(t, env = {}) {
  for (const name of ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "BI_ACCESS_PASSWORD"]) {
    const previous = process.env[name];
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
    if (env[name] === undefined) delete process.env[name];
    else process.env[name] = env[name];
  }
}

for (const scenario of [
  { name: "secret wins over legacy", env: { SUPABASE_SECRET_KEY: secret, SUPABASE_SERVICE_ROLE_KEY: legacy }, mode: "secret", key: secret },
  { name: "legacy service role", env: { SUPABASE_SERVICE_ROLE_KEY: legacy }, mode: "legacy-service-role", key: legacy },
  { name: "unconfigured production stays on anon", env: {}, mode: "anon-fallback", key: anon },
  { name: "empty configuration stays on anon", env: { SUPABASE_SECRET_KEY: " ", SUPABASE_SERVICE_ROLE_KEY: "" }, mode: "anon-fallback", key: anon },
  { name: "blank secret permits legacy fallback", env: { SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: legacy }, mode: "legacy-service-role", key: legacy }
]) {
  test(`RPC credential selection: ${scenario.name}`, async t => {
    configure(t, { ...scenario.env, BI_ACCESS_PASSWORD: password });
    const requests = [];
    t.mock.method(globalThis, "fetch", async (url, init) => {
      requests.push({ url, init });
      if (url.endsWith("/bi_sales_snapshot")) return Response.json({
        rows: [["2026-10-23", "test", "test", "test", "test", "test", 1, 1, 1]],
        meta: { cutoffDate: "2026-10-23" }
      });
      if (url.endsWith("/bi_sync_status")) return Response.json({ cutoffDate: "2026-10-23" });
      return Response.json([{ bi_test: { measured: 7 } }]);
    });
    const readiness = source.supabaseRpcReadiness();
    assert.deepEqual(readiness, { mode: scenario.mode });
    const payload = await source.callBiRpc("bi_test", { p_limit: 5 });
    assert.deepEqual(payload, { measured: 7 });
    const rows = await source.loadSalesData();
    const status = await source.loadSalesDataStatus();
    assert.equal(rows.length, 1);
    assert.equal(status.status, "success");
    assert.equal(status.cutoffDate, "2026-10-23");
    assert.equal(requests.length, 3);
    for (const { url, init } of requests) {
      assert.ok(url.startsWith("https://rxewpevxqtfmksybykvo.supabase.co/rest/v1/rpc/"));
      const headers = new Headers(init.headers);
      assert.equal(headers.get("apikey"), scenario.key);
      assert.equal(headers.get("authorization"), scenario.mode === "secret" ? null : `Bearer ${scenario.key}`);
      assert.equal(headers.get("content-type"), "application/json");
      assert.equal(headers.get("accept"), "application/json");
      assert.equal(init.method, "POST");
      assert.equal(init.cache, "no-store");
      assert.equal(JSON.parse(init.body).p_password, password);
      assert.ok(!init.body.includes(secret) && !init.body.includes(legacy));
    }
    assert.equal(JSON.parse(requests[0].init.body).p_limit, 5);
    // These public return values can be passed to clients without credential metadata.
    const clientData = JSON.stringify({ readiness, payload, rows, status });
    for (const value of [secret, legacy, password, anon]) assert.ok(!clientData.includes(value));
  });
}

test("the BI password remains required even with a server secret", async t => {
  configure(t, { SUPABASE_SECRET_KEY: secret });
  t.mock.method(globalThis, "fetch", () => assert.fail("must not call RPC without password"));
  await assert.rejects(source.callBiRpc("bi_test"), /^Error: BI_ACCESS_PASSWORD is not configured$/);
});

test("RPC failures do not echo response secrets or retry using anon", async t => {
  configure(t, { SUPABASE_SECRET_KEY: secret, SUPABASE_SERVICE_ROLE_KEY: legacy, BI_ACCESS_PASSWORD: password });
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    new Response(`${secret} ${legacy} ${password}`, { status: 401 }));
  await assert.rejects(source.callBiRpc("bi_test"), /^Error: Supabase RPC bi_test returned 401$/);
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(source.supabaseRpcReadiness(), { mode: "secret" });
});

test("sales fallback logs do not include transport error credentials", async t => {
  configure(t, { SUPABASE_SECRET_KEY: secret, BI_ACCESS_PASSWORD: password });
  const logs = t.mock.method(console, "error", () => {});
  t.mock.method(globalThis, "fetch", async url => {
    if (url.includes("supabase.co")) throw new Error(`${secret} ${password}`);
    return new Response("header\n");
  });
  const status = await source.loadSalesDataStatus();
  assert.equal(status.source, "google-sheets");
  assert.equal(status.status, "fallback");
  assert.equal(status.warehouseRows, null);
  assert.equal(logs.mock.callCount(), 2);
  const output = JSON.stringify(logs.mock.calls.map(call => call.arguments));
  assert.ok(!output.includes(secret) && !output.includes(password));
});

test("Next.js rejects a Client Component importing the Supabase transport", { timeout: 120_000 }, t => {
  const fixture = mkdtempSync(path.join(tmpdir(), "bi-server-boundary-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  mkdirSync(path.join(fixture, "app"));
  symlinkSync(path.join(web, "node_modules"), path.join(fixture, "node_modules"), "dir");
  writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ private: true }));
  // Keep compiler diagnostics in this process rather than an extra build worker.
  writeFileSync(path.join(fixture, "next.config.mjs"),
    "export default { experimental: { webpackBuildWorker: false } };");
  cpSync(path.join(web, "lib/data/source.ts"), path.join(fixture, "source.ts"));
  writeFileSync(path.join(fixture, "app/layout.js"),
    "export default function Layout({children}) { return <html><body>{children}</body></html>; }");
  writeFileSync(path.join(fixture, "app/page.js"),
    '"use client"; import {supabaseRpcReadiness} from "../source"; export default function Page() { return <div>{supabaseRpcReadiness().mode}</div>; }');
  const log = path.join(fixture, "build.log");
  const fd = openSync(log, "w");
  let result;
  try {
    result = spawnSync(process.execPath, [path.join(web, "node_modules/next/dist/bin/next"), "build", fixture], {
      cwd: fixture, stdio: ["ignore", fd, fd], timeout: 100_000,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", SUPABASE_SECRET_KEY: secret }
    });
  } finally {
    closeSync(fd);
  }
  assert.ifError(result.error);
  const output = readFileSync(log, "utf8");
  assert.notEqual(result.status, 0, "client import must fail the build");
  assert.match(output, /server-only/);
  assert.match(output, /Client Component|Server Component/);
  assert.ok(!output.includes(secret));
});
