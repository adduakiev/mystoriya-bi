type PendingRefresh = { requestId: string } | { uncertain: true };
type PendingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type RefreshStore = { read(): PendingRefresh | null; write(value: PendingRefresh | null): void };
const storageKey = "bi-sales-refresh-pending-v1";
let remembered: PendingRefresh | null = null;
let persistenceMayBeStale = false;

// Only a request identifier or an uncertainty marker is retained, never credentials.
// Do not expire the marker: elapsed time does not prove that a trigger failed.
export function createSalesRefreshStore(storage?: PendingStorage): RefreshStore {
  return {
    read() {
      // A failed set/remove leaves older bytes behind. Keep memory authoritative
      // for this page lifetime, including newly mounted component/store instances.
      if (persistenceMayBeStale) return remembered;
      let raw: string | null | undefined;
      try { raw = storage?.getItem(storageKey); } catch { return remembered; }
      try {
        if (raw) {
          const value = JSON.parse(raw);
          remembered = typeof value?.requestId === "string" && /^[1-9]\d{0,17}$/.test(value.requestId)
            ? { requestId: value.requestId } : { uncertain: true };
        }
      } catch { remembered ??= { uncertain: true }; }
      return remembered;
    },
    write(value) {
      remembered = value;
      try {
        if (value) storage?.setItem(storageKey, JSON.stringify(value));
        else storage?.removeItem(storageKey);
      } catch { persistenceMayBeStale = true; }
    }
  };
}

export const pendingRefreshMessage = "Результат ще не підтверджено. Кнопка повторно перевірить це оновлення.";
export const uncertainRefreshMessage = "Запуск міг відбутися, але номер запиту не отримано. Потрібна перевірка запуску перед новим оновленням.";

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  if (!response.ok || !value || typeof value !== "object" || Array.isArray(value) ||
      (value as Record<string, unknown>).ok !== true) throw new Error("Unverified response");
  return value as Record<string, unknown>;
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Cancelled")); return; }
    const cancel = () => { clearTimeout(timer); reject(new Error("Cancelled")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

type RefreshResult = { status: "success"; cutoffDate: string } | { status: "pending" | "failed"; message: string };

export async function checkSalesRefresh({ store, signal, fetchImpl = fetch, now = Date.now, wait = delay }: {
  store: RefreshStore;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
  now?: () => number;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<RefreshResult> {
  try {
    signal.throwIfAborted();
    let pending = store.read();
    if (pending && "uncertain" in pending) return { status: "pending", message: uncertainRefreshMessage };
    if (!pending) {
      // Persist BEFORE sending: abort/unmount/lost response must not permit a second trigger.
      store.write({ uncertain: true });
      const response = await fetchImpl("/api/sales-refresh", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: "{}", signal
      });
      // These route responses occur before any RPC. Other failures may follow dispatch.
      if (response.status === 401 || response.status === 403) {
        store.write(null);
        return { status: "failed", message: "Немає доступу до оновлення. Перевірте вхід у звіт." };
      }
      const start = await readResponse(response);
      const requestId = String(start.requestId ?? "");
      if (!/^[1-9]\d{0,17}$/.test(requestId)) throw new Error("Missing request receipt");
      pending = { requestId };
      store.write(pending);
    }
    const requestId = pending.requestId;
    const deadline = now() + 180_000;
    let transientFailures = 0;
    while (now() < deadline) {
      await wait(2_000, signal);
      let status: Record<string, unknown>;
      try {
        status = await readResponse(await fetchImpl(`/api/sales-refresh/status?requestId=${encodeURIComponent(requestId)}`, {
          cache: "no-store", signal
        }));
        transientFailures = 0;
      } catch (error) {
        if (signal.aborted || ++transientFailures >= 3) throw error;
        continue;
      }
      if (String(status.requestId) !== requestId) throw new Error("Wrong request receipt");
      if (status.done !== true) continue;
      if (status.status === "failed") {
        store.write(null);
        return { status: "failed", message: "Оновлення не виконано. Наявний звіт збережено." };
      }
      if (status.status !== "success" || status.atomic !== true) throw new Error("Unverified completion");
      const confirmed = await readResponse(await fetchImpl("/api/sales-refresh", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedRequestId: requestId }), signal
      }));
      if (confirmed.status !== "success" || confirmed.atomic !== true || String(confirmed.requestId) !== requestId ||
          typeof confirmed.cutoffDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(confirmed.cutoffDate)) {
        throw new Error("Unverified confirmation");
      }
      store.write(null);
      return { status: "success", cutoffDate: confirmed.cutoffDate };
    }
  } catch { /* An unavailable status is not a failed import. Keep its receipt for retry. */ }
  const pending = store.read();
  return { status: "pending", message: pending && "uncertain" in pending ? uncertainRefreshMessage : pendingRefreshMessage };
}
