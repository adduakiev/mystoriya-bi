import { metricNumber, metricRatio } from "../digital-quality.ts";
import { currencyEvidence, type CurrencyEvidence } from "../source-evidence.ts";
type Raw = Record<string, any>;
export type AppSourceStatus = {
    rows: number | null;
    latest?: string;
};
export type AppAdCampaign = CurrencyEvidence & {
    accountId: string | null;
    platform: string;
    campaignName: string;
    spend: number | null;
    impressions: number | null;
    clicks: number | null;
    conversions: number | null;
    conversionValue: number | null;
    costPerConversion: number | null;
    fromDate: string;
    toDate: string;
};
export type DigitalAppData = {
    meta: {
        status: string;
    };
    sources: {
        store: AppSourceStatus;
        firebase: AppSourceStatus;
        quality: AppSourceStatus;
        acquisition: AppSourceStatus;
        users: AppSourceStatus;
        orders: AppSourceStatus;
    };
    overview: {
        downloads: number | null;
        firstTimeDownloads: number | null;
        firstOpens: number | null;
        registrations: number | null;
        purchases: number | null;
        purchaseRevenue: number | null;
        registeredUsers: number | null;
        registeredNoOrder: number | null;
        buyers: number | null;
        orders: number | null;
        orderRevenue: number | null;
        repeatBuyers: number | null;
    };
    economics: {
        spend: number | null;
        installs: number | null;
        registrations: number | null;
        firstBuyers: number | null;
        revenue: number | null;
    };
    googleAdsApp: AppAdCampaign[];
};
/** Preserve values the RPC actually knows; row presence alone cannot prove field completeness.
 * SQL-coalesced historical zeros cannot be recovered here (audit finding D04).
 */
export function normalizeApp(raw: Raw): DigitalAppData {
    const src = raw?.sources ?? {}, o = raw?.overview ?? {}, e = raw?.economics ?? {};
    const status = (x: Raw): AppSourceStatus => ({
        rows: metricNumber(x?.rows), latest: x?.latest ? String(x.latest) : undefined
    });
    return {
        meta: { status: String(raw?.meta?.status ?? "") },
        sources: {
            store: status(src.store), firebase: status(src.firebase), quality: status(src.quality),
            acquisition: status(src.acquisition), users: status(src.users), orders: status(src.orders)
        },
        overview: {
            downloads: metricNumber(o.downloads), firstTimeDownloads: metricNumber(o.firstTimeDownloads),
            firstOpens: metricNumber(o.firstOpens), registrations: metricNumber(o.registrations),
            purchases: metricNumber(o.purchases), purchaseRevenue: metricNumber(o.purchaseRevenue),
            registeredUsers: metricNumber(o.registeredUsers), registeredNoOrder: metricNumber(o.registeredNoOrder),
            buyers: metricNumber(o.buyers), orders: metricNumber(o.orders),
            orderRevenue: metricNumber(o.orderRevenue), repeatBuyers: metricNumber(o.repeatBuyers)
        },
        economics: {
            spend: metricNumber(e.spend), installs: metricNumber(e.installs),
            registrations: metricNumber(e.registrations), firstBuyers: metricNumber(e.firstBuyers),
            revenue: metricNumber(e.revenue)
        },
        googleAdsApp: (raw?.googleAdsApp ?? []).map((x: Raw) => ({
            ...currencyEvidence(x), accountId: x.account_id == null ? null : String(x.account_id),
            platform: String(x.platform ?? "unknown"), campaignName: String(x.campaign_name ?? "—"),
            spend: metricNumber(x.spend), impressions: metricNumber(x.impressions), clicks: metricNumber(x.clicks),
            conversions: metricNumber(x.conversions), conversionValue: metricNumber(x.conversion_value),
            costPerConversion: metricRatio(x.spend, x.conversions),
            fromDate: String(x.from_date ?? ""), toDate: String(x.to_date ?? "")
        }))
    };
}
