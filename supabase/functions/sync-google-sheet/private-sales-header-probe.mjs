// REVIEW ONLY. Explicit server dependency; no deployed entrypoint imports this file.
// A future authorized server caller supplies an existing secret-manager value and
// fetch implementation. No default transport, environment lookup or live CLI.
const ISSUER = "myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const RANGE = "'Данние короткі'!A1:N1";
const SHEET_URL = "https://sheets.googleapis.com/v4/spreadsheets/" +
  "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA/values/" + encodeURIComponent(RANGE) +
  "?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
// Zero-based positions, kept in parity with the pure source-safety preflight.
const REQUIRED = ["Обліковий день", "Зі складу", "Бренд", "Власність", "Доставка",
  "Тип замовлення", "Сума зі знижкою, грн.", "Чеків", "Націнка, грн."];
const LIMIT = 32768;
const reject = () => { throw new Error("FAIL"); };
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, required, optional = []) => record(value) &&
  required.every(key => Object.hasOwn(value, key)) &&
  Reflect.ownKeys(value).every(key => required.includes(key) || optional.includes(key));
const base64url = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

// Native JSON syntax validation plus duplicate-key/depth rejection. JSON.parse
// alone silently accepts repeated metadata keys (including escaped aliases).
function parseJson(text) {
  const value = JSON.parse(text);
  const stack = [];
  for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}[\]]/g)) {
    const token = match[0];
    if (token === "{" || token === "[") {
      stack.push(token === "{" ? new Set() : null);
      if (stack.length > 8) reject();
    } else if (token === "}" || token === "]") stack.pop();
    else if (/^[ \t\r\n]*:/.test(text.slice(match.index + token.length))) {
      const keys = stack.at(-1), key = JSON.parse(token);
      if (!keys || keys.has(key)) reject();
      keys.add(key);
    }
  }
  return value;
}

function credential(secret) {
  if (typeof secret !== "string" || secret.length > 16384) reject();
  const account = parseJson(secret);
  if (!exactKeys(account, ["type", "project_id", "client_email", "token_uri", "private_key_id", "private_key"],
    ["client_id", "auth_uri", "auth_provider_x509_cert_url", "client_x509_cert_url", "universe_domain"]) ||
    !Object.values(account).every(value => typeof value === "string") ||
    account.type !== "service_account" || account.project_id !== "myastoriya-bi" ||
    account.client_email !== ISSUER || account.token_uri !== TOKEN_URL ||
    (account.universe_domain !== undefined && account.universe_domain !== "googleapis.com") ||
    typeof account.private_key_id !== "string" || !/^[a-f0-9]{40}$/.test(account.private_key_id) ||
    typeof account.private_key !== "string" ||
    !/^-----BEGIN PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PRIVATE KEY-----\r?\n?$/.test(account.private_key)) reject();
  return account;
}

async function assertion(secret, guard) {
  const account = credential(secret);
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  guard();
  if (key.algorithm.modulusLength < 2048) reject();
  const iat = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const head = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: account.private_key_id })));
  const body = base64url(encoder.encode(JSON.stringify({ iss: ISSUER, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 300 })));
  const input = `${head}.${body}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(input));
  guard();
  return `${input}.${base64url(new Uint8Array(signature))}`;
}

async function json(fetchImpl, url, init, signal, guard) {
  let reader;
  try {
    guard();
    const response = await fetchImpl(url, { ...init, signal, redirect: "error", credentials: "omit", cache: "no-store" });
    guard();
    if (response.status !== 200 || response.redirected ||
      ["error", "opaque", "opaqueredirect"].includes(response.type) ||
      (response.url && response.url !== url) ||
      !/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?\s*$/i.test(response.headers.get("content-type") ?? "")) reject();
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMIT)) reject();
    reader = response.body?.getReader();
    if (!reader) reject();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      guard();
      if (typeof done !== "boolean" || (done && value !== undefined)) reject();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength === 0 || size + value.byteLength > LIMIT) reject();
      size += value.byteLength;
      chunks.push(value.slice());
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value = parseJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    guard();
    return value;
  } finally {
    // Cancellation must never extend the operation if a transport ignores abort.
    // No upstream value/cause is attached to cancellation or public results.
    if (reader) {
      try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* sanitized */ }
      try { reader.releaseLock(); } catch { /* sanitized */ }
    }
  }
}

/**
 * Isolated header access preparation, NOT freshness/attestation or a write gate.
 * Only {code: "PASS" | "FAIL", timestamp: ISO UTC} can leave this boundary.
 * Both inputs are trusted server dependencies, never HTTP/browser/CLI values.
 * Unknown options fail closed; the 30s total budget cannot be changed by callers.
 */
export async function probePrivateSalesHeader(secret, options) {
  const started = Date.now();
  const timestamp = new Date(started).toISOString();
  const result = code => Object.freeze({ code, timestamp });
  let timer, signal, abort, controller, active = true;
  try {
    if (typeof window !== "undefined" || typeof document !== "undefined" || typeof WorkerGlobalScope !== "undefined" ||
      !exactKeys(options, ["fetchImpl"], ["signal"]) || typeof options.fetchImpl !== "function") reject();
    const fetchImpl = options.fetchImpl;
    const requestedSignal = options.signal;
    if (requestedSignal !== undefined && !(requestedSignal instanceof AbortSignal)) reject();
    signal = requestedSignal;
    controller = new AbortController();
    const guard = () => {
      if (!active || controller.signal.aborted || Date.now() - started >= 30000) reject();
    };
    const stopped = new Promise(resolve => {
      abort = () => { active = false; controller.abort(); resolve("FAIL"); };
      timer = setTimeout(abort, Math.max(0, 30000 - (Date.now() - started)));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
    });
    const operation = (async () => {
      guard();
      const signed = await assertion(secret, guard);
      guard();
      const token = await json(fetchImpl, TOKEN_URL, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: signed })
      }, controller.signal, guard);
      if (!exactKeys(token, ["access_token", "token_type", "expires_in"], ["scope"]) ||
        typeof token.access_token !== "string" || token.access_token.length > 8192 ||
        !/^[A-Za-z0-9._~+/-]+=*$/.test(token.access_token) || token.token_type !== "Bearer" ||
        !Number.isInteger(token.expires_in) || token.expires_in < 60 || token.expires_in > 3600 ||
        (token.scope !== undefined && token.scope !== SCOPE)) reject();
      guard();
      const header = await json(fetchImpl, SHEET_URL, {
        method: "GET", headers: { Authorization: `Bearer ${token.access_token}` }
      }, controller.signal, guard);
      if (!exactKeys(header, ["range", "majorDimension", "values"]) || header.range !== RANGE ||
        header.majorDimension !== "ROWS" || !Array.isArray(header.values) || header.values.length !== 1 ||
        !Array.isArray(header.values[0]) || header.values[0].length !== 14 ||
        header.values[0].some(cell => typeof cell !== "string" || !cell.isWellFormed() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(cell)) ||
        REQUIRED.some((label, index) => header.values[0][index + 5].normalize("NFC").replace(/\s+/g, " ").trim() !== label)) reject();
      guard();
      return "PASS";
    })().catch(() => "FAIL");
    // Race, rather than abort alone: even an uncooperative fetch/read cannot
    // keep the public promise pending. Guards prohibit late second requests.
    return result(await Promise.race([operation, stopped]));
  } catch {
    return result("FAIL");
  } finally {
    active = false;
    clearTimeout(timer);
    try { signal?.removeEventListener("abort", abort); } catch { /* sanitized */ }
    controller?.abort();
  }
}
