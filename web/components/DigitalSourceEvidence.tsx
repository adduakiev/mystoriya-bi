import type { PeriodEvidence } from "@/lib/data/meta-social-contract";
import { formatMetric } from "@/lib/digital-quality";

export function DigitalSourceEvidence({name, evidence: e}: {name: string; evidence: PeriodEvidence}) {
  return <div className="lfl-banner">
    <b>{name} · {e.status}</b> · {e.from || "—"} — {e.to || "—"}. Рядки періоду: {formatMetric(e.rows)};
    спостережені дати: {formatMetric(e.observedDates)}; остання дата джерела: {e.sourceLatest || "—"}.
    Свіжість: {e.freshness} (поріг {e.freshnessDays} дні). Повнота: {e.coverage}.
    {e.status === "WAITING" && " Немає підтверджених вимірювань за період."}
  </div>;
}
