import { metricNumber, metricRatio, sourceCoverage, coreWebVitalsCategory } from "../digital-quality.ts";
import { verifiedAdsRoas } from "../ads-roas.ts";

type Raw=Record<string,any>;

export type AdsCampaign={
  campaignName:string; cost:number|null; clicks:number|null; impressions:number|null;
  conversions:number|null; conversionValue:number|null; ctr:number|null; cpc:number|null; cpa:number|null; roas:number|null;
};
export type DigitalAdsData={
  meta:{coverage:ReturnType<typeof sourceCoverage>;limitations:string[];available:boolean;from:string;to:string;days:number|null;maxWindowDays:number|null};
  summary:{cost:number|null;clicks:number|null;impressions:number|null;conversions:number|null;conversionValue:number|null;ctr:number|null;cpc:number|null;cpa:number|null;roas:number|null};
  campaigns:AdsCampaign[];
  trend:Array<{date:string;cost:number|null;clicks:number|null;impressions:number|null;conversions:number|null;conversionValue:number|null}>;
};
export type PageSpeedSnapshot={
  capturedOn:string; measurementDate:null; fetchedAt:null; processedAt:string|null; desktopScore:number|null; mobileScore:number|null;
  desktopLcp:number|null; desktopInp:number|null; desktopCls:number|null;
  mobileLcp:number|null; mobileInp:number|null; mobileCls:number|null;
  desktopCategory:string; mobileCategory:string;
};
export type LocalSourceIssue={code:"UPSTREAM_ERROR"|"INVALID_PAYLOAD";rejectedLocations:number;message:string};
export type DigitalLocalData={
  meta:{historicalDataValidated:boolean;sourceIssue:LocalSourceIssue|null;coverage:ReturnType<typeof sourceCoverage>;limitations:string[];from:string;to:string;days:number|null;locationCount:number|null;maxWindowDays:number|null};
  summary:{impressions:number|null;clicks:number|null;calls:number|null;websiteClicks:number|null;directions:number|null;menuClicks:number|null};
  locations:Array<{locationId:string;locationTitle:string;impressions:number|null;clicks:number|null;calls:number|null;websiteClicks:number|null;directions:number|null;menuClicks:number|null}>;
  pageSpeed:PageSpeedSnapshot|null;
};

/** Selected-period evidence wins over availability flags, dates and profile lists.
 * Explicit rows/observedDates=0 means no measurement. A legacy zero without
 * positive selected-period evidence remains unknown; measured zero is preserved.
 */
export function selectedPeriodMetric(meta: Raw | undefined, value: unknown): number | null {
  const rows = metricNumber(meta?.rows);
  const observedDates = metricNumber(meta?.observedDates);
  if (rows === 0 || observedDates === 0) return null;
  const metric = metricNumber(value);
  if (metric === 0 && !((rows !== null && rows > 0) || (observedDates !== null && observedDates > 0))) return null;
  return metric;
}

export function normalizeAds(raw:Raw):DigitalAdsData{
  const summary=raw?.meta?.available === true ? raw?.summary??{} : {};
  const s=Object.fromEntries(Object.entries(summary).map(([key,value])=>[key,selectedPeriodMetric(raw?.meta,value)]));
  return {
    meta:{coverage:sourceCoverage(raw?.meta?.coverage),limitations:["Calendar span is not observed days; daily summary and staging campaigns may differ in freshness/currency. Completeness unknown. ROAS withheld: same-account/same-currency value and spend unverified."],available:raw?.meta?.available === true,from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:metricNumber(raw?.meta?.days),maxWindowDays:metricNumber(raw?.meta?.maxWindowDays)},
    summary:{cost:metricNumber(s.cost),clicks:metricNumber(s.clicks),impressions:metricNumber(s.impressions),conversions:metricNumber(s.conversions),conversionValue:metricNumber(s.conversionValue),ctr:metricRatio(s.clicks,s.impressions),cpc:metricRatio(s.cost,s.clicks),cpa:metricRatio(s.cost,s.conversions),roas:verifiedAdsRoas(s.conversionValue,s.cost)},
    campaigns:(raw?.campaigns??[]).map((x:Raw)=>({campaignName:String(x.campaign_name??"—"),cost:metricNumber(x.cost),clicks:metricNumber(x.clicks),impressions:metricNumber(x.impressions),conversions:metricNumber(x.conversions),conversionValue:metricNumber(x.conversion_value),ctr:metricRatio(x.clicks,x.impressions),cpc:metricRatio(x.cost,x.clicks),cpa:metricRatio(x.cost,x.conversions),roas:verifiedAdsRoas(x.conversion_value,x.cost)})),
    trend:(raw?.trend??[]).map((x:Raw)=>({date:String(x.date??""),cost:metricNumber(x.cost),clicks:metricNumber(x.clicks),impressions:metricNumber(x.impressions),conversions:metricNumber(x.conversions),conversionValue:metricNumber(x.conversionValue)}))
  };
}
/** Windsor can serialize a billing error into every exported text field.
 * Such rows are not observations. The aggregate RPC supplies no per-location
 * dates, so dropping only the pseudo-location cannot repair its shifted window.
 * Withhold contaminated GBP figures and dates until the source/read model is fixed.
 * Never expose the upstream error text, which can contain account details.
 */
const GBP_OBSERVATION_CONTRACT="gbp-valid-observations-v1";
const gbpProviderError=(value:unknown)=>typeof value === "string" &&
  /these are not your real numbers|reads are paused|(?:free|current) plan includes|(?:quota|rate|account) limit exceeded|billing (?:error|limit)/iu.test(value);
/** Only the guarded RPC contract can expose historical metrics during a source error. */
function validGbpHistory(raw:Raw):boolean {
  const m=raw?.meta,rows=raw?.locations;
  if(m?.gbpObservationContract!==GBP_OBSERVATION_CONTRACT||!Array.isArray(rows)||rows.length===0||raw?.error||raw?.success===false||raw?.status==="error")return false;
  const isoDate=(value:unknown)=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(!isoDate(m.from)||!isoDate(m.to)||m.validThrough!==m.to)return false;
  const days=(Date.parse(m.to)-Date.parse(m.from))/86400000+1;
  if(!Number.isInteger(days)||days<1||days>30||m.days!==days||m.locationCount!==rows.length)return false;
  if(!Number.isInteger(m.rows)||m.rows<Math.max(rows.length,m.observedDates)||m.rows>days*rows.length||!Number.isInteger(m.observedDates)||m.observedDates<1||m.observedDates>days)return false;
  return new Set(rows.map((row:Raw)=>row?.location_id)).size===rows.length&&rows.every((row:Raw)=>
    row&&typeof row==="object"&&!Array.isArray(row)&&typeof row.location_id==="string"&&/^locations\/[0-9]+$/.test(row.location_id)&&!gbpProviderError(row.location_title)&&!row.error&&row.success!==false&&row.status!=="error");
}
function localSourceIssue(raw:Raw):LocalSourceIssue|null {
  const providerText=gbpProviderError;
  const hasError=(record:Raw)=>Boolean(record?.error) || record?.success === false ||
    record?.status === "error" || [record?.message,record?.location_id,record?.location_title].some(providerText);
  const input=raw?.locations;
  const invalidContract=raw?.meta?.gbpObservationContract===GBP_OBSERVATION_CONTRACT&&raw?.meta?.rows>0&&!validGbpHistory(raw);
  const invalidShape=invalidContract || input != null && (!Array.isArray(input) || input.some((row:unknown)=>!row || typeof row!=="object" || Array.isArray(row)));
  const rejectedLocations=Array.isArray(input)?input.filter((row:Raw)=>row && typeof row==="object" && hasError(row)).length:0;
  if(!invalidShape&&!hasError(raw)&&!hasError(raw?.meta)&&!providerText(raw)&&rejectedLocations===0)return null;
  return {
    code:invalidShape?"INVALID_PAYLOAD":"UPSTREAM_ERROR",rejectedLocations,
    message:"Джерело Google Business Profile повернуло помилку замість даних. Показники та свіжість цього звіту не підтверджені; помилку не враховано як заклад або нульові показники. Потрібна перевірка джерела Windsor.",
  };
}
export function normalizeLocal(raw:Raw):DigitalLocalData{
  const detectedIssue=localSourceIssue(raw);
  const historicalDataValidated=validGbpHistory(raw);
  const issue=detectedIssue&&historicalDataValidated?{...detectedIssue,message:`Оновлення Google Business Profile містить помилку джерела. Показано лише перевірені історичні вимірювання до ${raw.meta.validThrough}; актуальність після цієї дати не підтверджена. Потрібна перевірка джерела Windsor.`}:detectedIssue;
  const blocked=Boolean(issue)&&!historicalDataValidated;
  const summary=blocked?{}:raw?.summary??{},p=raw?.pageSpeed??{};
  const s=Object.fromEntries(Object.entries(summary).map(([key,value])=>[key,selectedPeriodMetric(raw?.meta,value)]));
  const hasSpeed=Boolean(p.captured_on);
  return {
    meta:{historicalDataValidated,sourceIssue:issue,coverage:sourceCoverage(blocked?"UNKNOWN":raw?.meta?.coverage),limitations:["Calendar span × locations is not observed rows. Completeness unknown.","PageSpeed captured_on is processing/storage date; source measurement date unknown.",...(issue?[issue.message]:[])],from:blocked?"":String(raw?.meta?.from??""),to:blocked?"":String(raw?.meta?.to??""),days:blocked?null:metricNumber(raw?.meta?.days),locationCount:blocked?null:metricNumber(raw?.meta?.locationCount),maxWindowDays:metricNumber(raw?.meta?.maxWindowDays)},
    summary:{impressions:metricNumber(s.impressions),clicks:metricNumber(s.clicks),calls:metricNumber(s.calls),websiteClicks:metricNumber(s.websiteClicks),directions:metricNumber(s.directions),menuClicks:metricNumber(s.menuClicks)},
    locations:(blocked?[]:raw?.locations??[]).map((x:Raw)=>({locationId:String(x.location_id??""),locationTitle:String(x.location_title??"—"),impressions:metricNumber(x.impressions),clicks:metricNumber(x.clicks),calls:metricNumber(x.calls),websiteClicks:metricNumber(x.website_clicks),directions:metricNumber(x.directions),menuClicks:metricNumber(x.menu_clicks)})),
    pageSpeed:hasSpeed?{capturedOn:String(p.captured_on),measurementDate:null,fetchedAt:null,processedAt:typeof p.imported_at === "string" ? p.imported_at : null,desktopScore:metricNumber(p.desktop_score),mobileScore:metricNumber(p.mobile_score),desktopLcp:metricNumber(p.desktop_lcp),desktopInp:metricNumber(p.desktop_inp),desktopCls:metricNumber(p.desktop_cls),mobileLcp:metricNumber(p.mobile_lcp),mobileInp:metricNumber(p.mobile_inp),mobileCls:metricNumber(p.mobile_cls),desktopCategory:coreWebVitalsCategory(p.desktop_lcp,p.desktop_inp,p.desktop_cls),mobileCategory:coreWebVitalsCategory(p.mobile_lcp,p.mobile_inp,p.mobile_cls)}:null
  };
}
