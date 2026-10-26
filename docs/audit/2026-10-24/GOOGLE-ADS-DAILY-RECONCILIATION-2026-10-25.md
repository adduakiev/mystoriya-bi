# Google Ads bounded daily reconciliation — 2026-10-25

Existing PR [#44](https://github.com/adduakiev/mystoriya-bi/pull/44), issue #43.
[Trusted Actions run](https://github.com/adduakiev/mystoriya-bi/actions/runs/40206730240).
Source base: `922d04d2afec8181ab17e175b582e113c95c5c17`.

The [independent SELECT-only evidence](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6399469440)
was relayed in the trusted trigger. GitHub CLI lacked GH_TOKEN, so the comment
was not independently fetched. No warehouse query or RPC was executed by this
runner. Exact reviewer execution time and original SQL text were not supplied.
The [machine receipt](REVIEWER-RECEIPT-2026-10-25-6399469440.json) records only
supplied observations and explicitly marks unverified fields UNKNOWN.

## Stored raw → curated comparison

Fixed inclusive **UTC calendar 2026-10-12..2026-10-24**, 13 expected dates.
The calendar convention does not establish account/business timezone.

| Check | Independent reported result |
|---|---:|
| Raw `public.staging_google_ads_windsor` rows / distinct dates | 157 / 13 |
| Curated `public.digital_google_ads_daily` rows / distinct dates | 13 / 13 |
| FULL OUTER JOIN by date: missing-date groups | 0 |
| Daily aggregate mismatch groups across the five metrics | 0 |
| Cost / clicks / impressions / conversions / conversion value mismatch groups | 0 / 0 / 0 / 0 / 0 |
| Duplicate raw `(date, account_id, campaign_id)` groups | 0 |

The [new reproduction query](google-ads-daily-reconciliation.sql) is one SELECT
with fixed bounds. It aggregates each side by date, FULL OUTER JOINs those dates,
and compares each metric with **IS DISTINCT FROM**. It uses the aligned raw
`staging_google_ads_windsor.date`, curated `digital_google_ads_daily.date_id`,
and maps raw **`conversions_value`** to curated **`conversion_value`**.
The repository rename is in `20261015_windsor_google_alignment.sql`; the raw
create-table migration alone still shows the older name. The query never calls
a payload/refresh function and makes no schema or session changes.

Reproduction is prepared for an existing authorized SELECT-only session; it has
been executed only against disposable synthetic local PostgreSQL tables:

```bash
psql -X --set=ON_ERROR_STOP=1 --file=docs/audit/2026-10-24/google-ads-daily-reconciliation.sql
```

No connection string, new access, privilege change or production execution is
part of this handoff. A future run must retain its own dated receipt; mutable
source tables can change. The new query includes extra unknown-metric, identity,
curated-duplicate and excess-row diagnostics. Their production values remain
UNKNOWN because the trigger did not supply them. These diagnostics distinguish
SUM ignoring nulls from complete fields; both-null totals compare equal but do
not become zero or a completeness proof. Missing-date groups compare the two
stored sides; dates missing from both sides require separate calendar coverage.

## Separate coverage windows

| Window (UTC, inclusive) | Source | Observed / expected dates | Scope |
|---|---|---:|---|
| 2026-09-25..2026-10-24 | GA4 | 30 / 30 | New shifted current30 receipt |
| 2026-09-25..2026-10-24 | GSC | 28 / 30 | Through 2026-10-22; 23–24 absent |
| 2026-09-25..2026-10-24 | Google Ads curated | 13 / 30 | First observed/onboarded 2026-10-12; 17 earlier calendar dates outside observed onboarding interval |
| 2026-10-12..2026-10-24 | Google Ads raw and curated | 13 / 13 each | Observed onboarding interval only |
| 2026-09-24..2026-10-23 | GSC | 29 / 30 | Earlier receipt: **29 rows / 29 observed dates**, sometimes written 29/29; denominator for calendar coverage is 30 |

The old 29 observed dates and new 28 observed dates describe different windows
and receipts. Subtraction does not identify a deleted date or a regression.
Historical `coverage.csv` and earlier receipts retain their bounds and provenance.
The separate [shifted CSV](coverage-shifted-2026-10-25.csv) records the three new
observed-date counts. GA4/GSC new row counts were not separately supplied.

No new shifted prior30 (2026-08-26..2026-09-24) or trailing12months
(2025-10-25..2026-10-24, 365 dates) recount is available. Both remain UNKNOWN.
Historical prior30 and 12-month counts in [COVERAGE.md](COVERAGE.md) apply only to
the original windows ending 2026-10-23. No updated 12-month completeness is inferred.

## Lineage, open risks and priority

Raw campaign/account/day fields → daily SUM → `digital_google_ads_daily` →
`bi_digital_ads_payload` → `normalizeAds` → `/digital/ads` and `/digital`.
The SQL comparison ends at the curated daily table. Existing
[rpc-contract-lineage.json](rpc-contract-lineage.json) and
[KPI-LINEAGE.md](KPI-LINEAGE.md) describe subsequent code paths; no runtime parity
is added. Source Google Ads still lacks currency. Numerical parity cannot prove
correct account scope, conversion action/window/model, refunds, upstream export
completeness or business timezone. Both layers could omit the same records.

**P1 D06 remains OPEN; D22 remains fail-closed.** Google Ads money/ROAS and
comparative value/spend signals stay withheld without the existing verified
account/currency contract. Meta USD/null and attribution handling, App/Merchant,
sidebar and prefetch code are preserved byte-for-byte from the requested base.

Next priorities and decision gates:

1. Retain the [66-case exact-SHA authenticated desktop/mobile browser gate](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6398044302).
   **NOT EXECUTED**: no already-authorized session is available here. No new links,
   protection changes, secrets, screenshots or invented runtime evidence.
2. Obtain existing-access SELECT/export evidence for account, currency, timezone,
   conversion actions, field completeness and upstream scope; reconcile stored
   daily facts before proposing any source/RPC design. No mutation is authorized.
3. Prepare any resulting source-contract/SQL changes for separate review.
   Migrations remain NOT APPLIED until exact owner approval. Merge/deploy and
   each source/scheduler/business-write action retain distinct owner gates.

Focused tests exercise schema alignment and the real SELECT on local synthetic
fixtures: decimal values, measured zero/null, both missing join sides, each
metric's offsetting daily errors, raw duplicate groups versus excess rows,
curated duplicates, unknown identities, partial-null SUM and empty input.
The synthetic 157-row fixture reproduces the query shape and cardinality only;
it is not the production dataset. See [verification.json](verification.json)
for checks actually run in this revision.

This is bounded code/docs/test review evidence. **NOT READY FOR GATE** and no
claim of full audit completion. Owner action **NONE** for code/docs/tests.
No production/staging SQL, volatile/security-definer RPCs, migrations, connector,
credential, provider, scheduler, SYRVE, advertising or durable business writes.
