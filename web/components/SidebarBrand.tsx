import { LogOut } from "lucide-react";
import { loadSalesDataStatus } from "@/lib/data/source";

const OFFICIAL_MYASTORIYA_LOGO =
  "https://myastoriya.com.ua/frontend/myastoriya/dist/images/logo.png";

function formatCutoff(value: string | null): string {
  if (!value) return "—";

  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${value}T00:00:00Z`));
}

export async function SidebarBrand() {
  const status = await loadSalesDataStatus();
  const isWarehouse = status.source === "supabase" && status.status === "success";

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

      <div className={isWarehouse ? "data-health ok" : "data-health fallback"}>
        <span className="data-health-dot" aria-hidden="true" />
        <div>
          <b>Дані по {formatCutoff(status.cutoffDate)}</b>
          <span>{isWarehouse ? "Warehouse · Sync OK" : "Google Sheets · fallback"}</span>
        </div>
      </div>

      <form action="/api/auth/logout" method="post">
        <button className="logout-button" type="submit" title="Вийти з Control Center">
          <LogOut size={14} />
          <span>Вийти</span>
        </button>
      </form>
    </div>
  );
}
