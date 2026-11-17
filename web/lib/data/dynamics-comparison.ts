import { unstable_cache } from "next/cache";
import { callBiRpc } from "@/lib/data/source";
import { optionalSalesDimension } from "./rpc-parameters";
import type { DynamicsQuery } from "./dynamics";
import { dynamicsComparisonEnabled, validatePeriodComparison, type PeriodComparison, type ComparisonFilters } from "../dynamics-comparison";

export async function loadDynamicsComparison(query:DynamicsQuery,expected:{latestYear:number;cutoff:string}):Promise<PeriodComparison|null> {
  if(!dynamicsComparisonEnabled())return null;
  const filters:ComparisonFilters={channel:optionalSalesDimension(query.channel),orderType:optionalSalesDimension(query.orderType),location:optionalSalesDimension(query.location),brand:optionalSalesDimension(query.brand),ownership:optionalSalesDimension(query.ownership),lfl:query.lfl};
  try {
    const payload=await unstable_cache(()=>callBiRpc<unknown>("bi_dynamics_period_comparison",{
      p_metric:query.metric,p_grain:query.grain,p_channel:filters.channel,p_order_type:filters.orderType,p_location:filters.location,p_brand:filters.brand,p_ownership:filters.ownership,p_lfl:filters.lfl
    }),["bi-dynamics-comparison-v1",JSON.stringify([query.metric,query.grain,filters])],{revalidate:180,tags:["sales-data","dynamics-data"]})();
    return validatePeriodComparison(payload,{...expected,grain:query.grain,metric:query.metric,filters});
  } catch {
    // Never fabricate a comparison from an adjacent displayed row or a legacy fallback.
    return null;
  }
}
