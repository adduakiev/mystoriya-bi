# PR #44 — P1 Google Ads ROAS guard, 2026-10-25

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40193841845
Review: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6397712491
Recovered source: `ac64aad96628da197a3e02fd0d12e33cb324e3b1`.

D22: cost=50 and conversionValue=400 previously produced 8.00x in Paid Advertising
and Digital overview even though money was already withheld as currency UNKNOWN.
A campaign with cost=100 and value=50 produced 0.50x and “Value нижче spend”.
Neither ratio is justified by the current account/currency contract.

`verifiedAdsRoas` requires explicit matching nonempty account identities and valid
SINGLE currency evidence for both operands. With absent, UNKNOWN, MULTI, mixed
currency or different accounts it returns null. The current Google Ads normalizer
supplies no evidence, so summary and campaign ROAS fail closed. No production
fields or SQL contract are invented. The explicit verified same-currency fixture
is synthetic helper evidence only; it does not enable the production path.

Campaign signals independently recompute through this guard; even a precomputed
numeric ROAS cannot bypass it. Positive-spend/zero-conversion counts and measured
conversion value=0 observations remain neutral observations, with no value/spend
comparison. Null value stays unknown. Known clicks/conversions/CTR remain.
The existing money/trend guard, Meta USD/null attribution and fail-soft behavior,
App/Merchant and sidebar/prefetch fixes are preserved. D06 stays OPEN.

Focused deterministic helper, normalizer, actual server page, overview and
campaign regressions cover absent/UNKNOWN/MULTI evidence, account and currency
mismatches, null versus measured zero, and verified same-currency fixtures.
These synthetic SSR checks stub I/O and unrelated chart/shell components;
no browser, live data, upstream or deployed parity is claimed.

## Independent read-only reviewer receipt — 2026-10-25

The trusted trigger relays independent read-only results for **UTC
2026-09-24 through 2026-10-23 inclusive**, expected 30 calendar dates:

| Source | Stored rows | Observed dates |
|---|---:|---:|
| GA4 `digital_ga4_daily` | 30 | 30 |
| GSC `digital_search_daily` | 29 | 29 |

Google Ads staging has **zero currency columns** per the independent receipt.
It provides no verified same-account/same-currency value/spend contract.
No specific missing GSC date, new latest event timestamp, SQL text, exact
execution time, null scan, duplicate check, prior30/12-month recount or upstream
parity was supplied. Those facts remain UNKNOWN or earlier dated evidence.

Earlier GSC **28/28**, reported in comment 6389882016 on 2026-10-25, remains
verbatim in `barbara-production-evidence.json` and historical sections. It is
superseded only for current30 count by this later receipt. Earlier 363/365 GSC
coverage is historical; do not derive an updated 12-month count from 29/30.
Latest machine receipt: [REVIEWER-RECEIPT-2026-10-25-6397712491.json](REVIEWER-RECEIPT-2026-10-25-6397712491.json).
Coverage CSV current30 rows use the latest counts, with null checks UNKNOWN;
other periods and the older machine receipt preserve their original provenance.

All 66 browser cases remain NOT_EXECUTED. No authorized preview session is
available; prior protected-preview 403 is historical. No credentials re-enabled,
protection bypass, screenshots, runtime or role/filter/performance proof.
No new production queries, RPC invocations, migrations or external writes.

See [verification.json](verification.json) for this revision's actual check
results and [HANDOFF.md](HANDOFF.md) for runner-only publication. Git metadata is
read-only; all recovered source files were restored verbatim with git archive
and checked byte-for-byte against the recovered commit before this revision.
No Codex commit/push/PR creation. Owner action NONE for code-only.
