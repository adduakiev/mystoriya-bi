// Explicit UI expectations; warehouse candidates are joined from the audit inventory.
// These are contracts to execute, never claims of upstream or authenticated parity.
export const routeAssertions = {
  '/': ['Огляд', ['bi_overview_payload'], 'current.revenue/current.checks → snapshot.kpis → KpiCard; cutoffDate and selected dimensions must match SQL'],
  '/aggregators': ['Aggregator Control Center', ['bi_aggregators_payload_v2'], 'current.revenue/checks → snapshot.kpis; aggregators[].revenue/share by aggregator; commission/net margin remain unverified D08'],
  '/delivery': ['Доставка', ['bi_delivery_payload'], 'deliveryMetrics.revenue vs aggregatorMetrics.revenue; locationRows[].deliveryShare; same eligible store/period without channel double counting'],
  '/locations': ['Заклади', ['bi_locations_payload'], 'locationRows[].revenue/checks/revenueGrowth and lfl.currentRevenue/previousRevenue; reconcile lifecycle cohort D07'],
  '/dynamics': ['Динаміка', ['bi_dynamics_payload'], 'series[year/label] and summary.latestYearTotal; metric and grain patch RPC args, no fabricated focus-year filter'],
  '/explorer': ['Data Explorer', ['bi_explorer_payload'], 'rows[].current/previous/share vs totals.current/previous; dimension/metric/sort and segment RPC args; check top-N separately'],
  '/insights': ['Insights', ['bi_insights_payload'], 'current/previous and generated result items must use identical period/cohort; causes require evidence, not correlation'],
  '/pnl': ['P&amp;L · План / Факт', [], 'bundled PNL_SOURCE → loadPnlData(startMonth,endMonth) → fact/plan/LY; eight imported months, allocations/refunds/net margin D08 remain unverified'],
  '/digital': ['Digital-аналітика', ['bi_digital_history_payload','bi_digital_payload','bi_digital_local_payload','bi_digital_ads_payload'], 'current.sessions/purchases/revenue and seo.clicks/impressions → KPI; GA4/GSC current/prior request windows; Ads/GBP remain independent D05'],
  '/digital/ads': ['Paid Advertising · Google Ads / Meta Ads', ['bi_digital_ads_payload','bi_digital_meta_ads_payload'], 'Google summary.cost/clicks/conversions and campaigns; Google currency UNKNOWN; Meta summary.spend USD, purchases/value null; both unverified ROAS suppressed'],
  '/digital/app': ['App Analytics', ['bi_digital_app_payload'], 'sources.store.rows + overview.downloads → Downloads; googleAdsApp[].spend/currency → campaign rows; missing ≠ zero; Ads conversions ≠ installs/buyers'],
  '/digital/commerce': ['Google Merchant', ['bi_digital_merchant_payload'], 'meta.performanceRows + performance.impressions/clicks/conversions → cards; catalog/health rows cannot unlock performance; null counts UNKNOWN, confirmed empty WAITING'],
  '/digital/funnel': ['Діагностика воронки', ['bi_digital_payload'], 'current.sessions/addToCarts/checkouts/purchases → event counts; undefined ratios —; aggregate events are not sequential users'],
  '/digital/audience': ['Аудиторія сайту', ['bi_digital_payload','bi_digital_history_payload'], 'current.sessions/newUsers and devices[].sessions → audience cards; period-unique active users unavailable, no daily summation'],
  '/digital/channels': ['Канали залучення', ['bi_digital_payload','bi_digital_history_payload'], 'channels[].sessions/purchases/revenue → channel rows; ratio operands share scope; no channel/user deduplication inferred'],
  '/digital/seo': ['Органічний пошук', ['bi_digital_payload','bi_digital_history_payload'], 'seo.clicks/impressions/ctr/position plus seoQueries/seoPages → rows; snapshot exact 30-day window and top-N caps distinct from daily history'],
  '/digital/site': ['Сайт та поведінка', ['bi_digital_payload','bi_digital_local_payload','bi_digital_history_payload'], 'landingPages[].sessions and pageSpeed.mobileLcp/mobileInp/mobileCls → tables/CWV; processed/captured date does not establish measurement freshness D10'],
  '/digital/local': ['Google / Maps', ['bi_digital_local_payload'], 'summary.calls/directions/websiteClicks/menuClicks and locations[] → local actions; sum propagates missingness, actions ≠ orders'],
  '/digital/social': ['Facebook / Instagram Organic', ['bi_digital_social_payload'], 'facebook/instagram rows and period → source status; followers null ≠ zero, empty IG WAITING; posts capped and stale retained visibly'],
  '/digital/tracking': ['Якість аналітики', ['bi_digital_history_payload','bi_digital_ads_payload','bi_digital_local_payload'], 'quality.ga4/searchConsole date coverage → evidence; App counts and connector schedule UNKNOWN without proof; no duplicated Gate D scheduler'],
  '/operating': ['Оперативне керування', [], 'aggregate packet.evidence → qualityGate → Council → Astra; only verified current LIVE business evidence enables task creation; collector time ≠ source freshness; SSR uses disabled mock packet'],
  '/login': ['Control Center', [], 'no source/RPC; password form only; no warehouse/account/PII before authorization; GET must not establish a session']
};

export const routeControls = {
  '/': 'GET year/month/channel/orderType/brand/ownership/location/compare; links period/metric/grain/lfl; month forces period=month and grain=month',
  '/aggregators': 'Links period=ytd|month|week, compare=ly|previous, lfl; no arbitrary date/account/currency selector',
  '/delivery': 'GET year/month/orderType/metric/grain/brand/ownership/location/lfl; selected month overrides grain; no channel selector',
  '/locations': 'GET year/month/brand/ownership/lfl; no arbitrary channel/period selector',
  '/dynamics': 'GET grain/metric/channel/orderType/brand/ownership/location/lfl; no focus year/month selector',
  '/explorer': 'GET dimension/metric/year/month/channel/orderType/brand/ownership/location/sort/lfl',
  '/insights': 'GET year/month/channel/orderType/brand/ownership/location/lfl',
  '/pnl': 'GET from/to are inclusive imported month numbers 1..8; reversed bounds normalized; no arbitrary daily date selector',
  '/digital': 'GET from/to/compare/year/month; period links; current/prior GA4/GSC windows only, Ads/GBP independent',
  '/login': 'No read-only data filters; hidden next is a redirect target; do not submit password in automated QA',
  '/operating': 'No period selector; anchors/details only; run/task/manual-analysis mutations excluded from live read-only QA'
};
