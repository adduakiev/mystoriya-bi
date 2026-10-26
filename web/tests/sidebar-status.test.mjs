import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const {renderToStaticMarkup} = require("react-dom/server");

function load(path, dependencies) {
  const {outputText} = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022}
  });
  const module = {exports: {}};
  new Function("require", "module", "exports", outputText)(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), module, module.exports
  );
  return module.exports;
}

const unknown = {
  source: "unknown", status: "unavailable", cutoffDate: null, lastSuccessfulSync: null,
  warehouseRows: null, monthlyAggregateRows: null, weeklyAggregateRows: null
};

function transport(cache = fn => fn) {
  return load("../lib/data/source.ts", {"server-only": {}, "next/cache": {unstable_cache: cache}});
}

function configure(t, password = "sidebar-test-only") {
  for (const [name, value] of Object.entries({BI_ACCESS_PASSWORD: password, BI_SUPABASE_RPC_AUTH_MODE: "anon"})) {
    const previous = process.env[name];
    t.after(() => previous === undefined ? delete process.env[name] : process.env[name] = previous);
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
  t.mock.method(console, "error", () => {});
}

for (const scenario of [
  {name: "HTTP failure", response: () => new Response("upstream private error", {status: 500})},
  {name: "invalid JSON", response: () => new Response("invalid JSON")},
  {name: "null payload", response: () => Response.json(null)},
  {name: "empty payload", response: () => Response.json({})},
  {name: "reported failed status", response: () => Response.json({status: "failed"})},
  {name: "network failure", response: () => {throw new Error("private transport error");}}
]) {
  test(`sidebar status: ${scenario.name} stays unknown without a dataset fallback`, async t => {
    configure(t);
    const requests = [];
    t.mock.method(globalThis, "fetch", async url => { requests.push(url); return scenario.response(); });
    assert.deepEqual(await transport().loadSalesDataStatus(), unknown);
    assert.equal(requests.length, 1);
    assert.ok(requests[0].endsWith("/bi_sync_status"));
  });
}

test("missing password and cache failure return unknown without network requests", async t => {
  configure(t);
  delete process.env.BI_ACCESS_PASSWORD;
  t.mock.method(globalThis, "fetch", () => assert.fail("no credentials means no status or dataset requests"));
  assert.deepEqual(await transport().loadSalesDataStatus(), unknown);
  assert.deepEqual(await transport(() => async () => {throw new Error("cache failure");}).loadSalesDataStatus(), unknown);
});

test("status timeout is bounded at two seconds and does not retry or download sales", async t => {
  configure(t);
  const timeouts = [];
  const controller = new AbortController();
  t.mock.method(AbortSignal, "timeout", ms => {timeouts.push(ms); return controller.signal;});
  const fetch = t.mock.method(globalThis, "fetch", async (_url, {signal}) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {once: true});
    queueMicrotask(() => controller.abort(new DOMException("Timed out", "TimeoutError")));
  }));
  assert.deepEqual(await transport().loadSalesDataStatus(), unknown);
  assert.deepEqual(timeouts, [2_000]);
  assert.equal(fetch.mock.callCount(), 1);
});

test("successful status preserves measured zero and missing counts with the existing cache policy", async t => {
  configure(t);
  const policies = [];
  const source = transport((fn, keys, options) => {policies.push({keys, options}); return fn;});
  const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({
    status: "success", cutoffDate: "2026-10-22", lastSuccessfulSync: "2026-10-23T01:00:00Z",
    warehouseRows: 0, monthlyAggregateRows: null
  }));
  assert.deepEqual(await source.loadSalesDataStatus(), {
    source: "supabase", status: "success", cutoffDate: "2026-10-22",
    lastSuccessfulSync: "2026-10-23T01:00:00Z", warehouseRows: 0,
    monthlyAggregateRows: null, weeklyAggregateRows: null
  });
  assert.equal(fetch.mock.callCount(), 1);
  assert.deepEqual(policies.find(p => p.keys[0] === "myastoriya-sales-status-v2").options,
    {revalidate: 60, tags: ["sales-data-status"]});
});

function brand(loadSalesDataStatus) {
  return load("../components/SidebarBrand.tsx", {
    "@/lib/data/source": {loadSalesDataStatus},
    "@/components/DataSyncControl": {DataSyncControl: ({initialCutoff}) =>
      React.createElement("button", {"data-cutoff": initialCutoff}, "sync")}
  });
}

function descendants(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(descendants)];
}

test("brand/logo/logout render synchronously while status alone is behind Suspense", () => {
  let calls = 0;
  const {SidebarBrand, SidebarSalesStatus, SidebarStatusPending} = brand(() => {calls++; return new Promise(() => {});});
  const tree = SidebarBrand();
  assert.equal(typeof tree.then, "undefined");
  assert.equal(calls, 0, "the synchronous brand must not initiate/await a status request");
  const nodes = descendants(tree);
  assert.ok(nodes.some(node => node.type === "img" && node.props.alt === "М'ЯСТОРІЯ"));
  assert.ok(nodes.some(node => node.type === "form" && node.props.action === "/api/auth/logout"));
  const boundary = nodes.find(node => node.type === React.Suspense);
  assert.equal(boundary.props.children.type, SidebarSalesStatus);
  assert.equal(boundary.props.fallback.type, SidebarStatusPending);
  const placeholder = renderToStaticMarkup(React.createElement(SidebarStatusPending));
  assert.match(placeholder, /Статус даних перевіряється/);
  assert.doesNotMatch(placeholder, /Sync OK|Google Sheets|data-health ok/);
});

for (const cutoffDate of [null, "bad", "2026-02-30"]) {
  test(`missing/invalid cutoff ${cutoffDate} cannot crash or display green warehouse status`, async () => {
    const {SidebarSalesStatus} = brand(async () => ({...unknown, source: "supabase", status: "success", cutoffDate}));
    const html = renderToStaticMarkup(await SidebarSalesStatus());
    assert.match(html, /Статус даних недоступний/);
    assert.doesNotMatch(html, /data-health ok|Sync OK|Google Sheets/);
    assert.doesNotMatch(html, /data-cutoff=/, "invalid dates must not reach the sync control formatter");
  });
}

test("unknown status never claims a Google Sheets fallback; valid status displays the returned cutoff", async () => {
  const unavailable = brand(async () => unknown);
  assert.match(renderToStaticMarkup(await unavailable.SidebarSalesStatus()), /Статус даних недоступний/);
  const available = brand(async () => ({...unknown, source: "supabase", status: "success", cutoffDate: "2026-10-22"}));
  const html = renderToStaticMarkup(await available.SidebarSalesStatus());
  assert.match(html, /data-health ok/);
  assert.match(html, /22\.10\.2026/);
  assert.match(html, /Warehouse · статус отримано/);
  assert.doesNotMatch(html, /Sync OK|Google Sheets/);
});
