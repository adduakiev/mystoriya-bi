# App acquisition contract proposal — NOT APPLIED, 2026-10-24

This is a review design outside migrations. No schema, RPC, ingestion, credential,
provider, source destination or scheduler is changed. D04 and D06 remain OPEN.

The repository Google Ads staging key is `(date, account_id, campaign_id)` after
the date rename in `20261015_windsor_google_alignment.sql`. Its DDL has no currency
or conversion-action field. `20261019_app_analytics_contract.sql` groups all history
by inferred platform and campaign **name**, discards account/campaign IDs, sums
conversion actions together and omits currency. Same-name campaigns can collide;
renames can split history. `LIKE 'app_%'` is a name heuristic (underscore is a SQL
wildcard), not authoritative App eligibility. Android/iOS inferred from names is
also unverified. Actual account IDs, currency, property mapping, action semantics,
timezone and source completeness are UNKNOWN here.

Current preview adapter preserves returned rows, nullable fields, source currency
evidence and account ID when provided. Money without one verified currency is
withheld, including numeric zero. This cannot undo the legacy SQL aggregation.
Google Ads conversions/value are platform-attributed actions/value, not proven
installs, first buyers, backend orders or revenue. Do not compute CAC, App revenue,
LTV or budget recommendations from them. A displayed CPA describes reported
conversion actions only; no currency or financial meaning is inferred.

Proposed future source/RPC contract:

| Layer | Required grain / behavior |
|---|---|
| Delivery/cost fact | date × source × account_id × campaign_id × currency; confirmed account timezone and explicit completed from/to; names are attributes |
| Conversion fact | date × source × account_id × campaign_id × currency × conversion_action_id × attribution model/window; action category, primary/secondary, value definition and source event timestamp |
| Currency | Explicit source field or versioned account metadata valid for date; conflicting/missing/invalid currency UNKNOWN; no locale or other-platform fallback |
| App mapping | Reviewed account/campaign ID → platform/app property mapping with effective dates; unknown platform remains unknown |
| RPC `googleAdsApp[]` v2 | account_id, campaign_id, campaign_name, platform, currency, currency_status, from_date, to_date, rows, per-field known/unknown counts, nullable spend/impressions/clicks; conversion totals labeled AMBIGUOUS until action scope confirmed |
| Adapter/UI v2 | Preserve stable identity and every returned row; validate currency and completeness per field; key by account/campaign/currency/period; ratios require complete operands and positive denominator |

Never join delivery spend directly to action-grain rows and then sum spend. First
aggregate each fact to its own grain; show actions separately or join one
preaggregated result per delivery key. Do not add different currencies or reuse
the same action under multiple install/buyer labels. Source default-zero values
cannot prove missingness; obtain provider field-presence receipts before backfill.

Illustrative bounded SQL for a future versioned payload review follows. It does
not install a function or table and was **NOT EXECUTED**. It retains available
identity and makes currency/platform/action ambiguity explicit against the
repository staging contract. It is not the approved replacement RPC: App campaign
eligibility, currency metadata, complete-source markers and action facts are still
required. Existing password/RLS/server-only boundaries must be retained in a future
implementation; no new grants or execution path are proposed here.

```sql
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH scoped AS (
  SELECT date, account_id, campaign_id, campaign_name,
         NULL::text AS currency, -- absent in repository Google staging DDL
         cost, impressions, clicks, conversions, conversions_value
  FROM public.staging_google_ads_windsor
  WHERE date BETWEEN DATE '2026-09-24' AND DATE '2026-10-23'
), campaigns AS (
  SELECT account_id, campaign_id, currency,
         max(campaign_name) AS campaign_name,
         min(date) AS from_date, max(date) AS to_date, count(*) AS rows,
         count(*) - count(cost) AS unknown_spend_rows,
         CASE WHEN count(cost) = count(*) THEN sum(cost) END AS spend,
         CASE WHEN count(impressions) = count(*) THEN sum(impressions) END AS impressions,
         CASE WHEN count(clicks) = count(*) THEN sum(clicks) END AS clicks,
         CASE WHEN count(conversions) = count(*) THEN sum(conversions) END AS reported_actions,
         CASE WHEN count(conversions_value) = count(*) THEN sum(conversions_value) END AS reported_action_value
  FROM scoped
  GROUP BY account_id, campaign_id, currency
)
SELECT *, 'UNKNOWN'::text AS currency_status,
          'unknown'::text AS platform,
          'UNVERIFIED_APP_ELIGIBILITY'::text AS app_scope,
          'AMBIGUOUS'::text AS conversion_action_status,
          NULL::numeric AS verified_install_count,
          NULL::numeric AS verified_first_buyers,
          NULL::numeric AS verified_backend_revenue
FROM campaigns
ORDER BY account_id, campaign_id;
ROLLBACK;
```

The SQL deliberately does not guess currency or select App rows by name. Its sums
only diagnose stored values and must stay withheld as money in the UI. A future
review should compare same-name campaigns from different accounts, renamed
campaigns, mixed currencies, unknown fields versus measured zero, duplicate raw
keys, out-of-window dates and multiple action rows without multiplying spend.
Apply nothing until separately reviewed SQL and exact owner application approval.
