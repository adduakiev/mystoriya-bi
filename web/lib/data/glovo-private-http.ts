import "server-only";

const rejected = () => new Error("GLOVO_PRIVATE_READ_REJECTED");

/** Bounded, fully consumed private JSON responses. Never return upstream errors. */
export async function glovoPrivateJson(fetchImpl: typeof fetch, url: string, init: RequestInit,
  maxBytes = 1024 * 1024): Promise<unknown> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stopped = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(rejected()); }, 5000);
  });
  const bounded = <T,>(task: Promise<T>) => Promise.race([task, stopped]);
  try {
    const received = await bounded(fetchImpl(url, { ...init, redirect: "error", credentials: "omit",
      cache: "no-store", signal: controller.signal }).then(result => {
        if (controller.signal.aborted) { void result.body?.cancel().catch(() => {}); throw rejected(); }
        return result;
      }));
    response = received;
    const length = received.headers.get("content-length");
    if (received.status !== 200 || received.url !== url || received.redirected || !received.body ||
        !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(received.headers.get("content-type") ?? "") ||
        (length !== null && (!/^[1-9]\d*$/.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes))) throw rejected();
    reader = received.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "", bytes = 0, chunks = 0;
    while (true) {
      const part = await bounded(reader.read());
      if (part.done) break;
      if (!(part.value instanceof Uint8Array) || !part.value.byteLength || ++chunks > 4096 ||
          (bytes += part.value.byteLength) > maxBytes) throw rejected();
      text += decoder.decode(part.value, { stream: true });
    }
    // Fetch may transparently decompress Google responses; length is comparable
    // only for identity encoding. Decoded bytes are always independently capped.
    if (!bytes || (length !== null && !received.headers.get("content-encoding") && bytes !== Number(length))) throw rejected();
    return JSON.parse(text + decoder.decode());
  } catch { throw rejected(); }
  finally {
    if (timer) clearTimeout(timer);
    controller.abort();
    try {
      if (reader) { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      else void response?.body?.cancel().catch(() => {});
    } catch { /* Sanitized cleanup. */ }
  }
}

export const glovoRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
