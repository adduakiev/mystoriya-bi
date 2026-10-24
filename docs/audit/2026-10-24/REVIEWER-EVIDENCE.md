# Read-only reviewer evidence — verified 2026-10-25

Observer: **Barbara**, independent SELECT-only production aggregates, relayed in
the trusted issue #43 trigger following [CHANGES REQUESTED](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6389882016). This process
did not execute production SQL. Full SQL text, exact execution timestamp and
business/account timezone were not supplied. Results below are redacted aggregate
evidence, not newly executed runner queries. No account/campaign IDs or raw rows
are retained. The fixed windows use UTC calendar dates; no timezone inference.

The verification date is **2026-10-25**; all measurements retain the fixed audit
windows ending 2026-10-23. No rolling-window shift is inferred.

| Source | current30 rows / dates | prior30 rows / dates | trailing365 rows / dates |
|---|---:|---:|---:|
| GA4 `digital_ga4_daily`, `date_id` | 30 / 30 | 30 / 30 | 365 / 365 |
| GSC `digital_search_daily`, `date_id` | 28 / 28 | 30 / 30 | 363 / 363 |

Expected dates: 30 / 30 / 365. Current30 core metric null rows **0**, newly
verified for GA4 and GSC. Prior30/365 null checks are from the earlier 2026-10-24
receipt, not a newly reported null scan. Duplicate keys, individual field-null
counts and full field completeness remain UNKNOWN. The earlier receipt places the GSC gap at October 22–23; new counts do not separately attest latest date.

The new Meta verification confirms **138 raw rows / 138 curated rows**, **25 dates**
and **1311.75 USD spend per side**. The following key join is **earlier evidence**
([2026-10-24 review](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6389387455)),
not a new join execution or all-field attestation.

Earlier independent receipt recorded 2026-10-24 ([review](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6388338141)):
Sales **966 rows / 29 dates**, Google Ads daily **12 / 12**, GBP **48 / 12**,
all bounded current30. These are restored **earlier receipt** results, **not newly
queried**. Exact query execution timestamp is not supplied; no timestamp invented.

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

**Confirmed post-handoff provenance, recorded 2026-10-25:** trusted Actions
run [40131698750](https://github.com/adduakiev/mystoriya-bi/actions/runs/40131698750)
WORKING/Codex/checks/commit/push **PASS**; trusted workflow pushed temporary SHA
`485c5a5d16c18a56b286e167f05749b51db0c365`, existing PR #44 was recovered to that HEAD,
and exact-SHA Vercel is **READY**. See [dated post-handoff receipt](POST-HANDOFF-2026-10-25.json).
These are trusted-trigger confirmations, not a fresh Codex API query. Push belongs
to **GitHub Actions**, not Codex. Earlier Codex-local PENDING remains historical.

Protected preview HTTP **403** leaves desktop/mobile/runtime/filter/role/browser
QA **NOT VERIFIED**. No screenshots or navigation PASS, and no protection bypass.
Exact preview hostname remains unavailable. The current revision's future
SHA/CI/deployment must have its own receipt.

Current Actions run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40140314226.
WORKING and final GitHub posts belong to the trusted workflow; no Codex remote
post claimed. No GitHub connector or authorized warehouse session is exposed in
this sandbox. Existing SELECT-only table diagnostics and catalog metadata checks remain prepared in the
linked SQL files; payload-invocation design WITHDRAWN after current review; no execution or source→warehouse→RPC→UI parity is claimed.
Owner action now **NONE** for the preview/code/docs loop.

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
