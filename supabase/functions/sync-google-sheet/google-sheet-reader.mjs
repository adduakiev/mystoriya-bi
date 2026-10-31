// Prepared only: do not wire into the legacy batch writer before the atomic gate.
// No import-time I/O, database dependency, logging, or credential persistence.
export const SERVICE_ACCOUNT = "myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com";
export const SPREADSHEET_ID = "1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA";
const SHEET = "Данние короткі";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const encoder = new TextEncoder();
const fail = (code) => { throw new Error(code); };

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function credentials(secret) {
  try {
    if (typeof secret !== "string" || secret.length > 16384) fail();
    const value = JSON.parse(secret);
    if (value.type !== "service_account" || value.project_id !== "myastoriya-bi" ||
        value.client_email !== SERVICE_ACCOUNT || value.token_uri !== TOKEN_URL ||
        typeof value.private_key_id !== "string" || !/^[a-f0-9]{40}$/.test(value.private_key_id) ||
        typeof value.private_key !== "string" ||
        !/^-----BEGIN PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END PRIVATE KEY-----\s*$/.test(value.private_key)) fail();
    return value;
  } catch {
    fail("GOOGLE_AUTH_INVALID_SECRET");
  }
}

async function jsonRequest(fetchImpl, url, init, maxBytes, code) {
  // Include body consumption in the deadline; never include upstream text in errors.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetchImpl(url, { ...init, redirect: "error", signal: controller.signal });
    if (!response.ok) fail();
    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) fail();
    const reader = response.body?.getReader();
    if (!reader) fail();
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) fail();
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(code);
  } finally {
    clearTimeout(timer);
  }
}

async function accessToken(secret, fetchImpl) {
  const account = credentials(secret);
  let assertion;
  try {
    const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, "")), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    if (key.algorithm.modulusLength < 2048) fail();
    const iat = Math.floor(Date.now() / 1000);
    const header = base64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT", kid: account.private_key_id })));
    const claims = base64url(encoder.encode(JSON.stringify({ iss: SERVICE_ACCOUNT, scope: SCOPE,
      aud: TOKEN_URL, iat, exp: iat + 300 })));
    const input = `${header}.${claims}`;
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(input));
    assertion = `${input}.${base64url(new Uint8Array(signature))}`;
  } catch {
    fail("GOOGLE_AUTH_SIGNING_FAILED");
  }
  const token = await jsonRequest(fetchImpl, TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
  }, 16384, "GOOGLE_AUTH_TOKEN_FAILED");
  if (typeof token?.access_token !== "string" || !/^[A-Za-z0-9._~+/-]+=*$/.test(token.access_token) ||
      token.access_token.length > 8192 || typeof token.token_type !== "string" || token.token_type.toLowerCase() !== "bearer" ||
      !Number.isInteger(token.expires_in) || token.expires_in < 60 || token.expires_in > 3600) {
    fail("GOOGLE_AUTH_INVALID_TOKEN");
  }
  return token.access_token;
}

/** Read the fixed private source, never arbitrary caller-selected URLs or sheets.
 * Production integration (not activated): pass Deno.env.get("GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON").
 * probe=true reads only the header for a future separately authorized no-write check.
 * The returned matrix must still pass source preflight and atomic-import validation.
 */
export async function readPrivateSalesSheet(secret, { probe = false, fetchImpl = fetch } = {}) {
  const token = await accessToken(secret, fetchImpl);
  const range = `'${SHEET}'!${probe ? "A1:N1" : "A:N"}`;
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}`);
  url.search = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER" }).toString();
  const result = await jsonRequest(fetchImpl, url.toString(), {
    method: "GET", headers: { Authorization: `Bearer ${token}` }
  }, probe ? 32768 : 32 * 1024 * 1024, "GOOGLE_SHEETS_READ_FAILED");
  if (result?.majorDimension !== "ROWS" || !Array.isArray(result.values) || !result.values.length ||
      (probe && result.values.length !== 1)) fail("GOOGLE_SHEETS_INVALID_VALUES");
  return result.values.map(row => {
    if (!Array.isArray(row) || row.length > 14) fail("GOOGLE_SHEETS_INVALID_VALUES");
    return Array.from({ length: 14 }, (_, i) => {
      const value = row[i];
      if (value === undefined || value === null) return ""; // missing stays missing, never zero
      if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
        fail("GOOGLE_SHEETS_INVALID_VALUES");
      }
      return String(value);
    });
  });
}
