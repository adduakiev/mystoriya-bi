# Issue #43 / existing PR #44 — bounded reconciliation handoff

Local code/docs/tests prepared for review. Remote status publication pending
trusted runner; broader production audit INCOMPLETE. NOT READY FOR GATE.
Owner action NONE for code/docs/tests.

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40206730240
Evidence: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6399469440
Open browser gate: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6398044302
Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Intended existing branch: `astra/issue-43-40107435112`.
Actual runner checkout branch: `astra/issue-43-40206730240`.
Checkout HEAD: `4f0cfcec48408428d51ee916cb87a97a256e4807`.
Requested/restored PR source: `922d04d2afec8181ab17e175b582e113c95c5c17`.
New revision SHA: PENDING TRUSTED RUNNER COMMIT/PUSH. Neither SHA above is this
uncommitted follow-up's SHA. No Codex commit/push/PR creation.

The clean checkout began at main. Git metadata is mounted read-only; switching
to the existing branch failed creating .git/index.lock. Source was restored from
the locally available exact requested commit using git archive. All 242 tracked
files byte-matched that commit before edits, including readonly .agents files.
Archive extraction reported readonly .agents paths; byte comparison proved they
already matched. No index/ref changes; no AGENTS.md or runner workflow change.
The worktree includes accepted PR changes plus this bounded docs/test follow-up.
Trusted runner must preserve the existing PR base and include untracked restored
files in its controlled handoff. Do not create a duplicate PR.

WORKING with trusted Actions URL was attempted first via `gh issue comment 43`:
exit 4, no GH_TOKEN. Linked comment reads failed for the same reason; only the
trusted trigger's quoted evidence is claimed. No remote WORKING/READY was posted;
acknowledgement remains pending (ASSIGNED/NOT ACKNOWLEDGED remotely). The trusted
workflow must publish WORKING before READY FOR REVIEW, with actual branch/full
new SHA and checks. If its PR-update permission fails after successful push,
report exact pushed branch/SHA for Barbara's safe existing-PR recovery.

[Report and query](GOOGLE-ADS-DAILY-RECONCILIATION-2026-10-25.md): reported UTC
2026-10-12..24 raw 157 rows/13 dates → curated 13 rows/13 dates, zero missing-date
groups, five-metric daily mismatches and duplicate raw date/account/campaign
groups. New SELECT uses aligned raw date/conversions_value and curated
date_id/conversion_value, FULL OUTER JOIN, IS DISTINCT FROM. It was tested on
synthetic disposable local PostgreSQL only; no warehouse SQL or RPC execution.
Extra query diagnostics have no invented production results.

New shifted UTC 2026-09-25..10-24: GA4 30/30 observed/expected dates, GSC 28/30
through 10-22, Ads 13/30 since 10-12 (13/13 observed onboarded dates). Earlier
09-24..10-23 GSC 29 rows / 29 dates is 29/30 calendar coverage. Historical
coverage/receipts retain provenance; shifted prior30 and 12-month counts UNKNOWN.

No application code changed relative to requested PR source: D22 fail-closed,
Meta USD/null/attribution, App/Merchant and sidebar/prefetch fixes retained.
D06 stays OPEN. Currency, account/action attribution, business timezone, source
completeness and RPC/rendered UI parity remain UNKNOWN.

See [verification.json](verification.json) for current check results; previous
receipt preserved as verification-history-40193841845.json. The workspace check's
runtime-write sandbox failures are recorded separately from the full check on
a byte-matched writable source copy; no test or safety gate was weakened.

All **66 authenticated exact-SHA desktop/mobile/browser cases NOT_EXECUTED**.
No already-authorized session available, access links, secrets/protection changes,
new browser navigations or screenshots. Prior preview/403 receipts are historical.
No production/staging SQL, volatile/security-definer RPC, migrations, new Windsor
destinations, scheduler, credentials, paid providers, durable business writes,
SYRVE, advertising changes, merge or deploy. Gate D was not duplicated or changed.
