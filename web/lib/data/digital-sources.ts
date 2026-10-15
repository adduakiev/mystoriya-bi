import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

type Raw=Record<string,any>;
const num=(v:unknown)=>{const n=Number(v??0);return Number.isFinite(n)?n:0;};

export type AdsCampaign={
  campaignName:string; cost:number; clicks:number; impressions:number;
  conversions:number; conversionValue:number; ctr:number; cpc:number; cpa:number; roas:number;
};
export type DigitalAdsData={
  meta:{available:boolean;from:string;to:string;days:number};
  summary:{cost:number;clicks:number;impressions:number;conversions:number;conversionValue:number;ctr:number;cpc:number;cpa:number;roas:number};
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
  meta:{from:string;to:string};
  summary:{impressions:number;clicks:number;calls:number;websiteClicks:number;directions:number;menuClicks:number};
  locations:Array<{locationId:string;locationTitle:string;impressions:number;clicks:number;calls:number;websiteClicks:number;directions:number;menuClicks:number}>;
  pageSpeed:PageSpeedSnapshot|null;
};

function normalizeAds(raw:Raw):DigitalAdsData{
  const s=raw?.summary??{};
  return {
    meta:{available:Boolean(raw?.meta?.available),from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:num(raw?.meta?.days)},
    summary:{cost:num(s.cost),clicks:num(s.clicks),impressions:num(s.impressions),conversions:num(s.conversions),conversionValue:num(s.conversionValue),ctr:num(s.ctr),cpc:num(s.cpc),cpa:num(s.cpa),roas:num(s.roas)},
    campaigns:(raw?.campaigns??[]).map((x:Raw)=>({campaignName:String(x.campaign_name??"—"),cost:num(x.cost),clicks:num(x.clicks),impressions:num(x.impressions),conversions:num(x.conversions),conversionValue:num(x.conversion_value),ctr:num(x.ctr),cpc:num(x.cpc),cpa:num(x.cpa),roas:num(x.roas)})),
    trend:(raw?.trend??[]).map((x:Raw)=>({date:String(x.date??""),cost:num(x.cost),clicks:num(x.clicks),impressions:num(x.impressions),conversions:num(x.conversions),conversionValue:num(x.conversionValue)}))
  };
}
function normalizeLocal(raw:Raw):DigitalLocalData{
  const s=raw?.summary??{},p=raw?.pageSpeed??{};
  const hasSpeed=Boolean(p.captured_on);
  return {
    meta:{from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??"")},
    summary:{impressions:num(s.impressions),clicks:num(s.clicks),calls:num(s.calls),websiteClicks:num(s.websiteClicks),directions:num(s.directions),menuClicks:num(s.menuClicks)},
    locations:(raw?.locations??[]).map((x:Raw)=>({locationId:String(x.location_id??""),locationTitle:String(x.location_title??"—"),impressions:num(x.impressions),clicks:num(x.clicks),calls:num(x.calls),websiteClicks:num(x.website_clicks),directions:num(x.directions),menuClicks:num(x.menu_clicks)})),
    pageSpeed:hasSpeed?{capturedOn:String(p.captured_on),desktopScore:num(p.desktop_score),mobileScore:num(p.mobile_score),desktopLcp:num(p.desktop_lcp),desktopInp:num(p.desktop_inp),desktopCls:num(p.desktop_cls),mobileLcp:num(p.mobile_lcp),mobileInp:num(p.mobile_inp),mobileCls:num(p.mobile_cls),desktopCategory:String(p.desktop_category??""),mobileCategory:String(p.mobile_category??"")}:null
  };
}

const adsCache=unstable_cache(async()=>normalizeAds(await callBiRpc<Raw>("bi_digital_ads_payload")),["digital-ads-v1"],{revalidate:300,tags:["digital-data"]});
const localCache=unstable_cache(async()=>normalizeLocal(await callBiRpc<Raw>("bi_digital_local_payload")),["digital-local-v1"],{revalidate:300,tags:["digital-data"]});

export async function loadDigitalAdsData(){return adsCache();}
export async function loadDigitalLocalData(){return localCache();}
