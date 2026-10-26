import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { DataSyncControl } from "@/components/DataSyncControl";
import { loadSalesDataStatus } from "@/lib/data/source";

const OFFICIAL_MYASTORIYA_LOGO =
  "https://myastoriya.com.ua/frontend/myastoriya/dist/images/logo.png";

function formatCutoff(value: string | null): string {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) return "—";

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function SidebarStatusPending() {
  return (
    <div className="data-health" role="status">
      <span className="data-health-dot" aria-hidden="true" />
      <div className="data-health-content">
        <b>Дані по —</b>
        <span>Статус даних перевіряється…</span>
      </div>
    </div>
  );
}

export async function SidebarSalesStatus() {
  const status = await loadSalesDataStatus();
  const cutoff = formatCutoff(status.cutoffDate);
  const isWarehouse = status.source === "supabase" && status.status === "success" && cutoff !== "—";

  return (
    <div className={isWarehouse ? "data-health ok" : "data-health"} role="status">
      <span className="data-health-dot" aria-hidden="true" />
      <div className="data-health-content">
        <b>Дані по {cutoff}</b>
        <span>{isWarehouse ? "Warehouse · статус отримано" : "Статус даних недоступний"}</span>
      </div>
      <DataSyncControl initialCutoff={cutoff === "—" ? null : status.cutoffDate} />
    </div>
  );
}

export function SidebarBrand() {
  return (
    <div className="brand brand-stack">
      <div className="brand-official">
        <img
          src={OFFICIAL_MYASTORIYA_LOGO}
          alt="М'ЯСТОРІЯ"
          className="brand-logo-official"
        />
        <span>CONTROL CENTER</span>
      </div>

      <Suspense fallback={<SidebarStatusPending />}>
        <SidebarSalesStatus />
      </Suspense>

      <form action="/api/auth/logout" method="post">
        <button className="logout-button" type="submit" title="Вийти з Control Center">
          <LogOut size={14} />
          <span>Вийти</span>
        </button>
      </form>
    </div>
  );
}
