"use client";

import { useState } from "react";
import { aggregateMonthly, aggregateMonthlyRange, compareMonthly, filterMonthlyRows, glovoMonthAxis,
  monthlyAverageTicket, monthlyShare, monthlyVirtualShare, type MonthlyRow } from "@/lib/data/glovo-monthly";
import styles from "./monthly.module.css";

type Metric="purchaseSum"|"deliveredOrders";
type Secondary="mom"|"share"|"none";
type Filters={ownership:string;location:string;brand:string;identity:string};
export type GlovoMonthlyInitialFilters=Partial<Filters>&{year?:number;focusMonth?:string;metric?:Metric;secondary?:Secondary;selectedBrand?:string};
type Summary=ReturnType<typeof aggregateMonthly>;
const SHORT=["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"];
const FULL=["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const unique=(values:string[])=>[...new Set(values)].sort((a,b)=>a.localeCompare(b,"uk"));
const siteKey=(row:MonthlyRow)=>row.physicalId||row.sourceLocation;
const siteLabel=(row:MonthlyRow)=>row.physicalLocation||row.sourceLocation;
const monthLabel=(month:string,full=false)=>month?`${(full?FULL:SHORT)[Number(month.slice(5))-1]}${full?` ${month.slice(0,4)}`:""}`:"—";
const num=(value:number,digits=0)=>new Intl.NumberFormat("uk-UA",{maximumFractionDigits:digits}).format(value);
const pct=(value:number|null,signed=false)=>value===null?"—":`${signed&&value>0?"+":""}${num(value,1)}%`;
const structural=(summary:Summary)=>summary.value===0&&summary.known===0&&summary.expected===0&&!summary.partial;
const display=(summary:Summary,metric:Metric,compact=true)=>structural(summary)?"До відкриття":summary.value===null?"?":`${summary.partial?"~":""}${num(compact&&metric==="purchaseSum"?summary.value/1000:summary.value,metric==="purchaseSum"?(compact?1:2):0)}${!compact&&metric==="purchaseSum"?" грн*":""}`;
const reasons:Record<string,string>={INCOMPLETE_MONTH:"Місяць неповний або його завершеність не підтверджена",COHORT_MISMATCH:"Змінився склад порівнюваних вітрин",MISSING_OBSERVATIONS:"Є пропущені чи невідомі значення",NO_COMPARABLE_STOREFRONTS:"Немає зіставних вітрин",ZERO_BASELINE:"Попереднє значення дорівнює нулю",INVALID_MONTH:"Попередній місяць недоступний",UNSAFE_TOTAL:"Підсумок не підтверджений"};
const changeNote=(reason:string|null)=>reason?(reasons[reason]||"Порівняння недоступне") : "До безпосередньо попереднього місяця, за завантаженими даними";
const summaryNote=(summary:Summary)=>structural(summary)?"До підтвердженого відкриття; це не виміряний нуль":`${summary.value===null?"Немає числових даних":summary.partial?"Лише відомі значення; підсумок неповний":"За завантаженими даними"}. Числові спостереження: ${summary.known} / ${summary.expected} вітрина-місяців`;

function MonthlyTable({groups,baseRows,months,focus,metric,secondary,incompleteMonths,kind,selected,onSelect,totalLabel}:{
  groups:Array<{key:string;label:string;description:string;rows:MonthlyRow[]}>;baseRows:MonthlyRow[];months:string[];focus:string;metric:Metric;secondary:Secondary;incompleteMonths:readonly string[];kind:"brands"|"sites";selected?:string;onSelect?:(key:string)=>void;totalLabel:string;
}) {
  const monthCells=(rows:MonthlyRow[])=>months.map(month=>{
    const summary=aggregateMonthly(rows,month,metric);
    const comparison=compareMonthly(rows,month,metric,incompleteMonths);
    const share=monthlyShare(rows,baseRows,month,metric);
    const sub=secondary==="mom"?pct(comparison.percent,true):pct(share);
    const subNote=secondary==="mom"?changeNote(comparison.reason):"Частка у вибраному зрізі цього місяця; за пропусків недоступна";
    return <td key={month} data-month={month} data-value={summary.value??"unknown"}
      className={[incompleteMonths.includes(month)?styles.incomplete:"",structural(summary)?styles.beforeOpening:summary.partial?styles.unknown:""].join(" ")}
      title={`${monthLabel(month,true)}. ${summaryNote(summary)}${incompleteMonths.includes(month)?". Неповний період":""}`}>
      <span className={styles.value}>{display(summary,metric)}</span>
      {secondary!=="none"&&<span title={subNote} className={[styles.secondary,secondary==="mom"&&comparison.percent!==null?(comparison.percent>=0?styles.positive:styles.negative):""].join(" ")}>{sub}</span>}
    </td>;
  });
  const tail=(rows:MonthlyRow[])=>{
    const total=aggregateMonthlyRange(rows,months,metric);
    return <><td className={styles.total} title={summaryNote(total)} data-total-value={total.value??"unknown"}>{display(total,metric)}</td><td title={`Частка за ${monthLabel(focus,true)}; за пропусків недоступна`}>{pct(monthlyShare(rows,baseRows,focus,metric))}</td></>;
  };
  return <div className={styles.scroll} role="region" aria-label={kind==="brands"?"Бренди за місяцями":"Заклади обраного бренду за місяцями"} tabIndex={0}>
    <table className={styles.table}><caption>{kind==="brands"?"Бренди":"Заклади"} × місяці. {metric==="purchaseSum"?"Тисячі гривень, позначення локальної валюти джерела":"Доставлені замовлення"}. За завантаженими даними.</caption>
      <thead><tr><th scope="col">{kind==="brands"?"Бренд":"Заклад"}</th>{months.map(month=><th scope="col" key={month} className={[month===focus?styles.focus:"",incompleteMonths.includes(month)?styles.incomplete:""].join(" ")} title={monthLabel(month,true)}>{monthLabel(month)}{incompleteMonths.includes(month)?" †":""}</th>)}<th scope="col" className={styles.total}>Разом за період</th><th scope="col">Частка<br/>{monthLabel(focus)}</th></tr></thead>
      <tbody>{groups.map(group=><tr key={group.key} data-group={group.key} className={selected===group.key?styles.selected:undefined}>
        <th scope="row">{onSelect?<button type="button" className={styles.brandButton} onClick={()=>onSelect(group.key)} aria-pressed={selected===group.key} aria-controls="glovo-monthly-detail">{group.label}</button>:group.label}<span className={styles.rowMeta}>{group.description}</span></th>
        {monthCells(group.rows)}{tail(group.rows)}
      </tr>)}</tbody>
      <tfoot><tr><th scope="row">{totalLabel}</th>{monthCells(baseRows)}{tail(baseRows)}</tr></tfoot>
    </table>
  </div>;
}

export function GlovoMonthlyDashboard({rows,incompleteMonths,initialFilters={}}:{rows:MonthlyRow[];incompleteMonths:string[];initialFilters?:GlovoMonthlyInitialFilters}) {
  const years=unique(rows.map(row=>row.month.slice(0,4))).map(Number).filter(Number.isInteger);
  const [selectedYear,setYear]=useState(initialFilters.year??years[years.length-1]??0);
  const year=years.includes(selectedYear)?selectedYear:years[years.length-1]??0;
  const yearRows=rows.filter(row=>row.month.startsWith(`${year}-`));
  const months=glovoMonthAxis(yearRows,year);
  const defaultFocus=[...months].reverse().find(month=>!incompleteMonths.includes(month))||months[months.length-1]||"";
  const [requestedFocus,setFocus]=useState(initialFilters.focusMonth??defaultFocus);
  const focus=months.includes(requestedFocus)?requestedFocus:defaultFocus;
  const [filters,setFilters]=useState<Filters>({ownership:initialFilters.ownership??"",location:initialFilters.location??"",brand:initialFilters.brand??"",identity:initialFilters.identity??""});
  const [metric,setMetric]=useState<Metric>(initialFilters.metric??"purchaseSum");
  const [secondary,setSecondary]=useState<Secondary>(initialFilters.secondary??"mom");
  const [selectedBrand,setBrand]=useState(initialFilters.selectedBrand??initialFilters.brand??"");
  const filtered=filterMonthlyRows(yearRows,filters);
  const brands=unique(filtered.map(row=>row.rawBrand)).sort((a,b)=>(aggregateMonthly(filtered.filter(row=>row.rawBrand===b),focus,metric).value??-Infinity)-(aggregateMonthly(filtered.filter(row=>row.rawBrand===a),focus,metric).value??-Infinity)||a.localeCompare(b,"uk"));
  const selected=brands.includes(selectedBrand)?selectedBrand:brands[0]||"";
  const brandRows=filtered.filter(row=>row.rawBrand===selected);
  const sites=unique(brandRows.map(siteKey)).sort((a,b)=>(aggregateMonthly(brandRows.filter(row=>siteKey(row)===b),focus,metric).value??-Infinity)-(aggregateMonthly(brandRows.filter(row=>siteKey(row)===a),focus,metric).value??-Infinity)||a.localeCompare(b,"uk"));
  const amount=aggregateMonthly(filtered,focus,"purchaseSum"),orders=aggregateMonthly(filtered,focus,"deliveredOrders");
  const aov=monthlyAverageTicket(filtered,focus),virtualShare=monthlyVirtualShare(filtered,focus,metric);
  const partialMonths=months.filter(month=>incompleteMonths.includes(month));
  const brandGroups=brands.map(brand=>{const subset=filtered.filter(row=>row.rawBrand===brand);return {key:brand,label:brand,rows:subset,description:`${unique(subset.map(siteKey)).length} закл. · ${unique(subset.map(row=>row.identity)).join(" / ")}`};});
  const siteGroups=sites.map(site=>{const subset=brandRows.filter(row=>siteKey(row)===site),opening=unique(subset.flatMap(row=>row.openingMonth?[row.openingMonth]:[]));return {key:site,label:siteLabel(subset[0]),rows:subset,description:`${unique(subset.map(row=>row.identity)).join(" / ")} · ${opening.length===1&&subset.every(row=>row.openingMonth===opening[0])?`відкриття: ${opening[0]}`:"дата відкриття невідома"}`};});
  const trend=months.map(month=>({month,summary:aggregateMonthly(brandRows,month,metric)}));
  const trendMax=Math.max(1,...trend.map(item=>item.summary.value??0));
  const siteValues=siteGroups.map(group=>({...group,summary:aggregateMonthly(group.rows,focus,metric)}));
  const siteMax=Math.max(1,...siteValues.map(item=>item.summary.value??0));
  const update=(key:keyof Filters,value:string)=>setFilters(current=>({...current,[key]:value}));
  const reset=()=>{setFilters({ownership:"",location:"",brand:"",identity:""});setFocus(defaultFocus);setMetric("purchaseSum");setSecondary("mom");setBrand("");};
  return <section className={styles.dashboard} aria-labelledby="glovo-monthly-heading">
    <div className={styles.intro}><div><h2 id="glovo-monthly-heading">Glovo: бренди × місяці</h2><div className={styles.muted}>Виберіть бренд — нижче з’явиться динаміка його закладів.</div></div><span className={styles.tag}>За завантаженими даними</span></div>
    <div className={styles.controls}>
      {years.length>1&&<label className={styles.control}>Рік<select value={year} onChange={event=>setYear(Number(event.target.value))}>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}
      <label className={styles.control}>Власність<select value={filters.ownership} onChange={event=>update("ownership",event.target.value)}><option value="">Усі</option>{unique(yearRows.map(row=>row.ownership)).map(value=><option key={value} value={value}>{value==="UNKNOWN"?"Невідома":value}</option>)}</select></label>
      <label className={styles.control}>Заклад<select value={filters.location} onChange={event=>update("location",event.target.value)}><option value="">Усі заклади</option>{unique(yearRows.map(siteKey)).map(value=><option key={value} value={value}>{siteLabel(yearRows.find(row=>siteKey(row)===value)!)}</option>)}</select></label>
      <label className={styles.control}>Бренд<select value={filters.brand} onChange={event=>update("brand",event.target.value)}><option value="">Усі бренди</option>{unique(yearRows.map(row=>row.rawBrand)).map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label className={styles.control}>Тип вітрини<select value={filters.identity} onChange={event=>update("identity",event.target.value)}><option value="">Реальні + віртуальні</option>{unique(yearRows.map(row=>row.identity)).map(value=><option key={value} value={value}>{value==="UNKNOWN"?"Невідомий":value}</option>)}</select></label>
      <label className={styles.control}>Фокус показників<select value={focus} onChange={event=>setFocus(event.target.value)} disabled={!months.length}>{months.map(month=><option key={month} value={month}>{monthLabel(month,true)}{incompleteMonths.includes(month)?" · неповний":""}</option>)}</select></label>
      <div className={styles.control}><span>Показник</span><div className={styles.toggle} role="group" aria-label="Показник таблиць і графіків"><button type="button" aria-pressed={metric==="purchaseSum"} onClick={()=>setMetric("purchaseSum")}>Сума, грн*</button><button type="button" aria-pressed={metric==="deliveredOrders"} onClick={()=>setMetric("deliveredOrders")}>Замовлення</button></div></div>
      <button className={styles.reset} type="button" onClick={reset}>Скинути фільтри</button>
    </div>
    {partialMonths.length>0&&<p className={styles.notice} role="note">† {partialMonths.map(month=>monthLabel(month,true)).join(", ")} — неповний період або його завершеність не підтверджена. Показуємо завантажені значення; звичайний MoM для цієї пари недоступний.</p>}
    {!filtered.length?<p className={styles.empty} role="status">Немає даних за вибраними фільтрами. Відсутність записів не означає нуль продажів.</p>:<>
      <div className={styles.metrics} aria-label={`Показники за ${monthLabel(focus,true)}`}>
        {([{title:"Сума покупок",summary:amount,key:"purchaseSum"},{title:"Замовлення",summary:orders,key:"deliveredOrders"}] as const).map(item=>{
          const change=compareMonthly(filtered,focus,item.key,incompleteMonths);
          return <article className={styles.metric} key={item.key}><h3>{item.title} · {monthLabel(focus,true)}</h3><strong title={summaryNote(item.summary)}>{display(item.summary,item.key,false)}</strong><small className={change.percent===null?undefined:change.percent>=0?styles.positive:styles.negative}>{change.percent===null?`MoM недоступний: ${changeNote(change.reason)}`:`${pct(change.percent,true)} до попереднього місяця`}</small></article>;
        })}
        <article className={styles.metric}><h3>Середній чек · {monthLabel(focus,true)}</h3><strong>{aov===null?"—":`${num(aov,2)} грн*`}</strong><small>Сума ÷ замовлення. За пропусків або нульового знаменника — недоступно.</small></article>
        <article className={styles.metric}><h3>Частка віртуальних · {monthLabel(focus,true)}</h3><strong>{pct(virtualShare)}</strong><small>{metric==="purchaseSum"?"У сумі покупок":"У доставлених замовленнях"}. Тип визначено для пари бренд × заклад; за невідомих даних — недоступно.</small></article>
      </div>
      <section className={styles.panel} aria-labelledby="glovo-brands-heading">
        <div className={styles.panelHead}><div><h3 id="glovo-brands-heading">Бренди × місяці / {year}</h3><div className={styles.sub}>{metric==="purchaseSum"?"Тис. грн*":"Доставлені замовлення"} · усі підсумки за поточними фільтрами · бренд відкриває деталізацію</div></div>
          <label className={styles.control}>Другий рядок клітинки<select value={secondary} onChange={event=>setSecondary(event.target.value as Secondary)}><option value="mom">Приріст MoM</option><option value="share">Частка за місяць</option><option value="none">Без другого рядка</option></select></label>
        </div>
        <MonthlyTable groups={brandGroups} baseRows={filtered} months={months} focus={focus} metric={metric} secondary={secondary} incompleteMonths={incompleteMonths} kind="brands" selected={selected} onSelect={setBrand} totalLabel="Усього за місяць"/>
        <div className={styles.legend}><span>~ лише відомі значення</span><span>? немає даних</span><span>0 підтверджений нуль у джерелі</span><span>† неповний період</span></div>
        <p className={styles.foot}>Разом включає всі показані місяці, також неповні. Частка праворуч — у вибраному зрізі за {monthLabel(focus,true)}. MoM — за однаковим складом вітрин; завантаження не доводить повноту місяця.</p>
      </section>
      {selected&&<section className={styles.panel} id="glovo-monthly-detail" aria-labelledby="glovo-detail-heading">
        <div className={styles.panelHead}><div><span className={styles.tag}>Деталі обраного бренду</span><h3 id="glovo-detail-heading" aria-live="polite">{selected} → заклади</h3><div className={styles.sub}>Ті самі місяці й фільтри. Підсумки закладів відповідають рядку бренду вище.</div></div><span className={styles.sub}>{sites.length} закладів</span></div>
        <div className={styles.lowerGrid}>
          <div><h4>Помісячна динаміка · {metric==="purchaseSum"?"тис. грн*":"замовлення"}</h4><div className={styles.trendScroll} role="region" aria-label={`Помісячна динаміка ${selected}`} tabIndex={0}><div className={styles.trend}>
            {trend.map(({month,summary})=><div key={month} className={styles.trendColumn} aria-label={`${monthLabel(month,true)}: ${display(summary,metric,false)}. ${summaryNote(summary)}`}>
              <span className={styles.barValue}>{structural(summary)?"До відкриття":display(summary,metric)}</span>
              {summary.value!==null&&!structural(summary)&&<span aria-hidden="true" className={[styles.trendBar,month===focus?styles.selectedBar:"",summary.partial||incompleteMonths.includes(month)?styles.partialBar:""].join(" ")} style={{height:`${Math.max(0,summary.value)/trendMax*132}px`}}/>}
              <span className={styles.trendMonth}>{monthLabel(month)}{incompleteMonths.includes(month)?" †":""}</span>
            </div>)}
          </div></div><p className={styles.sub}>Штрихування — неповний період або пропуски. Невідомі значення не показані нульовими стовпчиками.</p></div>
          <div><h4>Заклади · {monthLabel(focus,true)}</h4><div className={styles.sites}>
            {siteValues.map(group=><div key={group.key} className={styles.siteBar} title={summaryNote(group.summary)}><span>{group.label}</span><div className={styles.track} aria-hidden="true">{group.summary.value!==null&&!structural(group.summary)&&<span style={{width:`${Math.max(0,group.summary.value)/siteMax*100}%`}}/>}</div><b>{display(group.summary,metric)}</b></div>)}
          </div><p className={styles.sub}>Разом за фокусний місяць: <b>{display(aggregateMonthly(brandRows,focus,metric),metric)}</b> {metric==="purchaseSum"?"тис. грн*":"замовлень"}.</p></div>
        </div>
        <MonthlyTable groups={siteGroups} baseRows={brandRows} months={months} focus={focus} metric={metric} secondary={secondary} incompleteMonths={incompleteMonths} kind="sites" totalLabel={`Усього · ${selected}`}/>
        <p className={styles.foot}>Частки закладів — усередині обраного бренду. Невідомі значення не замінюються нулями.</p>
      </section>}
    </>}
    <section className={styles.panel}><div className={styles.opening}><div><h3>Відкриття: окремий стан, а не припущення</h3><p>Перший продаж не є датою відкриття. Порожній ранній місяць залишається «?», доки початок роботи не підтверджено. «До відкриття» показуємо лише за підтвердженою датою. Зразки праворуч — легенда станів.</p></div><div className={styles.samples}><div className={styles.beforeOpening}><strong>До відкриття</strong>Підтверджена дата</div><div><strong>0</strong>Виміряний нуль</div><div className={styles.unknown}><strong>?</strong>Невідомі дані</div></div></div></section>
    <p className={styles.currency}>* «грн» — погоджене позначення у звіті. У джерелі вказано «локальна валюта»; конвертація не виконувалась. Усі показники — за завантаженими даними, а не підтвердження повноти періоду.</p>
  </section>;
}
