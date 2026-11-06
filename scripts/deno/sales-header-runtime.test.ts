/// <reference lib="dom" />
// D266: no remote dependencies, credentials, listener, source or database I/O.
// Run only with the denied permissions in sales-pr44-native.yml. Standalone
// Deno evidence cannot identify the deployed Supabase Edge runtime/version.

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

const encode = (value: unknown) => btoa(JSON.stringify(value))
  .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (patch: Record<string, unknown> = {}) =>
  `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    iss: "supabase", role: "service_role", exp: 4102444800, ...patch,
  })}.${"a".repeat(43)}`;
// Deliberately unsigned synthetic fixture: matching the injected built-in key,
// plus the handler's claim checks, is essential; claims alone are insufficient.
const service = jwt();
const builtin = "SUPABASE_SERVICE_ROLE_KEY";
const google = "GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON";

Deno.test("D266 offline synthetic real-runtime and fail-closed boundaries", async () => {
  // FIRST: inspect and import under unmodified real runtime globals. Never
  // replace Deno/window/document to manufacture the native observation.
  const nativeBrowserGlobal = typeof window !== "undefined" || typeof document !== "undefined";
  console.log(JSON.stringify({
    "typeof window !== 'undefined'": typeof window !== "undefined",
    "typeof document !== 'undefined'": typeof document !== "undefined",
    "typeof Deno.env?.get === 'function'": typeof Deno.env?.get === "function",
    "typeof Deno.serve === 'function'": typeof Deno.serve === "function",
  }));
  const { handleRequest } = await import("../../supabase/functions/sales-private-header-probe/index.ts");

  async function check(label: string, token: string, key: string | undefined,
    status: number, expectedReads: string[]) {
    const reads: string[] = [];
    let networkCalls = 0;
    const response = await handleRequest(new Request("https://synthetic.invalid/probe", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
    }), {
      envGet(name) {
        reads.push(name);
        assert(name === builtin || name === google, "unexpected environment name");
        return name === builtin ? key : undefined;
      },
      fetchImpl: () => {
        networkCalls++;
        throw new Error("synthetic transport forbidden");
      },
    });
    // Log only status/counts and synthetic env names, never tokens or body.
    console.log(JSON.stringify({ case: label, status: response.status,
      envReadCount: reads.length, envReadNames: reads, networkCalls }));
    assert(response.status === status, `${label}: status`);
    assert(JSON.stringify(reads) === JSON.stringify(expectedReads), `${label}: read order`);
    assert(networkCalls === 0, `${label}: network forbidden`);
    assert(response.headers.get("cache-control") === "no-store", `${label}: cache`);
    assert(!response.headers.has("access-control-allow-origin"), `${label}: CORS`);
    const body = await response.json();
    assert(JSON.stringify(Object.keys(body)) === '["code","timestamp"]', `${label}: body keys`);
    assert(body.code === "FAIL" && typeof body.timestamp === "string" &&
      new Date(body.timestamp).toISOString() === body.timestamp, `${label}: sanitized body`);
  }

  await check("native/exact-key", service, service,
    nativeBrowserGlobal ? 401 : 503, nativeBrowserGlobal ? [] : [builtin, google]);
  await check("native/absent-key", service, undefined, 401, nativeBrowserGlobal ? [] : [builtin]);
  await check("native/mismatched-key", service, service.slice(0, -1) + "b", 401,
    nativeBrowserGlobal ? [] : [builtin]);

  // Only AFTER native observations: explicit synthetic global permutations.
  // Restore every descriptor even if an assertion fails. The native runtime
  // result above must never be described as a Supabase-compatible reproduction.
  const names = ["window", "document", "Deno", "fetch"] as const;
  const original = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const set = (name: typeof names[number], value: unknown) =>
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  let unexpectedGlobalCalls = 0;
  const forbidden = () => {
    unexpectedGlobalCalls++;
    throw new Error("synthetic global I/O forbidden");
  };
  try {
    set("fetch", forbidden);
    set("window", undefined);
    set("document", undefined);
    await check("synthetic-no-dom/exact-key", service, service, 503, [builtin, google]);
    for (const [label, key] of [["absent-key", undefined], ["empty-key", ""],
      ["mismatched-key", service.slice(0, -1) + "b"]]) {
      await check(`synthetic-no-dom/${label}`, service, key, 401, [builtin]);
    }
    for (const [label, token] of [["malformed", "malformed"], ["anon", jwt({ role: "anon" })],
      ["ordinary", jwt({ role: "authenticated" })], ["expired", jwt({ exp: 1 })],
      ["forged-issuer", jwt({ iss: "forged" })]]) {
      // Even matching an injected ordinary/expired/forged key cannot bypass claims.
      await check(`synthetic-no-dom/${label}`, token, token, 401, []);
    }
    await check("synthetic-no-dom/forged-signature", service.slice(0, -1) + "b", service, 401, [builtin]);

    for (const spoofDeno of [false, true]) {
      if (spoofDeno) set("Deno", { env: { get: forbidden }, serve: forbidden });
      for (const [label, windowValue, documentValue] of [
        ["window", globalThis, undefined], ["document", undefined, {}], ["both", globalThis, {}],
      ]) {
        set("window", windowValue);
        set("document", documentValue);
        await check(`synthetic-browser/${label}/${spoofDeno ? "spoofed-deno" : "real-deno"}`,
          service, service, 401, []);
      }
    }
    assert(unexpectedGlobalCalls === 0, "unexpected global transport/env/listener call");
  } finally {
    for (const name of names) {
      const descriptor = original.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
