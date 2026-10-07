import {
  BarChart3,
  ChevronDown,
  LayoutDashboard,
  MapPin,
  Network,
  PackageSearch,
  Sparkles,
  Truck
} from "lucide-react";
import { KpiCard } from "@/components/KpiCard";
import { RevenueChart } from "@/components/RevenueChart";
import { channels, kpis, locations } from "@/lib/metrics";

const nav = [
  ["Огляд", LayoutDashboard],
  ["Доставка", Truck],
  ["Агрегатори", Network],
  ["Локації", MapPin],
  ["Динаміка", BarChart3],
  ["Data Explorer", PackageSearch],
  ["Insights", Sparkles]
] as const;

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <b>М'ЯСТОРІЯ</b>
            <span>CONTROL CENTER</span>
          </div>
        </div>

        <nav>
          {nav.map(([label, Icon], i) => (
            <button key={label} className={i === 0 ? "nav-item active" : "nav-item"}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className="status-dot" />
          Data source connected
          <small>Google Sheets · demo layer</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">BUSINESS PERFORMANCE</span>
            <h1>Огляд</h1>
          </div>
          <div className="filters">
            <button>01 Jan — 07 Oct 2026 <ChevronDown size={14} /></button>
            <button>Compare: LY <ChevronDown size={14} /></button>
            <button>Всі канали <ChevronDown size={14} /></button>
          </div>
        </header>

        <section className="kpi-grid">
          {kpis.map((kpi) => <KpiCard key={kpi.label} kpi={kpi} />)}
        </section>

        <section className="content-grid">
          <article className="panel revenue-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">DYNAMICS</span>
                <h2>Оборот</h2>
              </div>
              <div className="legend">
                <span><i className="legend-current" />2026</span>
                <span><i />2025</span>
              </div>
            </div>
            <RevenueChart />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">STRUCTURE</span>
                <h2>Канали продажів</h2>
              </div>
            </div>
            <div className="channel-list">
              {channels.map((channel) => (
                <button className="channel-row" key={channel.name}>
                  <div>
                    <b>{channel.name}</b>
                    <span>{channel.value}</span>
                  </div>
                  <div className="share">{channel.share}%</div>
                  <div className="track"><span style={{ width: `${channel.share}%` }} /></div>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="content-grid lower">
          <article className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">LOCATIONS</span>
                <h2>Внесок точок</h2>
              </div>
              <button className="text-button">Всі локації →</button>
            </div>
            <div className="location-table">
              <div className="table-row table-head">
                <span>Локація</span><span>Оборот</span><span>YoY</span><span>Частка</span>
              </div>
              {locations.map((location) => (
                <button className="table-row" key={location.name}>
                  <b>{location.name}</b>
                  <span>{location.revenue}</span>
                  <span className={location.growth >= 0 ? "positive" : "negative"}>
                    {location.growth >= 0 ? "+" : ""}{location.growth}%
                  </span>
                  <span>{location.share}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="panel insight-panel">
            <span className="eyebrow">AI SIGNAL</span>
            <h2>Що потребує уваги</h2>
            <div className="signal">
              <span className="signal-badge">1</span>
              <div>
                <b>Націнка % відстає від обороту</b>
                <p>Оборот зростає +16.8% YoY, але націнка % нижча на 1.5 п.п. Наступний крок — декомпозиція по каналах та локаціях.</p>
              </div>
            </div>
            <button className="analysis-button">Відкрити аналіз</button>
          </article>
        </section>
      </section>
    </main>
  );
}
