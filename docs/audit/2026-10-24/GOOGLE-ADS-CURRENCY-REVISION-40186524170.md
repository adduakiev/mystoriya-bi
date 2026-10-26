# PR #44 — P1 Google Ads UNKNOWN currency

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40186524170
Review: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6396721960
Preserved existing PR HEAD: `7cbe56147f5a65eeeda1136b0f63627e64bd3542`.

The repository bi_digital_ads_payload definition in
supabase/migrations/20261023133005_digital_correctness_rpc.sql returns no
account/currency evidence in summary, campaign or trend rows. The daily fact
aggregates by date and staging campaigns by name. A locale or another source's
currency cannot prove this source's unit. D06 stays OPEN; no SQL fields invented.

Before: Paid Advertising KPI/campaign values and trend axis/tooltip prepended ₴;
Google Ads cost >=500 selected zero-conversion campaigns and the overview both
summed their money and labelled it UAH. The App view already used currency guards.

After: Ads page and overview use that same sourceMoney guard. With the current
Google contract, non-null money becomes `— · currency UNKNOWN`; null remains `—`.
No conversion or mixed-currency sum is presented. Monetary trend selections show
an explicit UNKNOWN message instead of plotting potentially mixed money. Clicks
and conversions keep their numeric series and preserve null gaps. Axis/tooltip
formatting shares the currency guard. Verified currency formatting is covered
with USD and UAH fixtures through the shared helper and actual App page; these
fixtures do not claim that the Google Ads production RPC exposes those fields.
The 500-unit rule is suppressed completely. A count-only notice observes positive
spend and measured zero conversions without a minimum, amount sum or budget rank.
Thus 499 and 501 are both counted; zero spend, missing spend and unknown
conversions are excluded. No new paid/provider/source/migration changes.

Six deterministic regressions in web/tests/google-ads-currency.test.mjs cover
shared USD/UAH/UNKNOWN/MULTI formatting, null versus zero, campaign notices around
the former threshold, actual Paid Advertising rendering (all money cards/campaigns
and Meta USD/null separation), actual App rendering, actual trend switch handlers
and count axis/tooltip formatters, and overview consistency. I/O, shell and chart
renderers are stubbed; these are synthetic component tests, not browser/live data
proof. Existing Meta, sidebar and prefetch regression files also pass.

npm ci --prefix web PASS. Focused five files PASS; individual currency file six
subtests PASS. npm run check in original workspace cannot create .agents/runtime
and fails three existing test files. The full check in isolated writable copy
/tmp/issue43-40186524170-check-61fxqrbs passes all 18 files, TypeScript and optimized
Next.js production build. Same final code/tests/generators; later edits only docs
and evidence receipts. Current verification.json records hashes and limits.
Inventory/matrix and static lineage regenerated; production parity stays UNKNOWN.

Prior App/Merchant, Meta USD/null/status/fail-soft, sidebar status/Suspense and
prefetch changes are preserved. AGENTS.md, runner workflow and all SQL/migrations
are unchanged. No browser/deployment/data proof added. Historical provenance and
browser receipts remain attributed to their original runs; revision-provenance.json
is the retained older contract-review receipt, not this run's handoff. Current
run/branch/SHA publication state is in HANDOFF.md and verification.json.

Local code is READY FOR REVIEW; remote WORKING failed with gh exit 4 (no GH_TOKEN).
Trusted runner owns status publication, commit/push, actual full SHA and update of
existing PR #44; no duplicate PR. No Codex commit/push/deploy/migration/credentials/
provider/scheduler/business/advertising changes. Owner action NONE for code-only.
