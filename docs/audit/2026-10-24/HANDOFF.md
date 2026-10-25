# Issue #43 / existing PR #44 — ROAS revision handoff

Local status: **READY FOR REVIEW — code and checks only**.
Remote publication pending trusted runner; broader production audit INCOMPLETE.

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40193841845
Review: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6397712491
Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Intended branch: `astra/issue-43-40107435112`.
Runner branch: `astra/issue-43-40193841845`.
Recovered source HEAD: `ac64aad96628da197a3e02fd0d12e33cb324e3b1`.
Checkout HEAD: `4f0cfcec48408428d51ee916cb87a97a256e4807`.
Neither is this future revision SHA. No Codex commit/push/PR creation.

Read-only git metadata prevented fast-forward. Recovered source was restored via
git archive, byte-verified against every tracked file in ac64aad before edits.
The worktree includes the prior PR changes plus this revision; no ref/index change.

WORKING with trusted run URL attempted via gh POST, exit 4: no GH_TOKEN.
No remote WORKING or READY claimed. Trusted runner must publish WORKING,
check/commit/push and post READY FOR REVIEW with actual full pushed SHA.
Update existing PR #44 only. If bot PR creation is denied after pushing the
`astra/issue-43-*` temporary branch, report its full SHA for Barbara's recovery
into the same PR using force-with-lease. No duplicate PR. This publication
limitation does not require owner action for the code-only revision.

D22 suppresses Google Ads aggregate/campaign/overview ROAS and value/spend
comparisons until explicit same-account/same-currency evidence exists.
The current RPC has no such contract; it remains fail-closed. Known counts/CTR,
null versus measured zero, existing UNKNOWN-money/trend guard, Meta USD/null
attribution/fail-soft, App/Merchant and sidebar/prefetch fixes preserved.
No production fields invented, currency conversion, or SQL/migration changes.

Latest independent read-only reviewer receipt 2026-10-25: fixed completed UTC
2026-09-24..2026-10-23 GA4 30/30, GSC 29/29, Google Ads staging zero currency
columns. Prior GSC 28/28 remains dated historical evidence. No fresh runner SQL
or upstream parity, no updated prior30/12-month/null checks inferred.
See [revision and receipt](GOOGLE-ADS-ROAS-REVISION-40193841845.md).

Checks: npm ci PASS; focused seven files PASS; nine currency/ROAS subtests PASS;
full npm run check in writable same-source copy PASS (18 files, TypeScript,
optimized Next production build). Workspace full check: 15 pass / three existing
runtime-write sandbox failures; no gate weakened. Static inventory/lineage/query
checks and git diff --check PASS. See [verification.json](verification.json).
Prior check receipt retained as verification-history-40186524170.json.

D06 source grain remains OPEN. Broader audit INCOMPLETE: all-field/upstream/RPC/UI
parity, account timezone and protected-preview browser QA not established.
All 66 browser cases NOT_EXECUTED; no authorized preview session, credential
re-enable, protection bypass or screenshots. Owner action NONE for code-only.
No merge/deploy/migration/provider/scheduler/external/SYRVE/ad/business writes.
