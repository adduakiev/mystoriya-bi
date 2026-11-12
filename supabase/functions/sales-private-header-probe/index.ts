// PREPARE ONLY / NOT RELEASED. No other entrypoint imports this handler.
// Future deployment requires gateway verify_jwt=true AND the exact built-in
// service-role bearer below. Never deploy with --no-verify-jwt.
import { readPrivateSalesSheet, SPREADSHEET_ID } from "../sync-google-sheet/google-sheet-reader.mjs";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};
type Dependencies = { envGet: (name: string) => string | undefined; fetchImpl: typeof fetch };
const RANGE = "'Данние короткі'!A1:N1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(RANGE)}` +
  "?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
const REQUIRED = ["Обліковий день", "Зі складу", "Бренд", "Власність", "Доставка",
  "Тип замовлення", "Сума зі знижкою, грн.", "Чеків", "Націнка, грн."];
const fail = (): never => { throw new Error("FAIL"); };
const headers = {
  "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
  "Pragma": "no-cache", "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000", "Vary": "Authorization"
};

// Equality with the existing server-only key authenticates the entire JWT;
// decoded claims alone NEVER authenticate. No JWT secret or new key is needed.
function authorized(request: Request, envGet: Dependencies["envGet"]): boolean {
  const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43})$/.exec(
    request.headers.get("authorization") ?? "");
  if (!match || match[1].length > 4096) return false;
  const token = match[1];
  const decode = (part: string) => JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  const [head, body] = token.split(".").slice(0, 2).map(decode);
  if (head.alg !== "HS256" || head.typ !== "JWT" || body.role !== "service_role" ||
      body.iss !== "supabase" || !Number.isSafeInteger(body.exp) || body.exp <= Date.now() / 1000) return false;
  const expected = envGet("SUPABASE_SERVICE_ROLE_KEY");
  if (!expected || token.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < token.length; i++) difference |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}

// Trusted server dependencies only, never derived from HTTP input. No env read,
// network, logger or server registration occurs merely by importing this file.
export async function handleRequest(request: Request, dependencies: Dependencies = {
  envGet: name => Deno.env.get(name), fetchImpl: (...args) => fetch(...args)
}): Promise<Response> {
  const timestamp = new Date().toISOString();
  const result = (status: number, code: "PASS" | "FAIL" = "FAIL") =>
    new Response(JSON.stringify({ code, timestamp }), { status, headers });
  let authenticated = false;
  try {
    // Supabase edge-runtime v1.77.9 exposes window === globalThis in user
    // isolates. Require server capabilities and reject a DOM; window alone is
    // not a browser boundary. Exact built-in-key authentication remains below.
    if (typeof document !== "undefined" || typeof Deno === "undefined" ||
        typeof Deno.env?.get !== "function" || typeof Deno.serve !== "function") return result(401);
    authenticated = authorized(request, dependencies.envGet);
    if (!authenticated) return result(401);
    if (request.method !== "POST") return result(405);
    const url = new URL(request.url);
    if (url.search || url.hash || request.body !== null ||
        ["origin", "cookie", "range", "x-http-method-override", "x-method-override", "x-forwarded-authorization"]
          .some(name => request.headers.has(name)) ||
        (request.headers.has("apikey") && request.headers.get("apikey") !== request.headers.get("authorization")?.slice(7))) {
      return result(400);
    }

    const controller = new AbortController();
    const deadline = Date.now() + 30000;
    let active = true, count = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const guard = () => {
      if (!active || controller.signal.aborted || Date.now() >= deadline) fail();
    };
    const stopped = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { active = false; controller.abort(); reject(new Error("FAIL")); }, 30000);
    });
    try {
      // One shared deadline includes credentials, signing, both requests and all
      // body reads. A late continuation cannot start a subsequent request.
      const operation = (async () => {
        guard();
        const secret = dependencies.envGet("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON");
        const boundedFetch: typeof fetch = async (input, init) => {
          guard();
          const destination = String(input);
          count++;
          if (count > 2 || destination !== (count === 1 ? TOKEN_URL : SHEET_URL) ||
              init?.method !== (count === 1 ? "POST" : "GET")) fail();
          const response = await dependencies.fetchImpl(destination, { ...init, signal: controller.signal,
            redirect: "error", credentials: "omit", cache: "no-store" });
          guard();
          if (response.status !== 200 || response.redirected ||
              ["error", "opaque", "opaqueredirect"].includes(response.type) ||
              (response.url && response.url !== destination) ||
              !/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?\s*$/i.test(response.headers.get("content-type") ?? "")) fail();
          const limit = count === 1 ? 16384 : 32768;
          const length = response.headers.get("content-length");
          if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) fail();
          const reader = response.body?.getReader() ?? fail();
          let size = 0;
          const chunks: Uint8Array[] = [];
          try {
            while (true) {
              const { done, value } = await reader.read();
              guard();
              if (done) break;
              if (!(value instanceof Uint8Array) || !value.byteLength || (size += value.byteLength) > limit) fail();
              chunks.push(value);
            }
          } finally {
            // Never wait on an uncooperative cancellation promise.
            void reader.cancel().catch(() => {});
            reader.releaseLock();
          }
          const bytes = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
          if (count === 1) {
            if (value.scope !== undefined && value.scope !== "https://www.googleapis.com/auth/spreadsheets.readonly") fail();
          } else if (value.range !== RANGE || value.majorDimension !== "ROWS" ||
              !Array.isArray(value.values) || value.values.length !== 1 ||
              !Array.isArray(value.values[0]) || value.values[0].length !== 14 ||
              value.values[0].some((cell: unknown) => typeof cell !== "string" ||
                !cell.isWellFormed() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(cell))) fail();
          guard();
          return new Response(bytes, { headers: { "Content-Type": "application/json" } });
        };
        const options = { probe: true, fetchImpl: boundedFetch, signal: controller.signal };
        const rows = await readPrivateSalesSheet(secret, options);
        guard();
        if (count !== 2 || rows.length !== 1 || REQUIRED.some((label, index) =>
          rows[0][index + 5].normalize("NFC").replace(/\s+/g, " ").trim() !== label)) fail();
      })();
      await Promise.race([operation, stopped]);
      return result(200, "PASS");
    } finally {
      active = false;
      clearTimeout(timer);
      controller.abort();
    }
  } catch {
    return result(authenticated ? 503 : 401);
  }
}

// Explicit entry execution only; importing for review/tests starts no listener.
if ((import.meta as ImportMeta & { main?: boolean }).main) {
  Deno.serve(request => handleRequest(request));
}
