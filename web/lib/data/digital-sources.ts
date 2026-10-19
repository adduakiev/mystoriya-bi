import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

type Raw=Record<string,any>;
const num=(v:unknown)=>{const n=Number(v??0);return Number.isFinite(n)?n:0;};

export type AdsCampaign={
  campaignName:string; cost:number; clicks:number; impressions:number;
  conversions:number; conversionValue:number; ctr:number; cpc:number; cpa:number; roas:number;
};
export type DigitalAdsData={
  meta:{available:boolean;from:string;to:string;days:number;maxWindowDays:number};
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
export type AppSourceStatus={rows:number;latest?:string};
export type AppAdCampaign={platform:string;campaignName:string;spend:number;impressions:number;clicks:number;conversions:number;conversionValue:number;costPerConversion:number;fromDate:string;toDate:string};
export type DigitalAppData={meta:{status:string};sources:{store:AppSourceStatus;firebase:AppSourceStatus;quality:AppSourceStatus;acquisition:AppSourceStatus;users:AppSourceStatus;orders:AppSourceStatus};overview:{downloads:number;firstTimeDownloads:number;firstOpens:number;registrations:number;purchases:number;purchaseRevenue:number;registeredUsers:number;registeredNoOrder:number;buyers:number;orders:number;orderRevenue:number;repeatBuyers:number};economics:{spend:number;installs:number;registrations:number;firstBuyers:number;revenue:number};googleAdsApp:AppAdCampaign[]};

export type DigitalSocialData={meta:{facebookStatus:string;instagramStatus:string;facebookRows:number;facebookPostRows:number;instagramRows:number;instagramMediaRows:number};facebook:{from:string;to:string;followers:number;followersStart:number;dailyFollows:number;dailyUnfollows:number;impressions:number;organicImpressions:number;pageViews:number;rows:number};facebookPosts:Array<{postId:string;createdAt:string;message:string;impressions:number;reach:number;engagements:number;clicks:number;reactions:number;comments:number;engagementRate:number}>;instagram:{rows:number;latest:string;followers:number;reach:number;impressions:number;profileViews:number;websiteClicks:number;accountsEngaged:number};instagramMedia:Array<{mediaId:string;publishedAt:string;mediaType:string;caption:string;permalink:string;reach:number;impressions:number;plays:number;likes:number;comments:number;saves:number;shares:number}>};

export type DigitalMerchantData={meta:{status:string;performanceFrom:string;performanceTo:string;performanceRows:number;catalogRows:number;healthRows:number};performance:{impressions:number;clicks:number;conversions:number;ctr:number;products:number};topProducts:Array<{productId:string;productTitle:string;impressions:number;clicks:number;conversions:number;ctr:number}>;catalog:{rows:number;inStock:number;outOfStock:number;withPrice:number};health:Array<{snapshotDate:string;country:string;reportingContext:string;activeCount:number;disapprovedCount:number;pendingCount:number;expiringCount:number}>};

export type DigitalLocalData={
  meta:{from:string;to:string;days:number;locationCount:number;maxWindowDays:number};
  summary:{impressions:number;clicks:number;calls:number;websiteClicks:number;directions:number;menuClicks:number};
  locations:Array<{locationId:string;locationTitle:string;impressions:number;clicks:number;calls:number;websiteClicks:number;directions:number;menuClicks:number}>;
  pageSpeed:PageSpeedSnapshot|null;
};

function normalizeAds(raw:Raw):DigitalAdsData{
  const s=raw?.summary??{};
  return {
    meta:{available:Boolean(raw?.meta?.available),from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:num(raw?.meta?.days),maxWindowDays:num(raw?.meta?.maxWindowDays)},
    summary:{cost:num(s.cost),clicks:num(s.clicks),impressions:num(s.impressions),conversions:num(s.conversions),conversionValue:num(s.conversionValue),ctr:num(s.ctr),cpc:num(s.cpc),cpa:num(s.cpa),roas:num(s.roas)},
    campaigns:(raw?.campaigns??[]).map((x:Raw)=>({campaignName:String(x.campaign_name??"—"),cost:num(x.cost),clicks:num(x.clicks),impressions:num(x.impressions),conversions:num(x.conversions),conversionValue:num(x.conversion_value),ctr:num(x.ctr),cpc:num(x.cpc),cpa:num(x.cpa),roas:num(x.roas)})),
    trend:(raw?.trend??[]).map((x:Raw)=>({date:String(x.date??""),cost:num(x.cost),clicks:num(x.clicks),impressions:num(x.impressions),conversions:num(x.conversions),conversionValue:num(x.conversionValue)}))
  };
}
function normalizeApp(raw:Raw):DigitalAppData{const src=raw?.sources??{},o=raw?.overview??{},e=raw?.economics??{};const status=(x:Raw):AppSourceStatus=>({rows:num(x?.rows),latest:x?.latest?String(x.latest):undefined});return {meta:{status:String(raw?.meta?.status??"")},sources:{store:status(src.store),firebase:status(src.firebase),quality:status(src.quality),acquisition:status(src.acquisition),users:status(src.users),orders:status(src.orders)},overview:{downloads:num(o.downloads),firstTimeDownloads:num(o.firstTimeDownloads),firstOpens:num(o.firstOpens),registrations:num(o.registrations),purchases:num(o.purchases),purchaseRevenue:num(o.purchaseRevenue),registeredUsers:num(o.registeredUsers),registeredNoOrder:num(o.registeredNoOrder),buyers:num(o.buyers),orders:num(o.orders),orderRevenue:num(o.orderRevenue),repeatBuyers:num(o.repeatBuyers)},economics:{spend:num(e.spend),installs:num(e.installs),registrations:num(e.registrations),firstBuyers:num(e.firstBuyers),revenue:num(e.revenue)},googleAdsApp:(raw?.googleAdsApp??[]).map((x:Raw)=>({platform:String(x.platform??"unknown"),campaignName:String(x.campaign_name??"—"),spend:num(x.spend),impressions:num(x.impressions),clicks:num(x.clicks),conversions:num(x.conversions),conversionValue:num(x.conversion_value),costPerConversion:num(x.cost_per_conversion),fromDate:String(x.from_date??""),toDate:String(x.to_date??"")}))};}

function normalizeSocial(raw:Raw):DigitalSocialData{const m=raw?.meta??{},f=raw?.facebook??{},i=raw?.instagram??{};return {meta:{facebookStatus:String(m.facebookStatus??"waiting"),instagramStatus:String(m.instagramStatus??"waiting"),facebookRows:num(m.facebookRows),facebookPostRows:num(m.facebookPostRows),instagramRows:num(m.instagramRows),instagramMediaRows:num(m.instagramMediaRows)},facebook:{from:String(f.from??""),to:String(f.to??""),followers:num(f.followers),followersStart:num(f.followersStart),dailyFollows:num(f.dailyFollows),dailyUnfollows:num(f.dailyUnfollows),impressions:num(f.impressions),organicImpressions:num(f.organicImpressions),pageViews:num(f.pageViews),rows:num(f.rows)},facebookPosts:(raw?.facebookPosts??[]).map((x:Raw)=>({postId:String(x.post_id??""),createdAt:String(x.created_at??""),message:String(x.message??""),impressions:num(x.impressions),reach:num(x.reach),engagements:num(x.engagements),clicks:num(x.clicks),reactions:num(x.reactions),comments:num(x.comments),engagementRate:num(x.engagement_rate)})),instagram:{rows:num(i.rows),latest:String(i.latest??""),followers:num(i.followers),reach:num(i.reach),impressions:num(i.impressions),profileViews:num(i.profileViews),websiteClicks:num(i.websiteClicks),accountsEngaged:num(i.accountsEngaged)},instagramMedia:(raw?.instagramMedia??[]).map((x:Raw)=>({mediaId:String(x.media_id??""),publishedAt:String(x.published_at??""),mediaType:String(x.media_type??""),caption:String(x.caption??""),permalink:String(x.permalink??""),reach:num(x.reach),impressions:num(x.impressions),plays:num(x.plays),likes:num(x.likes),comments:num(x.comments),saves:num(x.saves),shares:num(x.shares)}))};}

function normalizeMerchant(raw:Raw):DigitalMerchantData{const m=raw?.meta??{},p=raw?.performance??{},c=raw?.catalog??{};return {meta:{status:String(m.status??""),performanceFrom:String(m.performanceFrom??""),performanceTo:String(m.performanceTo??""),performanceRows:num(m.performanceRows),catalogRows:num(m.catalogRows),healthRows:num(m.healthRows)},performance:{impressions:num(p.impressions),clicks:num(p.clicks),conversions:num(p.conversions),ctr:num(p.ctr),products:num(p.products)},topProducts:(raw?.topProducts??[]).map((x:Raw)=>({productId:String(x.product_id??""),productTitle:String(x.product_title??"—"),impressions:num(x.impressions),clicks:num(x.clicks),conversions:num(x.conversions),ctr:num(x.ctr)})),catalog:{rows:num(c.rows),inStock:num(c.inStock),outOfStock:num(c.outOfStock),withPrice:num(c.withPrice)},health:(raw?.health??[]).map((x:Raw)=>({snapshotDate:String(x.snapshot_date??""),country:String(x.country??""),reportingContext:String(x.reporting_context??""),activeCount:num(x.active_count),disapprovedCount:num(x.disapproved_count),pendingCount:num(x.pending_count),expiringCount:num(x.expiring_count)}))};}

function normalizeLocal(raw:Raw):DigitalLocalData{
  const s=raw?.summary??{},p=raw?.pageSpeed??{};
  const hasSpeed=Boolean(p.captured_on);
  return {
    meta:{from:String(raw?.meta?.from??""),to:String(raw?.meta?.to??""),days:num(raw?.meta?.days),locationCount:num(raw?.meta?.locationCount),maxWindowDays:num(raw?.meta?.maxWindowDays)},
    summary:{impressions:num(s.impressions),clicks:num(s.clicks),calls:num(s.calls),websiteClicks:num(s.websiteClicks),directions:num(s.directions),menuClicks:num(s.menuClicks)},
    locations:(raw?.locations??[]).map((x:Raw)=>({locationId:String(x.location_id??""),locationTitle:String(x.location_title??"—"),impressions:num(x.impressions),clicks:num(x.clicks),calls:num(x.calls),websiteClicks:num(x.website_clicks),directions:num(x.directions),menuClicks:num(x.menu_clicks)})),
    pageSpeed:hasSpeed?{capturedOn:String(p.captured_on),desktopScore:num(p.desktop_score),mobileScore:num(p.mobile_score),desktopLcp:num(p.desktop_lcp),desktopInp:num(p.desktop_inp),desktopCls:num(p.desktop_cls),mobileLcp:num(p.mobile_lcp),mobileInp:num(p.mobile_inp),mobileCls:num(p.mobile_cls),desktopCategory:String(p.desktop_category??""),mobileCategory:String(p.mobile_category??"")}:null
  };
}

const adsCache=unstable_cache(async()=>normalizeAds(await callBiRpc<Raw>("bi_digital_ads_payload")),["digital-ads-v1"],{revalidate:300,tags:["digital-data"]});
const localCache=unstable_cache(async()=>normalizeLocal(await callBiRpc<Raw>("bi_digital_local_payload")),["digital-local-v1"],{revalidate:300,tags:["digital-data"]});
const appCache=unstable_cache(async()=>normalizeApp(await callBiRpc<Raw>("bi_digital_app_payload")),["digital-app-v1"],{revalidate:300,tags:["digital-data"]});
const merchantCache=unstable_cache(async()=>normalizeMerchant(await callBiRpc<Raw>("bi_digital_merchant_payload")),["digital-merchant-v1"],{revalidate:300,tags:["digital-data"]});
const socialCache=unstable_cache(async()=>normalizeSocial(await callBiRpc<Raw>("bi_digital_social_payload")),["digital-social-v1"],{revalidate:300,tags:["digital-data"]});

export async function loadDigitalAdsData(){return adsCache();}
export async function loadDigitalLocalData(){return localCache();}
export async function loadDigitalAppData(){return appCache();}
export async function loadDigitalMerchantData(){return merchantCache();}
export async function loadDigitalSocialData(){return socialCache();}
