# PR #44 — fail-soft sidebar/status revision

Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Review reference supplied in the trusted trigger:
https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6396441073

## Scope and reproduced defect

The intended PR head `3ed26b23a799df7c490fc9fc2651e95a45648075` was restored
as working-tree files over runner HEAD `4f0cfcec48408428d51ee916cb87a97a256e4807`.
Git metadata is read-only in this sandbox; no refs, index or commits were changed.
All restored files are byte-identical to the intended head except the files listed
below. The accepted sidebar/Digital `prefetch={false}` components and their tests
are unchanged.

Source and executable mocked-transport tests confirm the old status loader could
call `bi_sync_status`, then `bi_sales_snapshot`, then Google Sheets after a status
failure. A failed CSV response could reject the sidebar render. The old brand
component also awaited status before returning logo/logout markup. These are code
and harness findings; no production timing or data reconciliation is claimed.

The new loader requests only `bi_sync_status`, with a two-second abort budget.
Missing credentials, HTTP/network/JSON/payload failures, non-success payloads and
cache failures return `source: unknown`, `status: unavailable`, with null dates and
counts. It never requests a dataset as a status fallback. Its cache key is versioned
to avoid reusing an old cached fallback result; the 60-second revalidation interval
and `sales-data-status` invalidation tag are preserved. Failed status may remain
cached for that interval. The explicit report dataset fallback is preserved.

The brand/logo/logout markup is synchronous. Only the asynchronous status widget
is inside Suspense, with a neutral pending placeholder. An unavailable status does
not claim Google Sheets fallback or Sync OK. A successful warehouse response shows
the returned cutoff and says only that status was obtained; it does not assert
freshness/completeness. Missing, malformed and impossible cutoff dates cannot crash
the widget or receive green status, and do not reach the sync control date formatter.
Existing manual sync behavior is unchanged and was not invoked.

## Changed files relative to the intended head

- `web/lib/data/source.ts`: lightweight, bounded, fail-soft status only.
- `web/components/SidebarBrand.tsx`: isolated asynchronous status, neutral states,
  safe date formatting and narrower success wording.
- `web/tests/sidebar-status.test.mjs`: 14 regression tests.
- `web/tests/supabase-boundary.test.mjs`: successful fixture matches SQL's explicit
  success field; failure test checks status isolation and preserved explicit report
  fallback without exposing transport errors.
- `docs/audit/2026-10-24/inventory.json` and `tab-block-matrix.csv`: regenerated for
  the changed component tree (22 pages, 7 API routes, 745 static visual/control
  templates; deployed parity remains UNKNOWN).
- `docs/audit/2026-10-24/metric-lineage.csv`: sidebar status no longer lists snapshot
  or CSV fallback; records the timeout and Suspense boundary.
- This receipt. Historical verification/browser evidence remains historical.

## Verification

- `npm ci --prefix web`: PASS, 71 packages installed.
- `node --experimental-strip-types web/tests/sidebar-status.test.mjs`: PASS,
  14 tests covering failures, no dataset downloads, abort configuration, cache
  behavior, unknown versus measured zero, synchronous shell/Suspense composition,
  invalid dates and success/unavailable rendering.
- Focused navigation, Supabase boundary, BI audit, audit contracts and Merchant
  tests: PASS (5 additional files).
- Baseline regression harness using the original source/brand from `3ed26b2`:
  both selected tests FAIL as expected (HTTP failure propagates a Google Sheets
  error; brand returns a promise). The complete new test suite passes on this fix.
  A first attempt to run every new test against old source was interrupted because
  the timeout mock was designed to prohibit the old dataset fallback; only the two
  selected, completed failures are used as baseline evidence.
- Inventory, contract and read-only SQL generators with `--check`: PASS. No RPC
  or SQL diagnostics were executed against a database.
- Workspace `npm run check`: 14 test files PASS, 3 FAIL because the sandbox denies
  `.agents/runtime` writes. TypeScript/build are not reached by that command.
- Full `npm run check` in `/tmp/issue43-sidebar-check-vd5csq1w`: PASS, exit 0;
  all 17 test files, TypeScript and optimized Next.js production build pass.
  161 source/test/config files under `.agents`, `scripts`, `web`, `supabase` were
  subsequently checked byte-for-byte against the workspace. This receipt was added
  after the copy and does not change executable source.
- `git diff --check`: PASS; untracked source/artifacts also checked for whitespace.

Source SHA-256 checksums from the successful verification:

```text
6635cc83a206860cd25da5048ec599dcbe5e296d910f3928b46710349073aec5  web/components/SidebarBrand.tsx
a729caea83b68d99442dfdcd63ff47330d9539e688b9d21c420e9b2f4c48635b  web/lib/data/source.ts
814c494eb127d29f44e4c9ab4e5d337da51a9c0f17d42126bc44dd313c846bfa  web/tests/sidebar-status.test.mjs
c7c1701c22164e7ba5d90a0213901a1cb808f1e8c9e254d2f5a27f49f4542d0d  web/tests/supabase-boundary.test.mjs
```

## Handoff limitations and remaining QA

WORKING was stated in the Codex conversation first. No remote status publication
is claimed: `gh api` cannot authenticate without GH_TOKEN and unauthenticated curl
cannot resolve api.github.com. The referenced review comment's text could not be
retrieved; it was requested from the user. Implementation is limited to confirmed
sidebar/status defects within the trusted trigger's named scope. Exact alignment
with any additional requirements in that inaccessible comment remains unverified.

No new commit SHA exists in this turn. `3ed26b23a799df7c490fc9fc2651e95a45648075`
is the preserved source revision, **not** the revision containing this fix. The
trusted runner must commit/push the verified working tree and report its exact full
SHA for recovery of existing PR #44; do not create a duplicate PR. No push, commit,
PR creation, deployment, migration, database-function change, credential change,
scheduler/provider activation, external business write, SYRVE or advertising action
was performed. Existing App/Merchant/currency/null behavior is preserved.

Barbara must run authorized desktop/mobile preview QA against the runner's final
SHA, compare the review comment, confirm navigation does not prefetch other pages,
confirm only the status RPC is requested for sidebar metadata, verify the shell and
navigation appear while status is slow, and inspect unavailable/malformed-cutoff
states and logs. These component/transport tests do not prove browser streaming,
production latency improvement, live freshness or the overall audit's completeness.
