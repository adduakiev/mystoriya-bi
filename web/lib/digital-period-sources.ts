import { metricNumber, metricRatio } from "./digital-quality.ts";

type Raw=Record<string,any>;
const num=(v:unknown)=>{const n=Number(v??0);return Number.isFinite(n)?n:0;};

export type AdsCampaign={
  campaignName:string; cost:number; clicks:number; impressions:number;
  conversions:number; conversionValue:number; ctr:number|null; cpc:number|null; cpa:number|null; roas:number|null;
};
export type DigitalAdsData={
  meta:{available:boolean;from:string;to:string;days:number;maxWindowDays:number};
  summary:{cost:number|null;clicks:number|null;impressions:number|null;conversions:number|null;conversionValue:number|null;ctr:number|null;cpc:number|null;cpa:number|null;roas:number|null};
  campaigns:AdsCampaign[];
  trend:Array<{date:string;cost:number;clicks:number;impressions:number;conversions:number;conversionValue:number}>;
};
export type PageSpeedSnapshot={
  capturedOn:string; desktopScore:number; mobileScore:number;
  desktopLcp:number; desktopInp:number; desktopCls:number;
  mobileLcp:number; mobileInp:number; mobileCls:number;
  desktopCategory:string; mobileCategory:string;
};
export type DigitalLocalData={
  meta:{from:string;to:string;days:number;locationCount:number;maxWindowDays:number};
  summary:{impressions:number|null;clicks:number|null;calls:number|null;websiteClicks:number|null;directions:number|null;menuClicks:number|null};
  locations:Array<{locationId:string;locationTitle:string;impressions:number;clicks:number;calls:number;websiteClicks:number;directions:number;menuClicks:number}>;
  pageSpeed:PageSpeedSnapshot|null;
};

/** Explicit empty-period metadata wins over flags, dates and legacy COALESCE zeroes.
 * Counts refer to the selected period; account/profile existence is not evidence.
 * Without positive counts, legacy zeroes cannot be distinguished from missing data.
 */
export function periodMetric(meta: Raw | undefined, value: unknown): number | null {
  const rows = metricNumber(meta?.rows);
  const observedDates = metricNumber(meta?.observedDates);
  if (rows === 0 || observedDates === 0) return null;
  const metric = metricNumber(value);
  if (metric === 0 && !((rows !== null && rows > 0) ||
      (observedDates !== null && observedDates > 0))) return null;
  return metric;
}

export function normalizeAds(raw:Raw):DigitalAdsData{
  const summary=raw?.summary??{};
  const s=Object.fromEntries(Object.entries(summary).map(([key,value])=>[key,raw?.meta?.available === true ? periodMetric(raw?.meta,value) : null]));
  return {
    meta:{available:Boolean(raw?.meta?.available),from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:num(raw?.meta?.days),maxWindowDays:num(raw?.meta?.maxWindowDays)},
    summary:{cost:metricNumber(s.cost),clicks:metricNumber(s.clicks),impressions:metricNumber(s.impressions),conversions:metricNumber(s.conversions),conversionValue:metricNumber(s.conversionValue),ctr:metricRatio(s.clicks,s.impressions),cpc:metricRatio(s.cost,s.clicks),cpa:metricRatio(s.cost,s.conversions),roas:metricRatio(s.conversionValue,s.cost)},
    campaigns:(raw?.campaigns??[]).map((x:Raw)=>({campaignName:String(x.campaign_name??"—"),cost:num(x.cost),clicks:num(x.clicks),impressions:num(x.impressions),conversions:num(x.conversions),conversionValue:num(x.conversion_value),ctr:metricRatio(x.clicks,x.impressions),cpc:metricRatio(x.cost,x.clicks),cpa:metricRatio(x.cost,x.conversions),roas:metricRatio(x.conversion_value,x.cost)})),
    trend:(raw?.trend??[]).map((x:Raw)=>({date:String(x.date??""),cost:num(x.cost),clicks:num(x.clicks),impressions:num(x.impressions),conversions:num(x.conversions),conversionValue:num(x.conversionValue)}))
  };
}
export function normalizeLocal(raw:Raw):DigitalLocalData{
  const summary=raw?.summary??{},p=raw?.pageSpeed??{};
  const s=Object.fromEntries(Object.entries(summary).map(([key,value])=>[key,periodMetric(raw?.meta,value)]));
  const hasSpeed=Boolean(p.captured_on);
  return {
    meta:{from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:num(raw?.meta?.days),locationCount:num(raw?.meta?.locationCount),maxWindowDays:num(raw?.meta?.maxWindowDays)},
    summary:{impressions:metricNumber(s.impressions),clicks:metricNumber(s.clicks),calls:metricNumber(s.calls),websiteClicks:metricNumber(s.websiteClicks),directions:metricNumber(s.directions),menuClicks:metricNumber(s.menuClicks)},
    locations:(raw?.locations??[]).map((x:Raw)=>({locationId:String(x.location_id??""),locationTitle:String(x.location_title??"—"),impressions:num(x.impressions),clicks:num(x.clicks),calls:num(x.calls),websiteClicks:num(x.website_clicks),directions:num(x.directions),menuClicks:num(x.menu_clicks)})),
    pageSpeed:hasSpeed?{capturedOn:String(p.captured_on),desktopScore:num(p.desktop_score),mobileScore:num(p.mobile_score),desktopLcp:num(p.desktop_lcp),desktopInp:num(p.desktop_inp),desktopCls:num(p.desktop_cls),mobileLcp:num(p.mobile_lcp),mobileInp:num(p.mobile_inp),mobileCls:num(p.mobile_cls),desktopCategory:String(p.desktop_category??""),mobileCategory:String(p.mobile_category??"")}:null
  };
}

