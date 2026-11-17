import type { GrainMode, MetricMode } from "./filters";
import { isoWeekParts } from "./iso-week-contract";
import { isoWeekDateRange } from "./iso-week-dates";

export const COMPARISON_CONTRACT = "dynamics-period-comparison-v1";
export const dynamicsComparisonEnabled = () => process.env.BI_DYNAMICS_PERIOD_COMPARISON_V1 === "1";
export type ComparisonFilters = {channel: string | null; orderType: string | null; location: string | null; brand: string | null; ownership: string | null; lfl: boolean};
export type PeriodWindow = {key:string; label:string; currentStart:string; currentEnd:string; previousStart:string; previousEnd:string; naturalCurrentEnd:string; naturalPreviousEnd:string; currentDays:number; previousDays:number; partial:boolean; clampedDays:number};
export type ComparisonPeriod = PeriodWindow & {
  status:"ready"|"unavailable"; reason:string|null; current:number|null; previous:number|null; delta:number|null; unit:"percent"|"pp";
  cohort:{currentConfirmedZeroDays?:number; previousConfirmedZeroDays?:number; candidateCount:number; includedCount:number; excludedCount:number; registryExcludedCount:number; incompleteCount:number; mode:"pairwise-complete"|"all-locations"; currentObservedDays:number; previousObservedDays:number; currentExpectedDays:number; previousExpectedDays:number; currentCoverage:number|null; previousCoverage:number|null};
  observedCurrent:number|null; observedPrevious:number|null;
};
export type PeriodComparison = {contractVersion:typeof COMPARISON_CONTRACT; latestYear:number; cutoff:string; grain:GrainMode; metric:MetricMode; filters:ComparisonFilters; periods:ComparisonPeriod[]};
const day = 86400000;
const dateString=(date:Date)=>date.toISOString().slice(0,10);
const add=(date:Date,n:number)=>new Date(date.getTime()+n*day);
function date(value:string):Date {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("INVALID_DATE");
  const parsed=new Date(`${value}T00:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||dateString(parsed)!==value)throw Error("INVALID_DATE");
  return parsed;
}
// Calendar identity, not array adjacency; full months retain their natural lengths.
export function comparisonWindows(year:number,grain:GrainMode,cutoff:string):PeriodWindow[] {
  const end=date(cutoff);
  if(!Number.isInteger(year)||year<1900||year>9998 || (grain==="week"?isoWeekParts(end).year:end.getUTCFullYear())!==year)throw Error("INVALID_YEAR");
  const count=grain==="week"?isoWeekParts(end).week:end.getUTCMonth()+1;
  return Array.from({length:count},(_,i)=>{
    const n=i+1;
    const range=grain==="week"?isoWeekDateRange(year,n):null;
    const start=range?date(range.monday):new Date(Date.UTC(year,i,1));
    const naturalEnd=range?date(range.sunday):new Date(Date.UTC(year,i+1,0));
    const prevStart=grain==="week"?add(start,-7):new Date(Date.UTC(year,i-1,1));
    const naturalPrevEnd=add(start,-1);
    const partial=end<naturalEnd;
    const observedEnd=partial?end:naturalEnd;
    const elapsed=Math.round((observedEnd.getTime()-start.getTime())/day)+1;
    const prevDays=Math.round((naturalPrevEnd.getTime()-prevStart.getTime())/day)+1;
    const aligned=partial?Math.min(elapsed,prevDays):elapsed;
    const currentEnd=partial?add(start,aligned-1):naturalEnd;
    const previousEnd=partial?add(prevStart,aligned-1):naturalPrevEnd;
    return {key:grain==="week"?`${year}-W${String(n).padStart(2,"0")}`:`${year}-${String(n).padStart(2,"0")}`,label:grain==="week"?`W${String(n).padStart(2,"0")}`:String(n).padStart(2,"0"),currentStart:dateString(start),currentEnd:dateString(currentEnd),previousStart:dateString(prevStart),previousEnd:dateString(previousEnd),naturalCurrentEnd:dateString(naturalEnd),naturalPreviousEnd:dateString(naturalPrevEnd),currentDays:aligned,previousDays:partial?aligned:prevDays,partial,clampedDays:elapsed-aligned};
  });
}
const finite=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v);
const nullable=(v:unknown)=>v===null||finite(v);
const integer=(v:unknown):v is number=>finite(v)&&Number.isSafeInteger(v)&&v>=0;
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==="object"&&!Array.isArray(v);
export function periodDelta(current:number|null,previous:number|null,metric:MetricMode):number|null {
  if(current===null||previous===null)return null;
  if(metric==="markupRate")return current-previous;
  return previous===0?null:(current/previous-1)*100;
}
export function validatePeriodComparison(input:unknown,expected:{latestYear:number; cutoff:string; grain:GrainMode; metric:MetricMode; filters:ComparisonFilters}):PeriodComparison|null {
  try {
    if(!object(input)||input.contractVersion!==COMPARISON_CONTRACT||input.status!=="ready"||input.reason!==null||!object(input.filters))return null;
    for(const k of ["latestYear","cutoff","grain","metric"] as const)if(input[k]!==expected[k])return null;
    for(const k of Object.keys(expected.filters) as Array<keyof ComparisonFilters>)if(input.filters[k]!==expected.filters[k])return null;
    const windows=comparisonWindows(expected.latestYear,expected.grain,expected.cutoff);
    if(!Array.isArray(input.periods)||input.periods.length!==windows.length)return null;
    const periods:ComparisonPeriod[]=[];
    for(let i=0;i<windows.length;i++) {
      const p=input.periods[i],w=windows[i];
      if(!object(p)||!object(p.cohort))return null;
      for(const k of Object.keys(w) as Array<keyof PeriodWindow>)if(p[k]!==w[k])return null;
      if(p.status!=="ready"&&p.status!=="unavailable")return null;
      if(p.unit!==(expected.metric==="markupRate"?"pp":"percent"))return null;
      if(![p.current,p.previous,p.delta,p.observedCurrent,p.observedPrevious].every(nullable))return null;
      const c=p.cohort;
      for(const k of ["candidateCount","includedCount","excludedCount","registryExcludedCount","incompleteCount","currentObservedDays","previousObservedDays","currentExpectedDays","previousExpectedDays"])if(!integer(c[k]))return null;
      if(c.mode!==(expected.filters.lfl?"pairwise-complete":"all-locations")||Number(c.includedCount)+Number(c.excludedCount)!==c.candidateCount)return null;
      for(const k of ["currentCoverage","previousCoverage"])if(c[k]!==null&&(!finite(c[k])||c[k]<0||c[k]>1))return null;
      if(Number(c.excludedCount)!==Number(c.registryExcludedCount)+Number(c.incompleteCount))return null;
      for(const side of ["current","previous"] as const) {
        const expectedDays=Number(c.includedCount)*w[`${side}Days`];
        const observedDays=Number(c[`${side}ObservedDays`]);
        const coverage=c[`${side}Coverage`];
        const confirmed=c[`${side}ConfirmedZeroDays`];
        if(confirmed!==undefined&&(!integer(confirmed)||confirmed>observedDays))return null;
        if(c[`${side}ExpectedDays`]!==expectedDays||observedDays>expectedDays)return null;
        if(expectedDays===0?coverage!==null:!finite(coverage)||Math.abs(coverage-observedDays/expectedDays)>1e-9)return null;
      }
      if(p.status==="ready") {
        if(p.reason!==null||!finite(p.current)||!finite(p.previous)||Number(c.includedCount)===0||c.currentCoverage!==1||c.previousCoverage!==1||(!expected.filters.lfl&&c.excludedCount!==0))return null;
        const delta=periodDelta(p.current,p.previous,expected.metric);
        if(delta===null?p.delta!==null:!finite(p.delta)||Math.abs(p.delta-delta)>1e-7*Math.max(1,Math.abs(delta)))return null;
      } else if(!["NO_TRUSTWORTHY_COHORT","INCOMPLETE_COVERAGE","UNDEFINED_METRIC"].includes(String(p.reason))||p.current!==null||p.previous!==null||p.delta!==null)return null;
      periods.push(p as unknown as ComparisonPeriod);
    }
    return {...expected,contractVersion:COMPARISON_CONTRACT,periods};
  } catch{return null;}
}
export function comparisonReason(period:ComparisonPeriod|undefined):string {
  if(!period)return "Порівняння ще не підтверджене джерелом";
  if(period.reason==="NO_TRUSTWORTHY_COHORT")return "Немає спільних точок із повними спостереженнями в обох періодах";
  if(period.reason==="INCOMPLETE_COVERAGE")return "У порівнюваних періодах є пропущені дні даних";
  if(period.reason==="UNDEFINED_METRIC")return "Показник не визначений: нульовий знаменник";
  if(period.delta===null&&period.previous===0)return "Попереднє значення дорівнює нулю: відсоток зміни не визначений";
  return "";
}
