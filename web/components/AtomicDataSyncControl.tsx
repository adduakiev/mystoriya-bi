"use client";

import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некоректна відповідь оновлення.");
  const result = value as Record<string, unknown>;
  if (!response.ok || result.ok !== true) throw new Error(typeof result.error === "string" ? result.error : "Оновлення поки недоступне.");
  return result;
}

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new Error("Cancelled")); return; }
    const cancel = () => { clearTimeout(timer); reject(new Error("Cancelled")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, ms);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

export function AtomicDataSyncControl({ initialCutoff }: { initialCutoff: string | null }) {
  const router = useRouter();
  const active = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  useEffect(() => () => active.current?.abort(), []);

  async function refreshData() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setPhase("running"); setMessage("Перевіряю й оновлюю дані…");
    try {
      const start = await readResponse(await fetch("/api/sales-refresh", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: "{}", signal: controller.signal
      }));
      const requestId = String(start.requestId ?? "");
      if (!/^[1-9]\d{0,17}$/.test(requestId)) throw new Error("Не отримано номер оновлення.");
      const deadline = Date.now() + 180_000;
      let transientFailures = 0;
      while (Date.now() < deadline) {
        await delay(2_000, controller.signal);
        let status: Record<string, unknown>;
        try {
          status = await readResponse(await fetch(`/api/sales-refresh/status?requestId=${encodeURIComponent(requestId)}`, {
            cache: "no-store", signal: controller.signal
          }));
          transientFailures = 0;
        } catch (error) {
          if (controller.signal.aborted || ++transientFailures >= 3) throw error;
          continue;
        }
        if (String(status.requestId) !== requestId) throw new Error("Не вдалося звірити статус цього оновлення.");
        if (status.done !== true) {
          if (status.status === "unknown") setMessage("Уточнюємо результат оновлення…");
          continue;
        }
        if (status.status !== "success" || status.atomic !== true) throw new Error("Оновлення не завершене. Наявний звіт збережено.");
        const confirmed = await readResponse(await fetch("/api/sales-refresh", {
          method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completedRequestId: requestId }), signal: controller.signal
        }));
        if (confirmed.status !== "success" || confirmed.atomic !== true || String(confirmed.requestId) !== requestId) {
          throw new Error("Результат ще не підтверджено.");
        }
        setPhase("success");
        setMessage(`Готово · дані по ${String(confirmed.cutoffDate)}`);
        router.refresh();
        return;
      }
      throw new Error("Оновлення ще триває. Повторна перевірка доступна кнопкою оновлення.");
    } catch (error) {
      if (!controller.signal.aborted) {
        setPhase("error");
        setMessage(error instanceof Error ? error.message : "Не вдалося перевірити оновлення.");
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
