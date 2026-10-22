import { CheckCircle2, Database, TriangleAlert } from "lucide-react";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DigitalTabs } from "@/components/DigitalReportShell";
import { loadDigitalHistory } from "@/lib/data/digital";
import { loadDigitalAdsData, loadDigitalLocalData } from "@/lib/data/digital-sources";

function dateLabel(value?:string){
  if(!value) return "немає даних";
  return new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value+"T00:00:00Z"));
}
function n(value:number){return Math.round(value).toLocaleString("uk-UA");}

function SourceCard({title,source,warning}:{title:string;source:{from?:string;to?:string;rows:number};warning?:string}){
  const limited=Boolean(warning);
  return <article className="digital-quality-card">
    <div className={limited?"digital-quality-icon warning":"digital-quality-icon ok"}>{limited?<TriangleAlert size={17}/>:<CheckCircle2 size={17}/>}</div>
    <div><span>{title}</span><b>{limited?"Обмежено":"OK"}</b><small>{source.from?`${dateLabel(source.from)} → ${dateLabel(source.to)}`:`знімок до ${dateLabel(source.to)}`}</small><em>{n(source.rows)} рядків{warning?` · ${warning}`:""}</em></div>
  </article>;
}

export default async function Page(){
  const [history,ads,local]=await Promise.all([loadDigitalHistory(),loadDigitalAdsData(),loadDigitalLocalData()]);
  const q=history.quality;

  return <main className="shell">
    <DashboardSidebar activeHref="/digital" lfl={false} statusTitle="Digital · Data Quality" statusDetail={`спільна дата · ${dateLabel(q.commonLatest)}`}/>
    <section className="workspace">
      <header className="topbar"><div><span className="eyebrow">DIGITAL · DATA QUALITY</span><h1>Якість аналітики</h1></div><div className="digital-source-badge"><Database size={13}/> Контроль джерел</div></header>
      <DigitalTabs active="tracking"/>

      <section className="digital-quality-grid">
        <SourceCard title="GA4 · сайт" source={q.ga4}/>
        <SourceCard title="Search Console" source={q.searchConsole} warning="нормальна затримка GSC 2–3 дні"/>
        <SourceCard title="GA4 · канали" source={q.channels}/>
        <SourceCard title="GA4 · пристрої" source={q.devices}/>
        <SourceCard title="Landing pages" source={q.landingSnapshot} warning="поки 30-денний snapshot"/>
        <SourceCard title="SEO запити" source={q.querySnapshot} warning="поки 30-денний snapshot"/>
        <SourceCard title="SEO сторінки" source={q.pageSnapshot} warning="поки 30-денний snapshot"/>
        <SourceCard title="Google Ads · Windsor" source={{from:ads.meta.from,to:ads.meta.to,rows:ads.trend.length}} warning={ads.meta.days<30?"історія накопичується":undefined}/>
        <SourceCard title="Google / Maps · власні точки" source={{from:local.meta.from,to:local.meta.to,rows:local.meta.days*local.meta.locationCount}} warning={local.meta.days<30?"історія накопичується":undefined}/>
        <SourceCard title="PageSpeed" source={{to:local.pageSpeed?.capturedOn,rows:local.pageSpeed?1:0}}/>
      </section>

      <section className="digital-plan-grid">
        <article className="panel">
          <span className="eyebrow">TRACKING HEALTH</span>
          <div className="digital-metric-list">
            <div><b>Сесії сайту GA4 · останні 7 днів</b><span>{n(q.ga4.last7Sessions??0)}</span></div>
            <div><b>Purchase GA4 · останні 7 днів</b><span>{n(q.ga4.last7Purchases??0)}</span></div>
            <div><b>Google Ads</b><span>{ads.meta.available?`LIVE · ${ads.meta.days} днів · до ${dateLabel(ads.meta.to)}`:"акаунт підключений · sync очікує"}</span></div>
            <div><b>Google PageSpeed</b><span>{local.pageSpeed?`LIVE · mobile ${n(local.pageSpeed.mobileScore)} / desktop ${n(local.pageSpeed.desktopScore)} · ${dateLabel(local.pageSpeed.capturedOn)}`:"очікує sync"}</span></div>
            <div><b>Google Business Profile</b><span>{Object.values(local.summary).some(value=>value!==null)?`LIVE · ${n(local.locations.length)} власні точки · ${local.meta.days} днів`:"4 власні профілі підключено · sync очікує"}</span></div>
            <div><b>Myastoria App · GA4 property 321739013</b><span>0 рядків за 01.01.2025–14.10.2026</span></div>
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">ПРІОРИТЕТИ DATA QUALITY</span>
          <div className="digital-decision-list">
            <div><span>1</span><b>Паша: перевірити Firebase/GA4 SDK та streams мобільного застосунку — app telemetry зараз не надходить.</b></div>
            <div><span>2</span><b>Підключити точну послідовну GA4 funnel-модель.</b></div>
            <div><span>3</span><b>Google daily sync уже автоматизований. Наступний шар — Meta / Instagram та точна funnel-модель.</b></div>
          </div>
        </article>
      </section>

      <div className="lfl-banner" style={{marginTop:12}}>Система навмисно не показує «0» там, де історії немає: відсутність даних і нульовий результат — різні речі.</div>
    </section>
  </main>;
}
