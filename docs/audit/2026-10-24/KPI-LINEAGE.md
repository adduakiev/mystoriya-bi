# KPI → warehouse → RPC → UI, 24.10.2026

Це перевірений **статичний шлях полів**, а не production parity. Визначення SQL
з repository може відрізнятися від deployed SQL. Matched upstream/warehouse/RPC/UI
totals, timezone і повнота залишаються UNKNOWN. Bounded stored Barbara counts/spend
окремо у REVIEWER-EVIDENCE.md; вони не доводять цей end-to-end шлях. Ширший каталог — `metric-lineage.csv`;
route candidates у inventory не замінюють ці конкретні bindings.

| UI KPI / шлях | SQL поле та RPC JSON | Adapter → конкретний UI binding | Період / суттєва межа |
|---|---|---|---|
| `/` Оборот | `fact_sales_daily.revenue` + dimension joins; `bi_overview_payload.current.revenue` | `web/lib/data/overview.ts` → `current.revenue` → `snapshot.kpis` → `KpiCard` у `web/app/page.tsx` | year/month/brand/ownership/LFL; legacy zero/fallback parity UNKNOWN |
| `/` Середній чек | sums revenue/checks; `.current.averageCheck` | той самий adapter → `current.averageCheck` → KPI «Середній чек» | receipt checks не доводять business orders; SQL zero denominator → 0 |
| `/` Націнка % | sum(markup)/sum(revenue)*100; `.current.markupRate` | `overview.ts` `toMetricSet` → chart/table metrics | не contribution margin; raw markup definition UNKNOWN |
| `/digital` Sessions, Revenue GA4 | `digital_ga4_daily.sessions/purchase_revenue`; `bi_digital_payload.current.sessions/purchaseRevenue` | `digital-contract.ts` `normalizeDigital` → `data.current` → `c.sessions/c.purchaseRevenue` у `digital/page.tsx` | selected from/to; `currentGa4Rows` guards empty period; source currency UNKNOWN |
| `/digital/funnel` conversion rate | `digital_ga4_daily.purchases/sessions`; `.current` operands | `digital-contract.ts` `metrics` → `metricRatio` → `c.conversionRate` у `digital/funnel/page.tsx` | independent event counts; not sequential cohort funnel |
| `/digital/channels` revenue | `digital_ga4_channel_daily.purchase_revenue`; `.channels[].purchase_revenue` | `normalizeDigital` → `.channels[].purchaseRevenue` → channel table | channel scope not order attribution; no period-unique users |
| `/digital/seo` CTR | `digital_search_daily.clicks/impressions`; `.seo` | `digital-contract.ts` `seo` recomputes ratio → `s.ctr` у `digital/seo/page.tsx` | query/page snapshots capped 40/30; no source total equality implied |
| `/digital/ads` Google CPA | `digital_google_ads_daily.cost/conversions`; `bi_digital_ads_payload.summary` | `digital-source-contract.ts` `normalizeAds` recomputes ratio → `s.cpa`; campaign table `r.cpa` | own recent window; summary ≠ raw campaigns; legacy money currency defect D06 remains outside App fix |
| `/digital/ads` Meta spend | `staging_meta_ads_windsor` → `staging_meta_ads_daily` → `meta_windsor_campaign_metrics`; `bi_digital_meta_ads_payload.summary.spend` | `meta-social-contract.ts` `normalizeMetaAds` → `meta.summary.spend`, `meta.meta.currency` | strict source evidence/current period; Meta Gate D retained, not recreated |
| `/digital/local` calls | `digital_gbp_daily.call_clicks`; `bi_digital_local_payload.summary.calls` | `digital-source-contract.ts` `normalizeLocal` → `s.calls` у `digital/local/page.tsx` | call-button actions, not answered calls/orders; source-specific window |
| PageSpeed | `digital_pagespeed_snapshot.mobile_score`; `bi_digital_local_payload.pageSpeed.mobile_score` | `normalizeLocal` → `.pageSpeed.mobileScore` → `digital/tracking/page.tsx` | `captured_on` processing date; actual measurement UNKNOWN |
| `/digital/social` followers | `staging_facebook_organic_daily.followers`; `bi_digital_social_payload.facebook.followers` | `meta-social-contract.ts` `normalizeSocial` → `f.followers` у `digital/social/page.tsx` | endpoint stock, not sum; Facebook/Instagram windows distinct |
| `/digital/app` campaign spend/CPA/value | `staging_google_ads_windsor.cost/conversions/conversions_value`; `bi_digital_app_payload.googleAdsApp[]` | `app-contract.ts` `normalizeApp` → `row.spend/costPerConversion/conversionValue` → `sourceMoney(row.*,row)` у `digital/app/page.tsx` | legacy RPC omits currency/account and sums all history; money withheld without single source currency; every campaign row displayed |
| `/digital/app` downloads | `staging_app_store_daily.downloads`; `.overview.downloads`, `.sources.store.rows` | `normalizeApp` preserves null → `storeReady ? n(o.downloads) : "—"` | source presence ≠ field completeness; SQL-erased null cannot be recovered |
| `/digital/commerce` impressions | `staging_google_merchant_performance.impressions`; `bi_digital_merchant_payload.performance.impressions` | `merchant-contract.ts` `normalizeMerchant` → `performanceReady ? n(p.impressions) : "—"` | latest performance window; catalog/health rows do not enable performance cards |
| `/pnl` profit | `web/lib/data/pnl-source.ts` workbook → `web/lib/data/pnl.ts` calculations | `web/app/pnl/page.tsx` → KPI/trend/tables | no warehouse RPC; Jan–Aug; 70/30 payroll allocation not order margin |
| `/operating` KPI/decisions | allowlisted Google RPC aggregate packet → `qualityGate` | `operating-data.ts`/current validated bus → `operating/page.tsx` | domain/evidence/current-run isolation retained; durable writes disabled |

Для live звірки використати однакові windows з `COVERAGE.md`, warehouse diagnostics
`read-only-qa.sql` і date-filtered `rpc-read-only-qa.sql`. Останній перевіряє три
GA4 additive fields і metadata dates; він не покриває весь каталог KPI. Ads/App/GBP
без from/to не підміняти запитом «latest». Browser outcomes — у `browser-qa.json`;
жодного rendered value чи screenshot у цьому runner не отримано.

Merchant revision D18: all numeric JSON fields in performance, topProducts,
catalog and health map through metricNumber to nullable fields; meta source counts
map through nonnegative integer validation. commerce/page.tsx uses formatMetric
and null-safe percent formatting. Positive counts establish presence only;
field nulls stay —. Missing count ≠ confirmed zero. SQL-coalesced nulls and incomplete
sums remain D04 OPEN. App grain proposal: [APP-CONTRACT-PROPOSAL.md](APP-CONTRACT-PROPOSAL.md).
