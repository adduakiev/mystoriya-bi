import { comparisonReason, type ComparisonPeriod } from "@/lib/dynamics-comparison";
import type { MetricMode } from "@/lib/filters";
const display=(value:number|null,metric:MetricMode)=>value===null?"—":metric==="markupRate"?`${value.toFixed(1)}%`:new Intl.NumberFormat("uk-UA",{maximumFractionDigits:metric==="checks"?0:2}).format(value)+(metric==="checks"?"":" ₴");
const dates=(start:string,end:string)=>`${start} → ${end}`;
export function DynamicsComparisonCell({period,metric,label}:{period?:ComparisonPeriod;metric:MetricMode;label:string}) {
  const delta=period?.delta??null;
  const reason=comparisonReason(period);
  const text=delta===null?"—":`${delta>=0?"+":""}${delta.toFixed(1)}${metric==="markupRate"?" п.п.":"%"}`;
  return <details className="dynamics-period-detail">
    <summary className={delta===null?"":delta>=0?"positive":"negative"} aria-label={`${label}: ${text}. Показати базу порівняння`}>{text}</summary>
    <div className="dynamics-period-explanation">
      {period && <><span>Поточний: {dates(period.currentStart,period.currentEnd)} · {display(period.current,metric)}</span><span>Попередній: {dates(period.previousStart,period.previousEnd)} · {display(period.previous,metric)}</span>
      <span>{period.partial?"Неповний період · зіставні дні":"Повні календарні періоди"}: {period.currentDays} / {period.previousDays} днів.</span>
      {period.clampedDays>0&&<span>{period.clampedDays} дн. поточного періоду не включено: попередній місяць коротший.</span>}
      <span>Точки з повними спостереженнями: {period.cohort.includedCount} / {period.cohort.candidateCount}. Виключено з пари: {period.cohort.excludedCount}.</span>
      {period.cohort.mode==="pairwise-complete"&&<span>LFL: однакові точки в обох періодах; набір визначено окремо для цієї пари. Реєстр виключив {period.cohort.registryExcludedCount} точок.</span>}</>}
      {reason&&<span>{reason}.</span>}
    </div>
  </details>;
}
