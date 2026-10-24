import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

import { normalizeApp } from "./app-contract";
export type * from "./app-contract";

import { normalizeAds, normalizeLocal } from "./digital-source-contract";
import { normalizeMetaAds, normalizeSocial } from "./meta-social-contract";
export type * from "./meta-social-contract";
export type * from "./digital-source-contract";
type Raw = Record<string, any>;

// Merchant remains a legacy contract; missing metrics require a separate correction.
const num=(v:unknown)=>{const n=Number(v??0);return Number.isFinite(n)?n:0;};

export type DigitalMerchantData={meta:{status:string;performanceFrom:string;performanceTo:string;performanceRows:number;catalogRows:number;healthRows:number};performance:{impressions:number;clicks:number;conversions:number;ctr:number;products:number};topProducts:Array<{productId:string;productTitle:string;impressions:number;clicks:number;conversions:number;ctr:number}>;catalog:{rows:number;inStock:number;outOfStock:number;withPrice:number};health:Array<{snapshotDate:string;country:string;reportingContext:string;activeCount:number;disapprovedCount:number;pendingCount:number;expiringCount:number}>};


function normalizeMerchant(raw:Raw):DigitalMerchantData{const m=raw?.meta??{},p=raw?.performance??{},c=raw?.catalog??{};return {meta:{status:String(m.status??""),performanceFrom:String(m.performanceFrom??""),performanceTo:String(m.performanceTo??""),performanceRows:num(m.performanceRows),catalogRows:num(m.catalogRows),healthRows:num(m.healthRows)},performance:{impressions:num(p.impressions),clicks:num(p.clicks),conversions:num(p.conversions),ctr:num(p.ctr),products:num(p.products)},topProducts:(raw?.topProducts??[]).map((x:Raw)=>({productId:String(x.product_id??""),productTitle:String(x.product_title??"—"),impressions:num(x.impressions),clicks:num(x.clicks),conversions:num(x.conversions),ctr:num(x.ctr)})),catalog:{rows:num(c.rows),inStock:num(c.inStock),outOfStock:num(c.outOfStock),withPrice:num(c.withPrice)},health:(raw?.health??[]).map((x:Raw)=>({snapshotDate:String(x.snapshot_date??""),country:String(x.country??""),reportingContext:String(x.reporting_context??""),activeCount:num(x.active_count),disapprovedCount:num(x.disapproved_count),pendingCount:num(x.pending_count),expiringCount:num(x.expiring_count)}))};}

const adsCache=unstable_cache(async()=>normalizeAds(await callBiRpc<Raw>("bi_digital_ads_payload")),["digital-ads-correctness-v4"],{revalidate:300,tags:["digital-data"]});
const localCache=unstable_cache(async()=>normalizeLocal(await callBiRpc<Raw>("bi_digital_local_payload")),["digital-local-correctness-v3"],{revalidate:300,tags:["digital-data"]});
const appCache=unstable_cache(async()=>normalizeApp(await callBiRpc<Raw>("bi_digital_app_payload")),["digital-app-evidence-v3"],{revalidate:300,tags:["digital-data"]});
const merchantCache=unstable_cache(async()=>normalizeMerchant(await callBiRpc<Raw>("bi_digital_merchant_payload")),["digital-merchant-v1"],{revalidate:300,tags:["digital-data"]});
const metaAdsCache=unstable_cache(async()=>normalizeMetaAds(await callBiRpc<Raw>("bi_digital_meta_ads_payload")),["digital-meta-ads-windsor-v3"],{revalidate:300,tags:["digital-data"]});
const socialCache=unstable_cache(async()=>normalizeSocial(await callBiRpc<Raw>("bi_digital_social_payload")),["digital-social-correctness-v2"],{revalidate:300,tags:["digital-data"]});

export async function loadDigitalAdsData(){return adsCache();}
export async function loadDigitalLocalData(){return localCache();}
export async function loadDigitalAppData(){return appCache();}
export async function loadDigitalMerchantData(){return merchantCache();}
export async function loadDigitalSocialData(){return socialCache();}

export async function loadDigitalMetaAdsData(){return metaAdsCache();}
