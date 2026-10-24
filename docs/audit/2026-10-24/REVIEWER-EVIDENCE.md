# Read-only reviewer evidence — recorded 2026-10-24

Observer: **Barbara**, independently observed SELECT-only production aggregates,
relayed in the trusted issue #43 revision trigger after
[CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6389068370).
This process did not execute production SQL. GitHub comment fetch failed with
`gh api` exit 4 (GH_TOKEN unavailable); no credentials were added or changed.
Only the explicit redacted results supplied in the trigger are transcribed.
Execution timestamp, full query and account scope/timezone remain UNKNOWN.

| Evidence | Bounded recorded result | Limit |
|---|---|---|
| current30 GA4, date_id | 30 rows / 30 dates; key metric null rows 0 | Other fields, duplicate keys and source/RPC/UI parity UNKNOWN |
| current30 GSC, date_id | 28 rows / 28 dates through 2026-10-21; key metric null rows 0 | October 22–23 absent in this scope; other fields and parity UNKNOWN |
| current30 Meta raw | 138 rows / 25 dates / stored spend 1311.75 | Currency, full fields/keys and upstream parity UNKNOWN |
| current30 Meta curated | 138 rows / 25 dates / stored spend 1311.75 | Equality of these aggregates is not full reconciliation |
| Separate Gate D rolling baseline | raw/curated 145 rows each / 26 dates, 2026-09-25…10-24 | Includes incomplete audit day; do not substitute for current30 |
| Google Ads deployed staging schema | account_id/campaign_id/date present; currency/account_currency/currency_code absent | Source-money UNKNOWN; repository App RPC also omits currency; no conversion inferred |
| prior30 / rolling12 | UNKNOWN, no bounded receipts supplied | Baseline date spans do not establish coverage |
| Protected Vercel preview | HTTP 403 reported; browser QA NOT VERIFIED | No desktop/mobile/runtime navigation or screenshot evidence |
| Trusted workflow history | a261c82 push/PR recovery reported earlier; latest intended PR head 58d9842 | Current run handoff belongs to runner; sandbox GH_TOKEN failures do not negate trusted history |

Current30 is UTC calendar 2026-09-24…2026-10-23 inclusive. Fixed prior30 is
2026-08-25…2026-09-23 and rolling12 is 2025-10-24…2026-10-23. No upstream,
RPC or rendered UI totals supplied; all parity remains UNKNOWN. Source latest
**event timestamp** is not inferred from a date or imported_at. No confidential
rows, account IDs, customer keys or secrets are retained.

[reviewer-evidence.json](reviewer-evidence.json) summarizes the receipt;
[barbara-production-evidence.json](barbara-production-evidence.json) preserves
relation-specific observations. [coverage.csv](coverage.csv) records verified
cells separately from unmeasured totals and [source-register.json](source-register.json)
keeps bounded observations separate from all-history counts/latest event time.
[sql-validation.json](sql-validation.json) covers historical disposable fixtures;
it is not production evidence. SELECT-only diagnostics are prepared in
[read-only-qa.sql](read-only-qa.sql) and [rpc-read-only-qa.sql](rpc-read-only-qa.sql).

Browser continuation (manual steps, no browser automation claimed):

```bash
node scripts/bi-audit-browser-qa.mjs --matrix
BI_AUDIT_BASE_URL=https://exact-authorized-preview.example node scripts/bi-audit-browser-qa.mjs --matrix
```

The second origin is a placeholder, not an observed deployment. Replace it with
the exact authorized preview. The command emits one JSON line per route/viewport
with desktop/mobile dimensions, period URLs where supported, selector checks,
and screenshot/result slots. Open these URLs in an already authorized browser;
record results separately. A 403 stops the exercise with BLOCKED. Do not change
protection, credentials, roles or click mutation controls. Missing/error fixtures
belong only in an isolated preview. No runtime 404/500, performance, mobile,
filter consistency or role-boundary claim follows from matrix generation.
