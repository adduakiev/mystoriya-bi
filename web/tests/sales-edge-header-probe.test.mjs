import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { handleRequest } from "../../supabase/functions/sales-private-header-probe/index.ts";
import { assertSalesCsvPreflight } from "../../supabase/functions/sync-google-sheet/source-safety.mjs";

// Entirely synthetic ephemeral credentials, never an actual server key/secret.
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (role = "service_role", patch = {}) => `${encode({ alg: "HS256", typ: "JWT" })}.${
  encode({ iss: "supabase", role, exp: 4102444800, ...patch })}.${"a".repeat(43)}`;
const service = jwt();
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const account = { type: "service_account", project_id: "myastoriya-bi",
  client_email: "myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token", private_key_id: "a".repeat(40),
  private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64")}\n-----END PRIVATE KEY-----\n` };
const secret = JSON.stringify(account);
const range = "'Данние короткі'!A1:N1";
const sheetUrl = "https://sheets.googleapis.com/v4/spreadsheets/1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA/values/" +
  encodeURIComponent(range) + "?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
const header = ["Synthetic A", "Synthetic B", "Synthetic C", "Synthetic D", "Synthetic E", "Обліковий день",
  "Зі складу", "Бренд", "Власність", "Доставка", "Тип замовлення", "Сума зі знижкою, грн.", "Чеків", "Націнка, грн."];
const sheet = { range, majorDimension: "ROWS", values: [header] };
const token = { access_token: "synthetic-token-canary", token_type: "Bearer", expires_in: 3600 };
const json = (value, init = {}) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, ...init });
const request = (init = {}, suffix = "") => new Request(`https://fixture.invalid/probe${suffix}`, {
  method: "POST", ...init, headers: { authorization: `Bearer ${service}`, ...init.headers }
});
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(options = {}) {
  const events = [], calls = [];
  return { events, calls, dependencies: {
    envGet(name) {
      events.push(name);
      if (name === "SUPABASE_SERVICE_ROLE_KEY") return Object.hasOwn(options, "service") ? options.service : service;
      assert.equal(name, "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON");
      return Object.hasOwn(options, "secret") ? options.secret : secret;
    },
    async fetchImpl(url, init) {
      calls.push({ url, init }); events.push(url);
      assert.deepEqual(events.slice(0, 2), ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"]);
      assert.ok(calls.length <= 2);
      assert.equal(url, calls.length === 1 ? account.token_uri : sheetUrl);
      assert.equal(init.method, calls.length === 1 ? "POST" : "GET");
      assert.equal(init.redirect, "error"); assert.equal(init.credentials, "omit"); assert.equal(init.cache, "no-store");
      if (calls.length === 1) {
        const signed = init.body.get("assertion").split(".");
        const claims = JSON.parse(Buffer.from(signed[1], "base64url"));
        assert.equal(claims.scope, "https://www.googleapis.com/auth/spreadsheets.readonly");
        assert.equal(claims.iss, account.client_email); assert.equal(claims.aud, account.token_uri);
        assert.equal(claims.exp - claims.iat, 300);
        assert.equal(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pair.publicKey,
          Buffer.from(signed[2], "base64url"), new TextEncoder().encode(signed.slice(0, 2).join("."))), true);
      } else assert.equal(init.headers.Authorization, `Bearer ${token.access_token}`);
      return options.fetchImpl ? options.fetchImpl(url, init, calls.length) : json(calls.length === 1 ? token : sheet);
    }
  } };
}
async function safe(response, status, code = "FAIL") {
  assert.equal(response.status, status);
  for (const [name, value] of Object.entries({ "cache-control": "no-store", "x-content-type-options": "nosniff",
    "x-frame-options": "DENY", "referrer-policy": "no-referrer" })) assert.equal(response.headers.get(name), value);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  const text = await response.text(), value = JSON.parse(text);
  assert.deepEqual(Object.keys(value), ["code", "timestamp"]);
  assert.equal(value.code, code); assert.equal(new Date(value.timestamp).toISOString(), value.timestamp);
  for (const privateValue of [secret, token.access_token, "upstream-private-canary", ...header]) assert.equal(text.includes(privateValue), false);
}

test.beforeEach(t => {
  t.mock.method(globalThis, "fetch", () => assert.fail("Real transport forbidden"));
});

test("no/malformed/ordinary/forged/expired auth fails before Google secret or any network", async () => {
  for (const authorization of ["", "Basic abc", "Bearer sb_secret_synthetic", "Bearer malformed", `Bearer ${jwt("anon")}`,
    `Bearer ${jwt("authenticated")}`, `Bearer ${jwt("service_role", { exp: 1 })}`, `Bearer ${jwt("service_role", { iss: "attacker" })}`,
    `Bearer ${service}, Bearer ${service}`, `Bearer ${service.slice(0, -1)}b`]) {
    const f = fixture();
    await safe(await handleRequest(request({ headers: { authorization } }), f.dependencies), 401);
    assert.equal(f.events.includes("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"), false); assert.equal(f.calls.length, 0);
    if (!authorization.endsWith("b")) assert.deepEqual(f.events, []);
  }
  for (const expected of [undefined, "", jwt("anon"), "sb_secret_synthetic"]) {
    const f = fixture({ service: expected });
    await safe(await handleRequest(request(), f.dependencies), 401);
    assert.deepEqual(f.events, ["SUPABASE_SERVICE_ROLE_KEY"]);
  }
  // Matching an ordinary key must still fail the explicit role guard.
  const f = fixture({ service: jwt("authenticated") });
  await safe(await handleRequest(request({ headers: { authorization: `Bearer ${jwt("authenticated")}` } }), f.dependencies), 401);
  assert.deepEqual(f.events, []);
});

test("hostile methods, bodies, query overrides and browser/override headers cannot read the Google secret", async () => {
  const cases = [
    ...["GET", "HEAD", "OPTIONS", "PUT", "DELETE", "PATCH"].map(method => [request({ method }), 405]),
    [request({}, "?range=A:N&url=https://attacker.invalid&probe=false"), 400],
    [request({ body: "{}" }), 400],
    ...["origin", "cookie", "range", "x-http-method-override", "x-method-override", "x-forwarded-authorization", "apikey"]
      .map(name => [request({ headers: { [name]: "hostile" } }), 400])
  ];
  for (const [req, status] of cases) {
    const f = fixture(); await safe(await handleRequest(req, f.dependencies), status);
    assert.deepEqual(f.events, ["SUPABASE_SERVICE_ROLE_KEY"]); assert.equal(f.calls.length, 0);
  }
});

test("authorized PASS uses fixed readonly signed OAuth, one header read, schema parity and sanitized output", async () => {
  const f = fixture(); await safe(await handleRequest(request(), f.dependencies), 200, "PASS");
  assert.equal(f.calls.length, 2);
  assert.doesNotThrow(() => assertSalesCsvPreflight([header,
    [1, 2026, 10, 2026, 10, "2026-10-26", "Synthetic", "Synthetic", "Synthetic", "Synthetic", "Synthetic", "1.00", "1", "1.00"]]));
});

test("missing/invalid/mismatched secret fails sanitized without upstream requests", async () => {
  for (const value of [undefined, "", "{", "null", "[]", "{}", JSON.stringify({ ...account, client_email: "attacker" }),
    JSON.stringify({ ...account, private_key: "invalid" })]) {
    const f = fixture({ secret: value }); await safe(await handleRequest(request(), f.dependencies), 503);
    assert.equal(f.calls.length, 0);
  }
});

test("server environment errors are sanitized on both sides of authentication", async () => {
  for (const phase of ["SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON"]) {
    const f = fixture(), envGet = f.dependencies.envGet;
    f.dependencies.envGet = name => { if (name === phase) throw Error(`upstream-private-canary ${secret}`); return envGet(name); };
    await safe(await handleRequest(request(), f.dependencies), phase === "SUPABASE_SERVICE_ROLE_KEY" ? 401 : 503);
    assert.equal(f.calls.length, 0);
  }
});

test("header width/range/rows and every mandatory label fail closed; private nonmandatory labels never escape", async () => {
  const values = [{ ...sheet, range: "'Данние короткі'!A:N" }, { ...sheet, majorDimension: "COLUMNS" },
    ...[[], [header, header], [header.slice(0, 13)], [[...header, "extra"]], [[null, ...header.slice(1)]]].map(values => ({ ...sheet, values })),
    ...Array.from({ length: 9 }, (_, index) => { const row = [...header]; row[index + 5] = "upstream-private-canary"; return { ...sheet, values: [row] }; })];
  for (const value of values) {
    const f = fixture({ fetchImpl: (_, __, count) => json(count === 1 ? token : value) });
    await safe(await handleRequest(request(), f.dependencies), 503); assert.equal(f.calls.length, 2);
  }
  const row = [...header]; row[0] = secret; row[1] = token.access_token; row[2] = "upstream-private-canary";
  const f = fixture({ fetchImpl: (_, __, count) => json(count === 1 ? token : { ...sheet, values: [row] }) });
  await safe(await handleRequest(request(), f.dependencies), 200, "PASS");
});

test("upstream errors, redirects, unsafe scope, invalid JSON and excess bodies never escape or retry", async () => {
  for (const phase of [1, 2]) for (const response of [
    () => { throw new Error(`upstream-private-canary ${secret}`); },
    ...[401, 403, 429, 500, 302].map(status => () => json({ secret }, { status })),
    () => new Response("upstream-private-canary", { headers: { "content-type": "text/plain" } }),
    () => new Response("{", { headers: { "content-type": "application/json" } }),
    () => json({ scope: "https://www.googleapis.com/auth/drive" }),
    () => json({ padding: "x".repeat(32769) }),
    () => ({ status: 200, redirected: true }),
    () => json({}, { headers: { "content-type": "application/json", "content-length": "32769" } })
  ]) {
    const f = fixture({ fetchImpl: (_, __, count) => count === phase ? response() : json(token) });
    await safe(await handleRequest(request(), f.dependencies), 503); assert.equal(f.calls.length, phase);
  }
});

for (const phase of [1, 2]) for (const stage of ["fetch", "stream"]) {
  test(`total deadline bounds non-cooperating ${phase}/${stage}; late response cannot start another request`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 10, 5) });
    const reached = deferred(), late = deferred();
    const f = fixture({ fetchImpl: (_, __, count) => {
      if (count !== phase) return json(token);
      if (stage === "fetch") { reached.resolve(); return late.promise; }
      return { status: 200, headers: new Headers({ "content-type": "application/json" }), body: { getReader() {
        return { read() { reached.resolve(); return late.promise; }, cancel() { return new Promise(() => {}); }, releaseLock() {} };
      } } };
    } });
    const pending = handleRequest(request(), f.dependencies);
    await reached.promise; t.mock.timers.tick(30000); await safe(await pending, 503);
    assert.equal(f.calls.at(-1).init.signal.aborted, true);
    late.resolve(stage === "fetch" ? json(token) : { done: true });
    await new Promise(resolve => setImmediate(resolve)); assert.equal(f.calls.length, phase);
  });
}

test("signing is inside the same total deadline and late signing cannot start OAuth", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 10, 5) });
  const reached = deferred(), late = deferred(), f = fixture();
  t.mock.method(crypto.subtle, "sign", () => { reached.resolve(); return late.promise; });
  const pending = handleRequest(request(), f.dependencies);
  await reached.promise; t.mock.timers.tick(30000); await safe(await pending, 503);
  late.resolve(new ArrayBuffer(256)); await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 0);
});

test("OAuth and Sheets share one deadline, not two consecutive budgets", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 10, 5) });
  const reached = deferred(), finish = deferred(), sheets = deferred();
  const f = fixture({ fetchImpl: async (_, __, count) => {
    if (count === 1) { reached.resolve(); await finish.promise; return json(token); }
    sheets.resolve(); return new Promise(() => {});
  } });
  const pending = handleRequest(request(), f.dependencies);
  await reached.promise; t.mock.timers.tick(29000); finish.resolve();
  await sheets.promise; t.mock.timers.tick(1000); await safe(await pending, 503);
  assert.equal(f.calls.length, 2);
});

test("import starts no listener/env/network; entry has only reader dependency and no business writes or registration elsewhere", async t => {
  let calls = 0;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "Deno");
  Object.defineProperty(globalThis, "Deno", { configurable: true,
    value: { env: { get() { calls++; throw Error("forbidden"); } }, serve() { calls++; } } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "Deno", previous); else delete globalThis.Deno; });
  await import(`../../supabase/functions/sales-private-header-probe/index.ts?isolated=1`);
  assert.equal(calls, 0);
  const root = new URL("../../", import.meta.url);
  const source = readFileSync(new URL("supabase/functions/sales-private-header-probe/index.ts", root), "utf8");
  assert.equal((source.match(/^import /gm) ?? []).length, 1);
  assert.doesNotMatch(source, /createClient|\.rpc\s*\(|sync_sales_batch|finalize_sales_snapshot|import_runs|gviz|console\.|private-sales-header-probe\.mjs|process\.env|setInterval|revalidate|localStorage/);
  assert.match(source, /if \(\(import\.meta/); assert.match(source, /verify_jwt=true/);
  function walk(dir) { return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() && !["node_modules", ".next"].includes(e.name) ? walk(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []); }
  for (const file of [...walk("web/app"), ...walk("web/lib"), ...walk("web/components"), ...walk("supabase/functions"), ...walk(".github/workflows")]
    .filter(file => /\.(?:[cm]?[jt]sx?|ya?ml|toml)$/.test(file) && !file.endsWith("sales-private-header-probe/index.ts"))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), "utf8"), /sales-private-header-probe\/index|functions\/v1\/sales-private-header-probe/);
  }
  const hash = path => createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex");
  assert.equal(hash("web/app/api/data-sync/route.ts"), "11b86897dc12bee12c904f799ed42dc9ee7bb8cfeee97e1a588c73ed3ca008d1");
  const edge = readFileSync(new URL("supabase/functions/sync-google-sheet/index.ts", root), "utf8");
  assert.match(edge, /SALES_IMPORT_SAFETY_GATE/); assert.doesNotMatch(edge, /\bfetch\s*\(|Deno\.env|sync_sales_batch|finalize_sales_snapshot/);
});
