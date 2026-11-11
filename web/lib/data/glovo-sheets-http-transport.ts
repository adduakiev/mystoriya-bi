import "server-only";
import { GLOVO_SHEETS_REQUEST, type GlovoSheetsTransport } from "./glovo-sheets-adapter";

// PREPARE ONLY: no runtime callers, default fetch, credential discovery or OAuth.
// Both dependencies must be explicitly injected; tests use synthetic values only.
type Options = Readonly<{
  enabled: true;
  fetchImpl: typeof fetch;
  provideBearer: (signal: AbortSignal) => Promise<Readonly<{ token: string; expiresAt: number }>>;
  signal?: AbortSignal;
  timeoutMs?: number;
}>;
const MAX_BYTES = 1024 * 1024;
const MAX_CHUNKS = 4096;
const MAX_TIMEOUT_MS = 5000;
const MAX_TOKEN_LIFETIME_MS = 5 * 60 * 1000;
const rejected = () => new Error("GLOVO_SHEETS_HTTP_REJECTED");
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: object, expected: readonly string[]) =>
  Reflect.ownKeys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
const discard = (body: ReadableStream<Uint8Array> | null) => {
  try { void body?.cancel().catch(() => {}); } catch { /* Never expose dependency exceptions. */ }
};

/** Inert until explicitly enabled AND called. Authorization metadata is a caller
 * assertion, not proof of Google acceptance, source permission or completeness.
 * Each getValues call permits at most one fixed GET, with no retry/fallback.
 */
export function createGlovoSheetsHttpTransport(options?: Options): GlovoSheetsTransport {
  try {
    if (!record(options) || options.enabled !== true || typeof options.fetchImpl !== "function" ||
        typeof options.provideBearer !== "function" ||
        Reflect.ownKeys(options).some(key => typeof key !== "string" ||
          !["enabled", "fetchImpl", "provideBearer", "signal", "timeoutMs"].includes(key))) throw rejected();
    const { fetchImpl, provideBearer, signal } = options;
    const timeoutMs = options.timeoutMs ?? 3000;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS ||
        (signal !== undefined && !(signal instanceof AbortSignal))) throw rejected();

    return Object.freeze({
      authorization: Object.freeze({
        spreadsheetId: GLOVO_SHEETS_REQUEST.spreadsheetId,
        scope: GLOVO_SHEETS_REQUEST.scope
      }),
      async getValues(request: typeof GLOVO_SHEETS_REQUEST) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let controller: AbortController | undefined;
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        let response: Response | undefined;
        let abort: (() => void) | undefined;
        try {
          if (!record(request) || !exactKeys(request, Object.keys(GLOVO_SHEETS_REQUEST)) ||
              Object.entries(GLOVO_SHEETS_REQUEST).some(([key, value]) => request[key as keyof typeof request] !== value) ||
              new URL(request.url).origin !== "https://sheets.googleapis.com" ||
              new URL(request.url).protocol !== "https:" || request.method !== "GET" || signal?.aborted) throw rejected();

          const active = new AbortController();
          controller = active;
          const stopped = new Promise<never>((_, reject) => {
            abort = () => { active.abort(); reject(rejected()); };
            signal?.addEventListener("abort", abort, { once: true });
            timer = setTimeout(abort, timeoutMs);
          });
          const bounded = async <T,>(operation: () => Promise<T>): Promise<T> => {
            if (active.signal.aborted) throw rejected();
            const result = await Promise.race([operation(), stopped]);
            if (active.signal.aborted) throw rejected();
            return result;
          };
          const bearer = await bounded(() => provideBearer(active.signal));
          // Opaque bearer syntax only; no JWT decoding/auth claim or token refresh.
          if (!record(bearer) || !exactKeys(bearer, ["token", "expiresAt"]) ||
              typeof bearer.token !== "string" || bearer.token.length > 4096 ||
              !/^[A-Za-z0-9._~+/-]+=*$/.test(bearer.token) || !Number.isSafeInteger(bearer.expiresAt) ||
              bearer.expiresAt <= Date.now() + timeoutMs || bearer.expiresAt > Date.now() + MAX_TOKEN_LIFETIME_MS) throw rejected();
          const token = bearer.token;
          response = await bounded(async () => {
            const received = await fetchImpl(GLOVO_SHEETS_REQUEST.url, {
              method: "GET", redirect: "error", credentials: "omit", cache: "no-store",
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: active.signal
            });
            // Dispose late responses even when an injected fetch ignores abort.
            if (active.signal.aborted) { discard(received.body); throw rejected(); }
            return received;
          });
          const contentType = response.headers.get("content-type");
          const length = response.headers.get("content-length");
          const encoding = response.headers.get("content-encoding");
          if (response.status !== 200 || response.url !== GLOVO_SHEETS_REQUEST.url || response.redirected !== false ||
              contentType === null || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType) ||
              (encoding !== null && encoding !== "identity") ||
              (length !== null && (!/^[1-9]\d*$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > MAX_BYTES)) ||
              !response.body) throw rejected();

          reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8", { fatal: true });
          let bytes = 0, chunks = 0, text = "";
          while (true) {
            const part = await bounded(() => reader!.read());
            if (part.done) break;
            if (!(part.value instanceof Uint8Array) || part.value.byteLength === 0 ||
                ++chunks > MAX_CHUNKS || (bytes += part.value.byteLength) > MAX_BYTES) throw rejected();
            text += decoder.decode(part.value, { stream: true });
          }
          if (bytes === 0 || (length !== null && bytes !== Number(length))) throw rejected();
          text += decoder.decode();
          const body: unknown = JSON.parse(text);
          // Only the ValueRange envelope is checked here. The existing D291
          // validator owns matrix, types, lineage and independent coverage checks.
          if (!record(body) || !exactKeys(body, ["range", "majorDimension", "values"]) ||
              typeof body.range !== "string" || !/^'Дані'!A5:I[1-9]\d*$/.test(body.range) ||
              body.majorDimension !== "ROWS" || !Array.isArray(body.values)) throw rejected();
          return { status: 200, url: GLOVO_SHEETS_REQUEST.url, redirected: false, contentType, body };
        } catch {
          // No cause, source body, financial amount, URL or token in diagnostics.
          throw rejected();
        } finally {
          if (timer !== undefined) clearTimeout(timer);
          if (abort) signal?.removeEventListener("abort", abort);
          controller?.abort();
          try {
            if (reader) {
              try { void reader.cancel().catch(() => {}); } catch { /* sanitized */ }
              try { reader.releaseLock(); } catch { /* Pending ignored-abort read. */ }
            } else if (response) discard(response.body);
          } catch { /* An injected response can also throw during cleanup. */ }
        }
      }
    });
  } catch {
    throw rejected();
  }
}
