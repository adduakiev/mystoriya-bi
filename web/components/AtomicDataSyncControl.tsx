"use client";

import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkSalesRefresh, createSalesRefreshStore, pendingRefreshMessage, uncertainRefreshMessage, type RefreshStore } from "@/lib/sales-refresh-client";

export function AtomicDataSyncControl({ initialCutoff }: { initialCutoff: string | null }) {
  const router = useRouter();
  const active = useRef<AbortController | null>(null);
  const store = useRef<RefreshStore | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let storage: Storage | undefined;
    try { storage = window.sessionStorage; } catch { /* Browser storage can be disabled. */ }
    store.current = createSalesRefreshStore(storage);
    const pending = store.current.read();
    if (pending) setMessage("uncertain" in pending ? uncertainRefreshMessage : pendingRefreshMessage);
    return () => active.current?.abort();
  }, []);

  async function refreshData() {
    if (active.current || !store.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPhase("running"); setMessage("Перевіряю й оновлюю дані…");
    try {
      const result = await checkSalesRefresh({ store: store.current, signal: controller.signal });
      if (controller.signal.aborted) return;
      if (result.status === "success") {
        setPhase("success");
        setMessage(`Готово · дані по ${result.cutoffDate}`);
        router.refresh();
      } else {
        setPhase(result.status === "failed" ? "error" : "idle");
        setMessage(result.message);
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  return <div className="data-sync-control" data-warehouse-cutoff={initialCutoff ?? undefined}>
    <button type="button" className={`data-sync-button ${phase}`} disabled={phase === "running"}
      onClick={refreshData} title={`Оновити дані з Google Sheets · дані по ${initialCutoff ?? "—"}`}
      aria-label="Оновити дані з Google Sheets">
      {phase === "success" ? <Check size={13} /> : phase === "error" ? <TriangleAlert size={13} /> :
        <RefreshCw size={13} className={phase === "running" ? "sync-spin" : undefined} />}
    </button>
    {message ? <small className={`data-sync-message ${phase}`} role="status">{message}</small> : null}
  </div>;
}
