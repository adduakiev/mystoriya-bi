import { unstable_cache } from "next/cache";
import {
  availableMonths,
  availableYears,
  buildDashboardSnapshot,
  buildMultiYearMetricSeries,
  buildMultiYearWeeklyMetricSeries
} from "@/lib/analytics";
import { filterSalesRows, type GrainMode, type MetricMode } from "@/lib/filters";
import type { DashboardSnapshot, Kpi, MetricSet, SalesRow } from "@/lib/data/types";
import { callBiRpc, loadSalesData } from "@/lib/data/source";

export type DeliveryMetricSet = MetricSet;

export type DeliveryTypeSummary = DeliveryMetricSet & {
  name: string;
  share: number;
};

export type DeliveryLocationRow = {
  name: string;
  revenue: number;
  growth: number | null;
  checks: number;
  averageCheck: number;
  markupRate: number;
  deliveryShare: number;
  aggregatorRevenue: number;
  versusAggregator: number;
};

export type DeliveryData = {
  source: "supabase-sql" | "legacy";
  rowCount: number;
  years: number[];
  selectedYear: number;
  selectedMonth?: number;
  months: number[];
  deliveryTypes: string[];
  locations: string[];
  brands: string[];
  ownerships: string[];
  snapshot: DashboardSnapshot;
  multiYearData: Array<Record<string, string | number>>;
  typeSummary: DeliveryTypeSummary[];
  deliveryMetrics: DeliveryMetricSet;
  aggregatorMetrics: DeliveryMetricSet;
  ownVsAggregatorRatio: number;
  compareSeries: Array<{ label: string; delivery: number; aggregator: number }>;
  locationRows: DeliveryLocationRow[];
};

export type DeliveryQuery = {
  orderType?: string;
  location?: string;
  brand?: string;
  ownership?: string;
  year?: number;
  month?: number;
  metric: MetricMode;
  grain: GrainMode;
  lfl: boolean;
};

type RpcMetric = {
  revenue?: number | string;
  checks?: number | string;
  markup?: number | string;
  averageCheck?: number | string;
  markupRate?: number | string;
};

type RpcPayload = {
  meta?: {
    rowCount?: number | string;
    latestSourceDate?: string;
    cutoffDate?: string;
    selectedYear?: number | string;
    selectedMonth?: number | string | null;
    years?: Array<number | string>;
    months?: Array<number | string>;
    deliveryTypes?: string[];
    locations?: string[];
    brands?: string[];
    ownerships?: string[];
    periodLabel?: string;
    currentYear?: number | string;
    previousYear?: number | string;
  };
  current?: RpcMetric;
  previous?: RpcMetric;
  deliveryMetrics?: RpcMetric;
  aggregatorMetrics?: RpcMetric;
  typeSummary?: Array<RpcMetric & { name?: string; share?: number | string }>;
  multiYearData?: Array<Record<string, string | number>>;
  compareSeries?: Array<{ label?: string; delivery?: number | string; aggregator?: number | string }>;
  locationRows?: Array<{
    name?: string;
    revenue?: number | string;
    growth?: number | string | null;
    checks?: number | string;
    averageCheck?: number | string;
    markupRate?: number | string;
    deliveryShare?: number | string;
    aggregatorRevenue?: number | string;
    versusAggregator?: number | string;
  }>;
};

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableNum = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function metrics(rows: SalesRow[]): MetricSet {
  const revenue = rows.reduce((sum,row)=>sum+row.revenue,0);
  const checks = rows.reduce((sum,row)=>sum+row.checks,0);
  const markup = rows.reduce((sum,row)=>sum+row.markup,0);
  return {
    revenue,
    checks,
    markup,
    averageCheck: checks>0?revenue/checks:0,
    markupRate: revenue>0?markup/revenue*100:0
  };
}

function metricSet(raw?: RpcMetric): MetricSet {
  return {
    revenue:num(raw?.revenue),
    checks:num(raw?.checks),
    markup:num(raw?.markup),
    averageCheck:num(raw?.averageCheck),
    markupRate:num(raw?.markupRate)
  };
}

function pct(current:number,previous:number):number|null {
  if(previous===0) return null;
  return (current/previous-1)*100;
}

function pp(current:number,previous:number):number|null {
  if(!Number.isFinite(previous)) return null;
  return current-previous;
}

function compactUah(value:number):string {
  const abs=Math.abs(value);
  if(abs>=1_000_000) return `₴ ${(value/1_000_000).toFixed(1)}M`;
  if(abs>=1_000) return `₴ ${(value/1_000).toFixed(1)}K`;
  return `₴ ${Math.round(value).toLocaleString("uk-UA")}`;
}

function kpi(label:string,value:string,delta:number|null,deltaLabel:string):Kpi {
  return {
    label,value,delta,deltaLabel,
    direction:delta===null||Math.abs(delta)<0.05?"flat":delta>0?"up":"down"
  };
}

function deliverySnapshot(payload:RpcPayload):DashboardSnapshot {
  const meta=payload.meta ?? {};
  const current=metricSet(payload.current);
  const previous=metricSet(payload.previous);
  const label=String(meta.previousYear ?? "");

  const revenueGrowth=pct(current.revenue,previous.revenue)??0;
  const checksGrowth=pct(current.checks,previous.checks)??0;
  const aovGrowth=pct(current.averageCheck,previous.averageCheck)??0;
  const markupPp=pp(current.markupRate,previous.markupRate)??0;

  return {
    sourceRows:num(meta.rowCount),
    cutoffDate:meta.cutoffDate ?? "",
    currentYear:num(meta.currentYear),
    previousYear:num(meta.previousYear),
    period:meta.selectedMonth ? "month" : "ytd",
    comparison:"ly",
    periodLabel:meta.periodLabel ?? "",
    comparisonLabel:label,
    current,
    previous,
    kpis:[
      kpi("Оборот",compactUah(current.revenue),pct(current.revenue,previous.revenue),label),
      kpi("Чеки",Math.round(current.checks).toLocaleString("uk-UA"),pct(current.checks,previous.checks),label),
      kpi("Середній чек",`₴ ${Math.round(current.averageCheck).toLocaleString("uk-UA")}`,pct(current.averageCheck,previous.averageCheck),label),
      kpi("Націнка",compactUah(current.markup),pct(current.markup,previous.markup),label),
      kpi("Націнка %",`${current.markupRate.toFixed(1)}%`,pp(current.markupRate,previous.markupRate),`п.п. vs ${label}`)
    ],
    trend:[],
    channels:[],
    locations:[],
    monthlyTable:[],
    signal:{
      severity:revenueGrowth>0&&markupPp< -0.5?"warning":"info",
      title:revenueGrowth>=0?"Позитивна динаміка":"Період нижче бази порівняння",
      body:`Оборот: ${revenueGrowth>=0?"+":""}${revenueGrowth.toFixed(1)}%. Чеки: ${checksGrowth>=0?"+":""}${checksGrowth.toFixed(1)}%. Середній чек: ${aovGrowth>=0?"+":""}${aovGrowth.toFixed(1)}% vs ${label}.`
    }
  };
}

function normalizeSeries(input:Array<Record<string,string|number>>|undefined) {
  return (input ?? []).map((point)=>{
    const out:Record<string,string|number>={};
    Object.entries(point).forEach(([key,value])=>{
      out[key]=key==="label"?String(value):num(value);
    });
    return out;
  });
}

function currentPeriodRows(rows:SalesRow[],year:number,month:number|undefined,cutoff:string):SalesRow[] {
  const cutoffMonth=Number(cutoff.slice(5,7));
  const cutoffDay=Number(cutoff.slice(8,10));
  return rows.filter((row)=>{
    const y=Number(row.date.slice(0,4));
    const m=Number(row.date.slice(5,7));
    const d=Number(row.date.slice(8,10));
    if(y!==year) return false;
    if(month) return m===month&&d<=cutoffDay;
    return m<cutoffMonth||(m===cutoffMonth&&d<=cutoffDay);
  });
}

function monthRevenue(rows:SalesRow[],year:number,month:number,maxDay?:number):number {
  return rows.filter((row)=>{
    const y=Number(row.date.slice(0,4));
    const m=Number(row.date.slice(5,7));
    const d=Number(row.date.slice(8,10));
    return y===year&&m===month&&(!maxDay||d<=maxDay);
  }).reduce((sum,row)=>sum+row.revenue,0);
}

async function legacy(query:DeliveryQuery):Promise<DeliveryData> {
  const sourceRows=await loadSalesData();
  const years=availableYears(sourceRows);
  const selectedYear=query.year ?? years[years.length-1];
  const selectedMonth=query.month;

  const main=filterSalesRows(sourceRows,{
    channel:"Доставка",orderType:query.orderType,location:query.location,
    brand:query.brand,ownership:query.ownership,lfl:query.lfl
  });
  const allDelivery=filterSalesRows(sourceRows,{
    channel:"Доставка",location:query.location,brand:query.brand,ownership:query.ownership,lfl:query.lfl
  });
  const aggregators=filterSalesRows(sourceRows,{
    channel:"Агрегатор",location:query.location,brand:query.brand,ownership:query.ownership,lfl:query.lfl
  });

  const snapshot=buildDashboardSnapshot(main,{
    period:selectedMonth?"month":"ytd",comparison:"ly",focusYear:selectedYear,focusMonth:selectedMonth
  });
  const currentAll=currentPeriodRows(allDelivery,selectedYear,selectedMonth,snapshot.cutoffDate);
  const prevAll=currentPeriodRows(allDelivery,selectedYear-1,selectedMonth,`${selectedYear-1}${snapshot.cutoffDate.slice(4)}`);
  const currentAgg=currentPeriodRows(aggregators,selectedYear,selectedMonth,snapshot.cutoffDate);
  const deliveryMetrics=metrics(currentAll);
  const aggregatorMetrics=metrics(currentAgg);

  const types=[...new Set(allDelivery.map((r)=>r.orderType))].sort((a,b)=>a.localeCompare(b,"uk"));
  const typeSummary=types.map((name)=>{
    const m=metrics(currentAll.filter((r)=>r.orderType===name));
    return {...m,name,share:deliveryMetrics.revenue>0?m.revenue/deliveryMetrics.revenue*100:0};
  }).filter((x)=>x.revenue>0).sort((a,b)=>b.revenue-a.revenue);

  const dimensionRows=filterSalesRows(sourceRows,{lfl:query.lfl});
  const locations=[...new Set(dimensionRows.map((r)=>r.location))].sort((a,b)=>a.localeCompare(b,"uk"));
  const brands=[...new Set(dimensionRows.map((r)=>r.brand))].sort((a,b)=>a.localeCompare(b,"uk"));
  const ownerships=[...new Set(dimensionRows.map((r)=>r.ownership))].sort((a,b)=>a.localeCompare(b,"uk"));

  const allChannels=currentPeriodRows(
    filterSalesRows(sourceRows,{location:query.location,brand:query.brand,ownership:query.ownership,lfl:query.lfl}),
    selectedYear,selectedMonth,snapshot.cutoffDate
  );

  const locationNames=[...new Set(currentAll.map((r)=>r.location))];
  const locationRows=locationNames.map((name)=>{
    const dm=metrics(currentAll.filter((r)=>r.location===name));
    const pm=metrics(prevAll.filter((r)=>r.location===name));
    const total=allChannels.filter((r)=>r.location===name).reduce((s,r)=>s+r.revenue,0);
    const ar=currentAgg.filter((r)=>r.location===name).reduce((s,r)=>s+r.revenue,0);
    return {
      name,revenue:dm.revenue,growth:pct(dm.revenue,pm.revenue),checks:dm.checks,
      averageCheck:dm.averageCheck,markupRate:dm.markupRate,
      deliveryShare:total>0?dm.revenue/total*100:0,
      aggregatorRevenue:ar,versusAggregator:ar>0?dm.revenue/ar*100:0
    };
  }).filter((r)=>r.revenue>0).sort((a,b)=>b.revenue-a.revenue);

  const cutoffMonth=Number(snapshot.cutoffDate.slice(5,7));
  const cutoffDay=Number(snapshot.cutoffDate.slice(8,10));
  const compareSeries=Array.from({length:selectedMonth?1:cutoffMonth},(_,index)=>{
    const month=selectedMonth ?? index+1;
    const alignedDay=month===cutoffMonth?cutoffDay:undefined;
    return {
      label:["Січ","Лют","Бер","Кві","Тра","Чер","Лип","Сер","Вер","Жов","Лис","Гру"][month-1],
      delivery:monthRevenue(allDelivery,selectedYear,month,alignedDay),
      aggregator:monthRevenue(aggregators,selectedYear,month,alignedDay)
    };
  });

  return {
    source:"legacy",
    rowCount:currentAll.length,
    years,selectedYear,selectedMonth,
    months:availableMonths(main,selectedYear),
    deliveryTypes:types,locations,brands,ownerships,snapshot,
    multiYearData:query.grain==="week"&&!selectedMonth
      ?buildMultiYearWeeklyMetricSeries(main,years,query.metric)
      :buildMultiYearMetricSeries(main,years,query.metric,selectedMonth),
    typeSummary,deliveryMetrics,aggregatorMetrics,
    ownVsAggregatorRatio:aggregatorMetrics.revenue>0?deliveryMetrics.revenue/aggregatorMetrics.revenue*100:0,
    compareSeries,locationRows
  };
}

export async function loadDeliveryData(query:DeliveryQuery):Promise<DeliveryData> {
  const key=JSON.stringify([
    query.orderType??"",query.location??"",query.brand??"",query.ownership??"",
    query.year??0,query.month??0,query.metric,query.grain,query.lfl?1:0
  ]);

  try {
    const payload=await unstable_cache(
      ()=>callBiRpc<RpcPayload>("bi_delivery_payload",{
        p_order_type:query.orderType??null,
        p_location:query.location??null,
        p_brand:query.brand??null,
        p_ownership:query.ownership??null,
        p_focus_year:query.year??null,
        p_focus_month:query.month??null,
        p_metric:query.metric,
        p_grain:query.grain,
        p_lfl:query.lfl
      }),
      ["bi-delivery-sql-v1",key],
      {revalidate:180,tags:["sales-data","delivery-data"]}
    )();

    const meta=payload.meta ?? {};
    const deliveryMetrics=metricSet(payload.deliveryMetrics);
    const aggregatorMetrics=metricSet(payload.aggregatorMetrics);

    return {
      source:"supabase-sql",
      rowCount:num(meta.rowCount),
      years:(meta.years ?? []).map(num),
      selectedYear:num(meta.selectedYear),
      selectedMonth:meta.selectedMonth===null||meta.selectedMonth===undefined?undefined:num(meta.selectedMonth),
      months:(meta.months ?? []).map(num),
      deliveryTypes:meta.deliveryTypes ?? [],
      locations:meta.locations ?? [],
      brands:meta.brands ?? [],
      ownerships:meta.ownerships ?? [],
      snapshot:deliverySnapshot(payload),
      multiYearData:normalizeSeries(payload.multiYearData),
      typeSummary:(payload.typeSummary ?? []).map((item)=>({
        name:item.name ?? "",
        ...metricSet(item),
        share:num(item.share)
      })),
      deliveryMetrics,
      aggregatorMetrics,
      ownVsAggregatorRatio:aggregatorMetrics.revenue>0?deliveryMetrics.revenue/aggregatorMetrics.revenue*100:0,
      compareSeries:(payload.compareSeries ?? []).map((item)=>({
        label:item.label ?? "",
        delivery:num(item.delivery),
        aggregator:num(item.aggregator)
      })),
      locationRows:(payload.locationRows ?? []).map((item)=>({
        name:item.name ?? "",
        revenue:num(item.revenue),
        growth:nullableNum(item.growth),
        checks:num(item.checks),
        averageCheck:num(item.averageCheck),
        markupRate:num(item.markupRate),
        deliveryShare:num(item.deliveryShare),
        aggregatorRevenue:num(item.aggregatorRevenue),
        versusAggregator:num(item.versusAggregator)
      }))
    };
  } catch(error) {
    console.error("SQL-first Delivery failed; using legacy fallback.",error);
    return legacy(query);
  }
}
