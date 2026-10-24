import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";

import { normalizeMerchant } from "./merchant-contract";
export type * from "./merchant-contract";

import { normalizeApp } from "./app-contract";
export type * from "./app-contract";

import { normalizeAds, normalizeLocal } from "./digital-source-contract";
import { normalizeMetaAds, normalizeSocial } from "./meta-social-contract";
export type * from "./meta-social-contract";
export type * from "./digital-source-contract";
type Raw = Record<string, any>;

const adsCache=unstable_cache(async()=>normalizeAds(await callBiRpc<Raw>("bi_digital_ads_payload")),["digital-ads-correctness-v4"],{revalidate:300,tags:["digital-data"]});
const localCache=unstable_cache(async()=>normalizeLocal(await callBiRpc<Raw>("bi_digital_local_payload")),["digital-local-correctness-v3"],{revalidate:300,tags:["digital-data"]});
const appCache=unstable_cache(async()=>normalizeApp(await callBiRpc<Raw>("bi_digital_app_payload")),["digital-app-evidence-v3"],{revalidate:300,tags:["digital-data"]});
const merchantCache=unstable_cache(async()=>normalizeMerchant(await callBiRpc<Raw>("bi_digital_merchant_payload")),["digital-merchant-nullable-v2"],{revalidate:300,tags:["digital-data"]});
const metaAdsCache=unstable_cache(async()=>normalizeMetaAds(await callBiRpc<Raw>("bi_digital_meta_ads_payload")),["digital-meta-ads-windsor-v3"],{revalidate:300,tags:["digital-data"]});
const socialCache=unstable_cache(async()=>normalizeSocial(await callBiRpc<Raw>("bi_digital_social_payload")),["digital-social-correctness-v2"],{revalidate:300,tags:["digital-data"]});

export async function loadDigitalAdsData(){return adsCache();}
export async function loadDigitalLocalData(){return localCache();}
export async function loadDigitalAppData(){return appCache();}
export async function loadDigitalMerchantData(){return merchantCache();}
export async function loadDigitalSocialData(){return socialCache();}

export async function loadDigitalMetaAdsData(){return metaAdsCache();}
