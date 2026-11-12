import { validDate, type WarehouseObservation } from "./overview-freshness";

// Finite read budget per mount/retry. Serial requests, bounded timeout and no POST.
export const STATUS_DELAYS = [0, 5_000, 15_000, 30_000, 60_000, 60_000, 60_000] as const;
export function pollOverviewStatus({ receive, failed, exhausted, fetcher = fetch,
  schedule = setTimeout, cancel = clearTimeout }: {
  receive: (value: WarehouseObservation) => void;
  failed: () => void;
  exhausted: () => void;
  fetcher?: typeof fetch;
  schedule?: typeof setTimeout;
  cancel?: typeof clearTimeout;
}) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  let controller: AbortController | undefined;
  let attempt = 0;
  async function check() {
    controller = new AbortController();
    const timeout = schedule(() => controller?.abort(), 8_000);
    try {
      const response = await fetcher("/api/overview/status", {
        method: "GET", cache: "no-store", credentials: "same-origin", redirect: "error", signal: controller.signal
      });
      if (!response.ok) throw Error("Status unavailable");
      const value = await response.json();
      if (!validDate(value?.cutoff) || typeof value.version !== "string" || value.version.length > 256) throw Error("Invalid status");
      if (!stopped) receive({cutoff: value.cutoff, version: value.version});
    } catch {
      if (!stopped) failed();
    } finally {
      cancel(timeout);
      attempt += 1;
      if (!stopped && attempt < STATUS_DELAYS.length) timer = schedule(check, STATUS_DELAYS[attempt]);
      else if (!stopped) exhausted();
    }
  }
  timer = schedule(check, STATUS_DELAYS[0]);
  return () => { stopped = true; cancel(timer); controller?.abort(); };
}
