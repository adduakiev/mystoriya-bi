import { metricNumber, metricRatio, sourceCoverage, coreWebVitalsCategory } from "../digital-quality.ts";

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
export type DigitalLocalData={
  meta:{coverage:ReturnType<typeof sourceCoverage>;limitations:string[];from:string;to:string;days:number|null;locationCount:number|null;maxWindowDays:number|null};
  summary:{impressions:number|null;clicks:number|null;calls:number|null;websiteClicks:number|null;directions:number|null;menuClicks:number|null};
  locations:Array<{locationId:string;locationTitle:string;impressions:number|null;clicks:number|null;calls:number|null;websiteClicks:number|null;directions:number|null;menuClicks:number|null}>;
  pageSpeed:PageSpeedSnapshot|null;
};

export function normalizeAds(raw:Raw):DigitalAdsData{
  const s=raw?.meta?.available === true ? raw?.summary??{} : {};
  return {
    meta:{coverage:sourceCoverage(raw?.meta?.coverage),limitations:["Calendar span is not observed days; daily summary and staging campaigns may differ in freshness/currency. Completeness unknown."],available:raw?.meta?.available === true,from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:metricNumber(raw?.meta?.days),maxWindowDays:metricNumber(raw?.meta?.maxWindowDays)},
    summary:{cost:metricNumber(s.cost),clicks:metricNumber(s.clicks),impressions:metricNumber(s.impressions),conversions:metricNumber(s.conversions),conversionValue:metricNumber(s.conversionValue),ctr:metricRatio(s.clicks,s.impressions),cpc:metricRatio(s.cost,s.clicks),cpa:metricRatio(s.cost,s.conversions),roas:metricRatio(s.conversionValue,s.cost)},
    campaigns:(raw?.campaigns??[]).map((x:Raw)=>({campaignName:String(x.campaign_name??"—"),cost:metricNumber(x.cost),clicks:metricNumber(x.clicks),impressions:metricNumber(x.impressions),conversions:metricNumber(x.conversions),conversionValue:metricNumber(x.conversion_value),ctr:metricRatio(x.clicks,x.impressions),cpc:metricRatio(x.cost,x.clicks),cpa:metricRatio(x.cost,x.conversions),roas:metricRatio(x.conversion_value,x.cost)})),
    trend:(raw?.trend??[]).map((x:Raw)=>({date:String(x.date??""),cost:metricNumber(x.cost),clicks:metricNumber(x.clicks),impressions:metricNumber(x.impressions),conversions:metricNumber(x.conversions),conversionValue:metricNumber(x.conversionValue)}))
  };
}
export function normalizeLocal(raw:Raw):DigitalLocalData{
  const s=raw?.meta?.from && raw?.meta?.to && raw?.locations?.length ? raw?.summary??{} : {},p=raw?.pageSpeed??{};
  const hasSpeed=Boolean(p.captured_on);
  return {
    meta:{coverage:sourceCoverage(raw?.meta?.coverage),limitations:["Calendar span × locations is not observed rows. Completeness unknown.","PageSpeed captured_on is processing/storage date; source measurement date unknown."],from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:metricNumber(raw?.meta?.days),locationCount:metricNumber(raw?.meta?.locationCount),maxWindowDays:metricNumber(raw?.meta?.maxWindowDays)},
    summary:{impressions:metricNumber(s.impressions),clicks:metricNumber(s.clicks),calls:metricNumber(s.calls),websiteClicks:metricNumber(s.websiteClicks),directions:metricNumber(s.directions),menuClicks:metricNumber(s.menuClicks)},
    locations:(raw?.locations??[]).map((x:Raw)=>({locationId:String(x.location_id??""),locationTitle:String(x.location_title??"—"),impressions:metricNumber(x.impressions),clicks:metricNumber(x.clicks),calls:metricNumber(x.calls),websiteClicks:metricNumber(x.website_clicks),directions:metricNumber(x.directions),menuClicks:metricNumber(x.menu_clicks)})),
    pageSpeed:hasSpeed?{capturedOn:String(p.captured_on),measurementDate:null,fetchedAt:null,processedAt:typeof p.imported_at === "string" ? p.imported_at : null,desktopScore:metricNumber(p.desktop_score),mobileScore:metricNumber(p.mobile_score),desktopLcp:metricNumber(p.desktop_lcp),desktopInp:metricNumber(p.desktop_inp),desktopCls:metricNumber(p.desktop_cls),mobileLcp:metricNumber(p.mobile_lcp),mobileInp:metricNumber(p.mobile_inp),mobileCls:metricNumber(p.mobile_cls),desktopCategory:coreWebVitalsCategory(p.desktop_lcp,p.desktop_inp,p.desktop_cls),mobileCategory:coreWebVitalsCategory(p.mobile_lcp,p.mobile_inp,p.mobile_cls)}:null
  };
}

