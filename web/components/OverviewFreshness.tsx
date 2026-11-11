"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FRESHNESS_MESSAGES, reportFreshness, type ReportObservation, type WarehouseObservation } from "@/lib/overview-freshness";
import { pollOverviewStatus } from "@/lib/overview-poll";

export function OverviewFreshness({ report, warehouse }: { report: ReportObservation; warehouse: WarehouseObservation }) {
  const router = useRouter();
  const [observed, setObserved] = useState(warehouse);
  const [error, setError] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [retry, setRetry] = useState(0);
  const lastRefresh = useRef<number | null>(null);
  const current = useRef({report, warehouse});
  current.current = {report, warehouse};
  // Never remount on router.refresh: preserve the finite polling/read budget.
  useEffect(() => {
    setExhausted(false);
    return pollOverviewStatus({
      receive: value => {
        setError(false);
        setObserved(previous => previous.cutoff && value.cutoff && previous.cutoff > value.cutoff ? previous : value);
        const state = current.current;
        const freshness = reportFreshness(state.report, value);
        if ((value.version !== state.warehouse.version || freshness === "stale" || !state.report.sql)
          && (lastRefresh.current === null || Date.now() - lastRefresh.current >= 60_000)) {
          lastRefresh.current = Date.now();
          router.refresh();
        }
      },
      failed: () => setError(true),
      exhausted: () => setExhausted(true)
    });
    // Props are read through current so a server refresh cannot reset polling.
  }, [retry]);
  const latest = observed.cutoff && (!warehouse.cutoff || observed.cutoff >= warehouse.cutoff) ? observed : warehouse;
  const coherence = reportFreshness(report, latest);
  const freshness = error && coherence !== "stale" ? "unknown" : coherence;
  return (
    <section className="panel" role="status" aria-live="polite" data-report-freshness={freshness}>
      <b>{FRESHNESS_MESSAGES[freshness]}</b>
      <p>Warehouse: {latest.cutoff ?? "UNKNOWN"} · джерело звіту: {report.latest || "UNKNOWN"} · cutoff звіту: {report.cutoff || "UNKNOWN"}</p>
      {error && <p>Помилка або перевищено час перевірки · попередній стан збережено, актуальність UNKNOWN.</p>}
      {exhausted && <p>Автоматичну перевірку завершено; для наступної перевірки натисніть кнопку.</p>}
      <button type="button" disabled={!exhausted && !error} onClick={() => {
        setError(false);
        setExhausted(false);
        lastRefresh.current = Date.now();
        router.refresh();
        setRetry(value => value + 1);
      }}>Повторити перевірку</button>
    </section>
  );
}
