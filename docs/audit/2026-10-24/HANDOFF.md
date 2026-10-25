# Issue #43 / existing PR #44 — currency revision handoff

Local status: **READY FOR REVIEW — code and checks only**. Remote publication pending runner.

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40186524170
Review: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6396721960
Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Intended branch: `astra/issue-43-40107435112`.
Runner branch: `astra/issue-43-40186524170`.
Preserved PR HEAD: `7cbe56147f5a65eeeda1136b0f63627e64bd3542`.
Checkout HEAD: `4f0cfcec48408428d51ee916cb87a97a256e4807`.
Neither HEAD is the future revision SHA. No Codex commit/push/PR creation.

WORKING post with trusted run URL attempted via `gh api`: exit 4, no GH_TOKEN.
No remote WORKING/READY claimed. Trusted runner must publish WORKING, perform
checks/commit/push, and post READY FOR REVIEW with the actual full pushed SHA and
check receipt. Update existing PR #44 only. If a temporary branch is pushed,
report its full SHA for Barbara's recovery using force-with-lease. No duplicate PR.
This publication limitation is not a user/owner blocker for this code-only fix.

D21 removes Google Ads inferred UAH in summary/CPC/CPA/conversion value, campaign
rows, trend axis/tooltips and Digital overview. Reuses App sourceMoney. The current
RPC contains no verified currency, so monetary values are withheld as currency
UNKNOWN and money trends are suppressed; count trends remain available. The
unsupported 500 threshold and campaign spend sum are removed; positive-spend,
zero-conversion campaigns have a count-only notice without budget ranking.
Meta USD/nulls/status/fail-soft, App guards, sidebar fail-soft/Suspense and all
prefetch fixes are preserved. No new source currency field or conversion invented.

Checks: npm ci PASS; focused five files PASS; six new currency subtests PASS;
full npm run check in writable same-source copy PASS (18 files, TypeScript,
optimized Next build); workspace full check hits .agents/runtime sandbox write
failure in three existing files. See verification.json for exact receipts and
code hashes. Deterministic inventory/lineage refreshed; git diff --check PASS.

D06 account/currency grain remains OPEN. No source/migration fixes attempted.
Broader audit remains INCOMPLETE: upstream/all-field/RPC/UI parity, business
account timezone and protected-preview browser QA not established. Historical
receipts preserved; no fresh production SQL/browser queries or screenshots.
Owner action NONE for this code-only fix. All release/data-write gates intact.
