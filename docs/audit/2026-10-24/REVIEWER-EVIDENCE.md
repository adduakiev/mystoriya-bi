# Read-only reviewer evidence — reported 2026-10-24

Observer: **Barbara**, independent SELECT-only production aggregates, relayed in
the trusted issue #43 trigger following [CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6389387455). This process
did not execute production SQL. Full SQL text, exact execution timestamp and
business/account timezone were not supplied. Results below are redacted aggregate
evidence, not newly executed runner queries. No account/campaign IDs or raw rows
are retained. The fixed windows use UTC calendar dates; no timezone inference.

| Source | current30 2026-09-24…2026-10-23 | prior30 2026-08-25…2026-09-23 | 365 dates 2025-10-24…2026-10-23 | Null core metric rows |
|---|---|---|---|---|
| GA4 `digital_ga4_daily`, `date_id` | 30/30 dates | 30/30 dates | 365/365 dates | 0 in reported windows |
| GSC `digital_search_daily`, `date_id` | 28/30 dates, through 2026-10-21 | 30/30 dates | 363/365 dates | 0 in reported windows |

The current30 row counts previously supplied remain 30 GA4 / 28 GSC. Prior30 and
365-day **row counts** are UNKNOWN: date coverage does not establish row counts,
duplicate-key absence or full field completeness. GSC has two missing calendar
dates in current30 and in the 365-date window; no gaps were filled with zeros.
Core metric names/individual field-null counts remain unavailable in the trigger.

**Meta bounded stored-key reconciliation:** 2026-09-24…2026-10-23 inclusive,
138 raw groups and 138 curated groups in **USD**, on 25 observed dates. Barbara
reports a **FULL OUTER JOIN** on `account_id`, `campaign_id`, `date`,
`account_currency`: **0 missing raw groups, 0 missing curated groups**, and **0
mismatch groups** for multiplicity, spend, clicks and impressions. Previously
reported stored spend remains 1311.75 USD per side. Absolute clicks/impressions
totals were not supplied. Matching multiplicity does not prove key uniqueness.
**All-field, upstream, warehouse→RPC and rendered UI parity remain UNKNOWN**;
the bounded key/metric result must not be described as full reconciliation.

The **separate Gate D rolling baseline** is raw/curated 145 rows each / 26 dates,
2026-09-25…2026-10-24, including the unfinished audit day. It is a different scope,
not a replacement for the completed current30 window. Existing Gate D ChatGPT
recurrence is reported ACTIVE; do not duplicate it or create a Windsor Meta task.

The earlier Barbara schema observation is preserved: Google Ads staging has
account_id/campaign_id/date but lacks currency/account_currency/currency_code;
App money remains UNKNOWN, with no exchange conversion. Meta USD evidence cannot
supply App currency. The App source-contract proposal stays **NOT APPLIED**.
Merchant nullable adapters/tests are preserved; D04–D11 remain OPEN.

**Preview provenance:** exact existing PR #44 source SHA `fc05b4843dd85d958633df72515e4b527c6fc4d8` is Vercel
**READY**, per the latest trusted trigger. This is reported evidence, not a fresh
Vercel API check. Protected preview HTTP **403** means desktop/mobile/runtime
browser QA remains **NOT VERIFIED**, no screenshots or successful navigation.
The exact preview hostname is UNKNOWN. Remote GitHub CI could not be fetched
(`gh` exit 4, no GH_TOKEN); READY deployment is not a CI or browser PASS.
The new revision SHA and its CI/deployment evidence belong to the runner after
commit/push; the existing source SHA is not this run's new revision.

Current Actions run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40131698750. WORKING issue-post attempted with this URL;
CLI authentication unavailable. This sandbox limitation does not negate trusted
workflow posts/pushes or create an owner blocker. Owner action now **NONE**.

[Machine receipt](barbara-production-evidence.json), [summary](reviewer-evidence.json),
[coverage.csv](coverage.csv) and [source-register.json](source-register.json) keep
bounded observations separate from unmeasured totals, all-history row counts
and actual source-event timestamps. [sql-validation.json](sql-validation.json)
is historical disposable-fixture evidence, not a production execution receipt.
Prepared SELECT diagnostics are [read-only-qa.sql](read-only-qa.sql) and
[rpc-read-only-qa.sql](rpc-read-only-qa.sql).

Browser continuation (matrix generation only; no browser automation claimed):

```bash
node scripts/bi-audit-browser-qa.mjs --matrix
BI_AUDIT_BASE_URL=https://exact-authorized-preview.example node scripts/bi-audit-browser-qa.mjs --matrix
```

The second origin is a placeholder. Use an existing authorized preview session;
record exact SHA, URLs and redacted outcomes per route/viewport. A 403 leaves that
browser check blocked. Do not alter protection, credentials, roles or submit
mutation controls. No runtime 404/500, performance, filter or role-isolation proof
follows from matrix generation.
