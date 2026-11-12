import "server-only";
import { createPrivateKey, sign } from "node:crypto";
import { glovoPrivateJson, glovoRecord } from "./glovo-private-http";

export const GLOVO_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const fail = () => new Error("GLOVO_AUTH_UNAVAILABLE");

/** Uses only the existing server credential. No discovery, refresh persistence,
 * delegation, write scope, custom endpoint, logs, or credential fallback. */
export async function glovoGoogleBearer(serviceAccountJson: string | undefined, fetchImpl: typeof fetch) {
  try {
    if (!serviceAccountJson || serviceAccountJson.length > 32768) throw fail();
    const account: unknown = JSON.parse(serviceAccountJson);
    if (!glovoRecord(account) || account.type !== "service_account" ||
        typeof account.client_email !== "string" || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(account.client_email) ||
        typeof account.private_key !== "string" ||
        (account.token_uri !== undefined && account.token_uri !== TOKEN_URL)) throw fail();
    const key = createPrivateKey(account.private_key);
    if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) throw fail();
    const issuedAt = Math.floor(Date.now() / 1000);
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: account.client_email,
      scope: GLOVO_READONLY_SCOPE, aud: TOKEN_URL, iat: issuedAt, exp: issuedAt + 300 })}`;
    const assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), key).toString("base64url")}`;
    const result = await glovoPrivateJson(fetchImpl, TOKEN_URL, { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString() }, 32768);
    if (!glovoRecord(result) || result.token_type !== "Bearer" || typeof result.access_token !== "string" ||
        result.access_token.length > 4096 || !/^[A-Za-z0-9._~+/-]+=*$/.test(result.access_token) ||
        typeof result.expires_in !== "number" || !Number.isSafeInteger(result.expires_in) || result.expires_in < 30) throw fail();
    // OAuth tokens can live an hour; this request-local handle is valid <=5 min.
    return { token: result.access_token, expiresAt: Date.now() + Math.min(result.expires_in, 300) * 1000 };
  } catch { throw fail(); }
}
