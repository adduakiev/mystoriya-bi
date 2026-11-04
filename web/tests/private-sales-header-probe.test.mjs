import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { probePrivateSalesHeader } from "../../supabase/functions/sync-google-sheet/private-sales-header-probe.mjs";
import { assertSalesCsvPreflight } from "../../supabase/functions/sync-google-sheet/source-safety.mjs";

// Generated synthetic key only. No real credential, OAuth or Google call exists.
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const account = { type: "service_account", project_id: "myastoriya-bi",
  client_email: "myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com",
  token_uri: "https://oauth2.googleapis.com/token", private_key_id: "a".repeat(40),
  private_key: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64")}\n-----END PRIVATE KEY-----\n` };
const secret = JSON.stringify(account);
const scope = "https://www.googleapis.com/auth/spreadsheets.readonly";
const range = "'Данние короткі'!A1:N1";
const sheetUrl = "https://sheets.googleapis.com/v4/spreadsheets/1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA/values/" +
  encodeURIComponent(range) + "?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
const header = ["Synthetic A", "Synthetic B", "Synthetic C", "Synthetic D", "Synthetic E", "Обліковий день",
  "Зі складу", "Бренд", "Власність", "Доставка", "Тип замовлення", "Сума зі знижкою, грн.", "Чеків", "Націнка, грн."];
const tokenValue = { access_token: "synthetic-token-canary", token_type: "Bearer", expires_in: 3600 };
const headerValue = { range, majorDimension: "ROWS", values: [header] };
const json = (value, init = {}) => new Response(JSON.stringify(value), { ...init,
  headers: { "content-type": "application/json; charset=UTF-8", ...init.headers } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let forbiddenCalls = 0;
const noFetch = () => { forbiddenCalls++; assert.fail("No transport is permitted"); };
test.afterEach(() => { const calls = forbiddenCalls; forbiddenCalls = 0; assert.equal(calls, 0, "Forbidden dependency was invoked"); });
function safe(result, code) {
  assert.deepEqual(Object.keys(result).sort(), ["code", "timestamp"]);
  assert.equal(result.code, code);
  assert.equal(new Date(result.timestamp).toISOString(), result.timestamp);
  assert.ok(Object.isFrozen(result));
  for (const canary of [secret, account.private_key, "synthetic-token-canary", "upstream-private-canary", ...header]) {
    assert.equal(JSON.stringify(result).includes(canary), false);
  }
}
function fixture({ token = () => json(tokenValue), sheet = () => json(headerValue) } = {}) {
  const calls = [];
  const fetchImpl = (url, init) => {
    calls.push({ url, init });
    assert.ok(calls.length <= 2, "No retry or third request");
    return calls.length === 1 ? token(url, init) : sheet(url, init);
  };
  return { calls, fetchImpl };
}

test("only two pinned requests; real synthetic RS256 signature and fixed five-minute readonly assertion", async () => {
  const f = fixture({ token: async (url, init) => {
    assert.equal(url, account.token_uri);
    assert.equal(init.method, "POST");
    assert.deepEqual(Object.keys(init.headers), ["Content-Type"]);
    assert.equal(init.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.deepEqual([...init.body.keys()], ["grant_type", "assertion"]);
    assert.equal(init.body.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
    const [h, p, s] = init.body.get("assertion").split(".");
    assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { alg: "RS256", typ: "JWT", kid: account.private_key_id });
    const claims = JSON.parse(Buffer.from(p, "base64url"));
    assert.deepEqual(claims, { iss: account.client_email, scope, aud: account.token_uri, iat: claims.iat, exp: claims.iat + 300 });
    assert.ok(Math.abs(claims.iat - Math.floor(Date.now() / 1000)) < 5);
    assert.equal(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", pair.publicKey, Buffer.from(s, "base64url"),
      new TextEncoder().encode(`${h}.${p}`)), true);
    return json({ ...tokenValue, scope });
  }, sheet: (url, init) => {
    assert.equal(url, sheetUrl);
    assert.equal(init.method, "GET");
    assert.deepEqual(init.headers, { Authorization: "Bearer synthetic-token-canary" });
    assert.equal(Object.hasOwn(init, "body"), false);
    return json(headerValue);
  } });
  safe(await probePrivateSalesHeader(secret, f), "FAIL"); // Unknown caller option `calls` cannot enable I/O.
  assert.equal(f.calls.length, 0);
  safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "PASS");
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].init.signal, f.calls[1].init.signal);
  for (const { init } of f.calls) {
    assert.equal(init.redirect, "error"); assert.equal(init.credentials, "omit"); assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
  }
});

test("missing/broken/wrong-account/alternate-token/scope credentials stop before any request", async () => {
  for (const input of [undefined, null, "upstream-private-canary", "null", "[]", "{}", "x".repeat(16385),
    ...[{ type: "authorized_user" }, { project_id: "other" }, { client_email: "other@example.invalid" },
      { token_uri: "https://attacker.invalid/token" }, { scope }, { scopes: ["https://www.googleapis.com/auth/drive"] },
      { universe_domain: "attacker.invalid" }, { private_key_id: "bad" }, { private_key: "upstream-private-canary" },
      { private_key: "-----BEGIN PRIVATE KEY-----\nYWJj\n-----END PRIVATE KEY-----\n" }]
      .map(patch => JSON.stringify({ ...account, ...patch }))]) {
    safe(await probePrivateSalesHeader(input, { fetchImpl: noFetch }), "FAIL");
  }
});

test("weak RSA and non-RSA signing keys fail closed before OAuth", async () => {
  const weak = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 1024,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const ec = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  for (const key of [weak.privateKey, ec.privateKey]) {
    const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey("pkcs8", key)).toString("base64")}\n-----END PRIVATE KEY-----\n`;
    safe(await probePrivateSalesHeader(JSON.stringify({ ...account, private_key: pem }), { fetchImpl: noFetch }), "FAIL");
  }
});

test("caller cannot select URL/range/options, extend budget, provide credentials or fall back to global fetch", async () => {
  for (const options of [undefined, null, {}, [], { fetchImpl: 1 }, { fetchImpl: noFetch, signal: {} },
    ...["url", "range", "scope", "issuer", "headers", "credentials", "timeoutMs", "deadlineMs", "logger", "probe", "retry", "secret", "supabase"]
      .map(key => ({ fetchImpl: noFetch, [key]: "upstream-private-canary" }))]) {
    safe(await probePrivateSalesHeader(secret, options), "FAIL");
  }
});

for (const phase of ["token", "sheet"]) {
  test(`${phase}: HTTP errors, redirects, non-200 successes, content types and upstream throws are sanitized without retry`, async () => {
    for (const response of [
      ...[201, 204, 206, 301, 302, 303, 307, 308, 400, 401, 403, 404, 429, 500, 502, 503, 504]
        .map(status => () => new Response(status === 204 ? null : "upstream-private-canary", { status })),
      () => new Response("upstream-private-canary"),
      () => json({}, { headers: { "content-type": "text/html" } }),
      () => json({}, { headers: { "content-type": "application/json-malicious" } }),
      () => json({}, { headers: { "content-type": "application/json; charset=iso-8859-1" } }),
      () => { throw Error(`upstream-private-canary ${secret} ${tokenValue.access_token}`, { cause: account }); },
      () => Promise.reject({ private: secret }),
      () => ({ status: 200, redirected: true, headers: new Headers() }),
      () => ({ status: 200, url: "https://attacker.invalid", headers: new Headers() }),
      () => ({ status: 200, type: "opaqueredirect", headers: new Headers() })
    ]) {
      const f = fixture({ [phase]: response });
      safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "FAIL");
      assert.equal(f.calls.length, phase === "token" ? 1 : 2);
    }
  });

  test(`${phase}: bounded JSON stream rejects oversized, invalid UTF8, missing body and stream failures`, async () => {
    for (const response of [
      () => json({ padding: "x".repeat(32768) }),
      () => new Response(" ".repeat(32769), { headers: { "content-type": "application/json" } }),
      () => new Response("{", { headers: { "content-type": "application/json" } }),
      () => new Response(new Uint8Array([0xff, 0xfe]), { headers: { "content-type": "application/json" } }),
      () => json({}, { headers: { "content-length": "32769" } }),
      () => json({}, { headers: { "content-length": "NaN" } }),
      () => new Response(null, { headers: { "content-type": "application/json" } }),
      () => new Response(new ReadableStream({ start(c) { c.error(Error("upstream-private-canary")); } }),
        { headers: { "content-type": "application/json" } }),
      () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(0)); c.close(); } }),
        { headers: { "content-type": "application/json" } }),
      () => new Response(new ReadableStream({ start(c) { c.enqueue("upstream-private-canary"); c.close(); } }),
        { headers: { "content-type": "application/json" } })
    ]) {
      const f = fixture({ [phase]: response });
      safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "FAIL");
      assert.equal(f.calls.length, phase === "token" ? 1 : 2);
    }
  });
}

test("expired/revoked credential response, wrong scopes, missing/unsafe/expired tokens cannot reach Sheets", async () => {
  for (const value of [null, [], {}, { error: "invalid_grant", error_description: "upstream-private-canary" },
    ...[{ access_token: "" }, { access_token: "bad\r\nAuthorization: secret" }, { access_token: "x".repeat(8193) },
      { token_type: "Basic" }, { token_type: 123 }, { expires_in: 0 }, { expires_in: -1 }, { expires_in: 59 },
      { expires_in: 3601 }, { expires_in: "3600" }, { expires_in: 60.5 }, { scope: "https://www.googleapis.com/auth/drive" },
      { scope: `${scope} https://www.googleapis.com/auth/drive` }, { extra: "upstream-private-canary" }]
      .map(patch => ({ ...tokenValue, ...patch }))]) {
    const f = fixture({ token: () => json(value) });
    safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "FAIL");
    assert.equal(f.calls.length, 1);
  }
});

test("exact range, ROWS, one row, exactly 14 string cells and well-formed metadata are mandatory", async () => {
  for (const value of [null, [], {}, { ...headerValue, range: undefined },
    ...["'Данние короткі'!A:N", "'Данние короткі'!A1:N2", "Other!A1:N1", "Данние короткі!A1:N1"]
      .map(range => ({ ...headerValue, range })),
    { ...headerValue, majorDimension: "COLUMNS" }, { ...headerValue, extra: "upstream-private-canary" },
    ...[[], [header, header], [null], [header.slice(0, 13)], [[...header, "extra"]],
      ...[null, true, 1, {}, [], "\uD800", "\uDC00", "\u0000"].map(value => { const h = [...header]; h[0] = value; return [h]; })]
      .map(values => ({ ...headerValue, values }))]) {
    const f = fixture({ sheet: () => json(value) });
    safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "FAIL");
    assert.equal(f.calls.length, 2);
  }
});

test("all nine labels match source-safety; normalization is NFC/whitespace only", async () => {
  const row = [1, 2026, 10, 2026, 10, "2026-10-26", "Synthetic", "Synthetic", "Synthetic", "Synthetic", "Synthetic", "1.00", "1", "1.00"];
  assert.doesNotThrow(() => assertSalesCsvPreflight([header, row]));
  const normalized = header.map(value => ` \t${value.normalize("NFD").replace(/ /g, "  ")}\n`);
  const success = fixture({ sheet: () => json({ ...headerValue, values: [normalized] }) });
  safe(await probePrivateSalesHeader(secret, { fetchImpl: success.fetchImpl }), "PASS");
  assert.doesNotThrow(() => assertSalesCsvPreflight([normalized, row]));
  for (let column = 5; column < 14; column++) {
    for (const wrong of ["", "upstream-private-canary", header[column].toLowerCase(), `${header[column]}!`]) {
      const changed = [...header]; changed[column] = wrong;
      assert.throws(() => assertSalesCsvPreflight([changed, row]), /HEADER_MISMATCH/);
      const f = fixture({ sheet: () => json({ ...headerValue, values: [changed] }) });
      safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "FAIL");
    }
  }
});

test("32 KiB inclusive bound is checked across chunks, never through unbounded json/text helpers", async () => {
  const body = JSON.stringify(headerValue);
  const bytes = new TextEncoder().encode(body + " ".repeat(32768 - Buffer.byteLength(body)));
  let cancelled = false;
  const f = fixture({ sheet: () => ({ status: 200, redirected: false, url: sheetUrl,
    headers: new Headers({ "content-type": "application/json", "content-length": "32768" }),
    body: { getReader: () => {
      let offset = 0;
      return { read: async () => offset < bytes.length ? { done: false, value: bytes.slice(offset, offset += 19) } : { done: true },
        cancel() { cancelled = true; return new Promise(() => {}); }, releaseLock() {} };
    } }, json: noFetch, text: noFetch }) });
  safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "PASS");
  assert.equal(cancelled, true);
});

for (const phase of [1, 2]) {
  for (const stage of ["fetch", "stream"]) {
    test(`single deadline settles non-cooperating ${phase === 1 ? "OAuth" : "header"} ${stage}; late completion cannot send another request`, async t => {
      t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 10, 3) });
      const reached = deferred(), late = deferred(); let calls = 0, requestSignal;
      const fetchImpl = async (_, init) => {
        calls++; requestSignal = init.signal;
        if (calls !== phase) return json(tokenValue);
        if (stage === "fetch") { reached.resolve(); return late.promise; }
        return { status: 200, headers: new Headers({ "content-type": "application/json" }), body: { getReader() {
          return { read() { reached.resolve(); return late.promise; }, cancel() { return new Promise(() => {}); }, releaseLock() {} };
        } } };
      };
      const pending = probePrivateSalesHeader(secret, { fetchImpl });
      await reached.promise;
      t.mock.timers.tick(29999);
      let settled = false; pending.then(() => { settled = true; });
      await Promise.resolve(); assert.equal(settled, false);
      t.mock.timers.tick(1);
      safe(await pending, "FAIL");
      assert.equal(requestSignal.aborted, true);
      late.resolve(stage === "fetch" ? json(tokenValue) : { done: true });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(calls, phase);
    });
  }
}

test("deadline is shared, not reset between token stream and header stream", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 10, 3) });
  const tokenReached = deferred(), tokenFinish = deferred(), sheetReached = deferred();
  const f = fixture({ token: async () => { tokenReached.resolve(); await tokenFinish.promise; return json(tokenValue); },
    sheet: () => ({ status: 200, headers: new Headers({ "content-type": "application/json" }), body: { getReader: () => ({
      read() { sheetReached.resolve(); return new Promise(() => {}); }, cancel() {}, releaseLock() {}
    }) } }) });
  const pending = probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl });
  await tokenReached.promise; t.mock.timers.tick(29000); tokenFinish.resolve();
  await sheetReached.promise; t.mock.timers.tick(1000);
  safe(await pending, "FAIL"); assert.equal(f.calls.length, 2);
});

test("pre-abort prevents OAuth, and external abort settles non-cooperating fetch/streams without leaking reason", async () => {
  const before = new AbortController(); before.abort(Error(secret));
  safe(await probePrivateSalesHeader(secret, { fetchImpl: noFetch, signal: before.signal }), "FAIL");
  for (const phase of [1, 2]) for (const stage of ["fetch", "stream"]) {
    const controller = new AbortController(), reached = deferred(); let calls = 0, requestSignal;
    const fetchImpl = async (_, init) => {
      calls++; requestSignal = init.signal;
      if (calls !== phase) return json(tokenValue);
      if (stage === "fetch") { reached.resolve(); return new Promise(() => {}); }
      return { status: 200, headers: new Headers({ "content-type": "application/json" }), body: { getReader: () => ({
        read() { reached.resolve(); return new Promise(() => {}); }, cancel() {}, releaseLock() {}
      }) } };
    };
    const pending = probePrivateSalesHeader(secret, { fetchImpl, signal: controller.signal });
    await reached.promise; controller.abort(Error(`upstream-private-canary ${secret}`));
    safe(await pending, "FAIL"); assert.equal(requestSignal.aborted, true); assert.equal(calls, phase);
  }
});

test("no imports, logger, runtime discovery, ambient fetch or import-time I/O; browser invocation fails before transport", () => {
  const url = new URL("../../supabase/functions/sync-google-sheet/private-sales-header-probe.mjs", import.meta.url);
  const source = readFileSync(url, "utf8");
  assert.doesNotMatch(source, /\b(?:import\s*(?:[{'"*]|\()|require\s*\(|console\s*\.|process\s*\.|Deno\s*\.|Bun\s*\.|localStorage|sessionStorage|indexedDB|XMLHttpRequest|WebSocket|sendBeacon|globalThis|supabase|postgrest|\.rpc\s*\()/i);
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    let forbidden=0;
    const deny=()=>{forbidden++;throw Error('forbidden dependency');};
    globalThis.fetch=deny;
    globalThis.Deno={env:{get:deny}};
    for (const method of ['log','warn','error','info','debug','trace']) console[method]=deny;
    const {probePrivateSalesHeader}=await import(${JSON.stringify(url.href)});
    globalThis.window={};
    assert.equal((await probePrivateSalesHeader('synthetic-secret',{fetchImpl:deny})).code,'FAIL');
    delete globalThis.window; globalThis.document={};
    assert.equal((await probePrivateSalesHeader('synthetic-secret',{fetchImpl:deny})).code,'FAIL');
    delete globalThis.document; globalThis.WorkerGlobalScope=class {};
    assert.equal((await probePrivateSalesHeader('synthetic-secret',{fetchImpl:deny})).code,'FAIL');
    delete globalThis.WorkerGlobalScope;
    assert.equal((await probePrivateSalesHeader('synthetic-secret')).code,'FAIL');
    assert.equal(forbidden,0);
  `], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr); assert.equal(child.stdout, ""); assert.equal(child.stderr, "");
});

test("opt-in probe is disconnected from every deployed runtime and composed preview; closed 503 guards keep legacy batch/finalize absent from Edge", () => {
  const root = new URL("../../", import.meta.url);
  function walk(dir) { return readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() && !["node_modules", ".next"].includes(e.name) ? walk(`${dir}/${e.name}`) : e.isFile() ? [`${dir}/${e.name}`] : []); }
  for (const file of [...walk("web/app"), ...walk("web/lib"), ...walk("web/components"), ...walk("supabase/functions")]
    .filter(file => /\.[cm]?[jt]sx?$/.test(file) && !file.endsWith("/private-sales-header-probe.mjs"))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), "utf8"), /private-sales-header-probe|probePrivateSalesHeader/);
  }
  assert.equal(createHash("sha256").update(readFileSync(new URL("web/app/api/data-sync/route.ts", root))).digest("hex"), "11b86897dc12bee12c904f799ed42dc9ee7bb8cfeee97e1a588c73ed3ca008d1");
  const edge = readFileSync(new URL('supabase/functions/sync-google-sheet/index.ts', root), 'utf8');
  assert.match(edge, /SALES_IMPORT_SAFETY_GATE/);
  assert.match(edge, /status:\s*503/);
  assert.doesNotMatch(edge, /gviz\/tq|sync_sales_batch|finalize_sales_snapshot|\bimport_runs\b|\b(?:fetch|createClient)\s*\(|\bDeno\.env\b/);

});

test("duplicate JSON keys, including escaped aliases, and excess nesting fail closed", async () => {
  safe(await probePrivateSalesHeader(secret.replace('"type":', '"type":"wrong","type":'), { fetchImpl: noFetch }), "FAIL");
  for (const phase of ["token", "sheet"]) for (const body of [
    phase === "token" ? JSON.stringify(tokenValue).replace('"token_type":', '"token_type":"Basic","token_type":') :
      JSON.stringify(headerValue).replace('"range":', '"range":"Other!A1:N1","ra\\u006ege":'),
    JSON.stringify({ nested: Array.from({ length: 10 }).reduce(value => [value], null) })
  ]) {
    const f = fixture({ [phase]: () => new Response(body, { headers: { "content-type": "application/json" } }) });
    safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "FAIL");
    assert.equal(f.calls.length, phase === "token" ? 1 : 2);
  }
});

test("even successful header validation never emits confidential nonmandatory labels", async () => {
  const privateHeader = [...header];
  privateHeader[0] = tokenValue.access_token; privateHeader[1] = secret; privateHeader[2] = "upstream-private-canary";
  const f = fixture({ sheet: () => json({ ...headerValue, values: [privateHeader] }) });
  safe(await probePrivateSalesHeader(secret, { fetchImpl: f.fetchImpl }), "PASS");
});

test("key import and signature exceptions are sanitized with zero network calls", async t => {
  for (const method of ["importKey", "sign"]) {
    const mock = t.mock.method(crypto.subtle, method, async () => { throw Error(`upstream-private-canary ${secret}`); });
    safe(await probePrivateSalesHeader(secret, { fetchImpl: noFetch }), "FAIL");
    mock.mock.restore();
  }
});

test("30-second budget covers non-cooperating signing too; late signature cannot start OAuth", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 10, 3) });
  const reached = deferred(), late = deferred();
  t.mock.method(crypto.subtle, "sign", () => { reached.resolve(); return late.promise; });
  const pending = probePrivateSalesHeader(secret, { fetchImpl: noFetch });
  await reached.promise; t.mock.timers.tick(30000);
  safe(await pending, "FAIL");
  late.resolve(new ArrayBuffer(256));
  await new Promise(resolve => setImmediate(resolve));
});

test("throwing caller configuration and abort cleanup never escape as errors or caller details", async () => {
  const brokenSignal = new AbortController().signal;
  for (const method of ["addEventListener", "removeEventListener"]) {
    Object.defineProperty(brokenSignal, method, { get() { throw Error(secret); } });
  }
  for (const options of [
    { get fetchImpl() { throw Error(secret); } },
    { fetchImpl: noFetch, get signal() { throw Error(secret); } },
    { fetchImpl: noFetch, [Symbol("private-option-canary")]: secret },
    { fetchImpl: noFetch, signal: brokenSignal }
  ]) safe(await probePrivateSalesHeader(secret, options), "FAIL");
});
