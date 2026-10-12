"use client";

import { Check, RefreshCw, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Phase = "idle" | "starting" | "running" | "success" | "error";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatCutoff(value: string | null | undefined): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

export function DataSyncControl({ initialCutoff }: { initialCutoff: string | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const busy = phase === "starting" || phase === "running";

  async function refreshData() {
    if (busy) return;

    setPhase("starting");
    setMessage("Запускаю…");

    try {
      const startResponse = await fetch("/api/data-sync", {
        method: "POST",
        cache: "no-store"
      });
      const start = await startResponse.json();

      if (!startResponse.ok || !start?.ok) {
        throw new Error(start?.error ?? "Не вдалося запустити синхронізацію.");
      }

      const watchFrom =
        start.alreadyRunning && start.startedAt
          ? String(start.startedAt)
          : String(start.requestedAt ?? new Date().toISOString());

      setPhase("running");
      setMessage(start.alreadyRunning ? "Оновлення вже йде…" : "Оновлюю Google Sheet…");

      const deadline = Date.now() + 90_000;

      while (Date.now() < deadline) {
        await sleep(1_800);

        const statusResponse = await fetch(
          `/api/data-sync/status?after=${encodeURIComponent(watchFrom)}`,
          { cache: "no-store" }
        );
        const status = await statusResponse.json();

        if (!statusResponse.ok || !status?.ok) {
          throw new Error(status?.error ?? "Не вдалося перевірити синхронізацію.");
        }

        if (!status.done) {
          if (status.status === "running") {
            setMessage("Синхронізація…");
          }
          continue;
        }

        if (status.status === "failed") {
          throw new Error("Синхронізація завершилась помилкою.");
        }

        setPhase("success");
        setMessage(
          status.cutoffDate
            ? `Готово · дані по ${formatCutoff(status.cutoffDate)}`
            : "Готово · дані оновлено"
        );

        router.refresh();

        window.setTimeout(() => {
          setPhase("idle");
          setMessage("");
        }, 5_000);

        return;
      }

      throw new Error("Оновлення триває довше очікуваного. Перевір через хвилину.");
    } catch (error) {
      console.error(error);
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Не вдалося оновити дані.");

      window.setTimeout(() => {
        setPhase("idle");
        setMessage("");
      }, 8_000);
    }
  }

  const title = busy
    ? "Синхронізація даних триває"
    : `Оновити дані з Google Sheets · зараз дані по ${formatCutoff(initialCutoff)}`;

  return (
    <div className="data-sync-control">
      <button
        type="button"
        className={`data-sync-button ${phase}`}
        onClick={refreshData}
        disabled={busy}
        title={title}
        aria-label="Оновити дані з Google Sheets"
      >
        {phase === "success" ? (
          <Check size={13} />
        ) : phase === "error" ? (
          <TriangleAlert size={13} />
        ) : (
          <RefreshCw size={13} className={busy ? "sync-spin" : undefined} />
        )}
      </button>

      {message ? (
        <small className={`data-sync-message ${phase}`}>{message}</small>
      ) : null}
    </div>
  );
}
