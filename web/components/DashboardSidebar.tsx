import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Globe2,
  LayoutDashboard,
  MapPin,
  Network,
  PackageSearch,
  Sparkles,
  Truck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SidebarBrand } from "@/components/SidebarBrand";

const NAV: Array<[string, LucideIcon, string]> = [
  ["Оперативне керування", Sparkles, "/operating"],
  ["Огляд", LayoutDashboard, "/"],
  ["Доставка", Truck, "/delivery"],
  ["Агрегатори", Network, "/aggregators"],
  ["Заклади", MapPin, "/locations"],
  ["Динаміка", BarChart3, "/dynamics"],
  ["P&L", CircleDollarSign, "/pnl"],
  ["Digital", Globe2, "/digital"],
  ["Data Explorer", PackageSearch, "/explorer"],
  ["Insights", Sparkles, "/insights"]
];

type DashboardSidebarProps = {
  activeHref: string;
  lfl: boolean;
  statusTitle: string;
  statusDetail: ReactNode;
};

export function DashboardSidebar({
  activeHref,
  lfl,
  statusTitle,
  statusDetail
}: DashboardSidebarProps) {
  return (
    <aside className="sidebar">
      <SidebarBrand />

      <nav>
        {NAV.map(([label, Icon, href]) => {
          const target = lfl
            ? `${href}${href.includes("?") ? "&" : "?"}lfl=1`
            : href;

          return (
            <Fragment key={label}>
              <Link
                href={target}
                prefetch={false}
                aria-label={label}
                aria-current={href === activeHref ? "page" : undefined}
                className={href === activeHref ? "nav-item active" : "nav-item"}
              >
                <Icon size={18} />
                {label}
              </Link>
              {href === "/aggregators" && (
                <Link
                  href="/aggregators/glovo"
                  prefetch={false}
                  aria-label="Агрегатори → Glovo · Аналітика брендів"
                  aria-current={activeHref === "/aggregators/glovo" ? "page" : undefined}
                  className={activeHref === "/aggregators/glovo" ? "nav-item nav-child active" : "nav-item nav-child"}
                >
                  <BarChart3 size={18} />
                  Glovo · Аналітика брендів
                </Link>
              )}
            </Fragment>
          );
        })}
      </nav>

      <div className="sidebar-status">
        <span className="status-dot" />
        {statusTitle}
        <small>{statusDetail}</small>
      </div>
    </aside>
  );
}
