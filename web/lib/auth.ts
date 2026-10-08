export const AUTH_COOKIE_NAME = "myastoriya_bi_access";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function createAccessToken(password: string): Promise<string> {
  const payload = new TextEncoder().encode(`myastoriya-bi-access-v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}
