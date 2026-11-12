# Issue #43 / PR #44 — preview QA continuation, 2026-10-26

Bounded code/test package prepared for review. Full issue acceptance remains
INCOMPLETE: remote preview auth boundary, authenticated BI, real layout,
hydration, chart interactions, upstream and rendered-value parity are unverified.
No production release gate is requested. Owner action NONE for these QA tasks.

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40255887088
Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Requested reviewed source: `6f624cf64a50ba4f33ca24998f6140fa79ad9957`.
Actual checkout HEAD: `4f0cfcec48408428d51ee916cb87a97a256e4807`, branch
`astra/issue-43-40255887088`. Git metadata is read-only; fast-forward failed
creating `.git/ORIG_HEAD.lock`. Reviewed changes were restored with `git diff
--binary HEAD <reviewed SHA>` and `git apply`, without index/ref changes. The
worktree includes the existing PR changes, including restored untracked files.
No new commit SHA exists: the trusted runner owns commit/push to existing PR #44.
Neither SHA above identifies this new uncommitted package.

WORKING was acknowledged first in the Codex transcript with the trusted Actions
URL. `gh issue comment 43 --body ...` failed because `GH_TOKEN` is absent.
No GitHub status post, push, commit, PR creation or deployment is claimed.
The runner must post the final status and record its actual candidate SHA.

## Evidence classes and execution results

| Evidence | Actual result | What it proves |
|---|---|---|
| Trigger relay | Exact reviewed SHA Preview `dpl_AVPAkndup2LzBitj9p5Ztict5GUp` READY; `/`, `/digital`, `/operating` reportedly HTTP 200 app login shell | Vercel-level historical 403 reportedly resolved; no independent observation in this sandbox |
| Remote probe discovery | `curl --max-time 20 https://api.github.com/repos/adduakiev/mystoriya-bi/deployments?sha=6f624cf64a50ba4f33ca24998f6140fa79ad9957&per_page=10` fails `Could not resolve host: api.github.com`, HTTP 000 | No remote URL/HTTP/redirect/API proof; no token or protection bypass attempted |
| Local listener | Node HTTP server on `127.0.0.1:3100` emits `EPERM` before listening | No live local Next navigation; historical localhost URLs are continuation targets only |
| Real middleware, in process | PASS with synthetic configured password and missing configuration; every protected page and API matcher/method, query redirect, forged synthetic cookie | 307 same-origin `/login`; configured redirect preserves next; no session issued and no data fetch. This is local source behavior, not deployed behavior |
| Operating handlers, in process | PASS: input GET, runs GET/POST, tasks GET/POST/PATCH without session | 401 JSON `Unauthorized`, `Cache-Control: no-store`, no collector/task/manual-run IO. Middleware normally intercepts these first with 307; API clients following redirects can see 200 HTML login, not JSON data |
| Synthetic SSR | PASS: all 22 actual page modules: 19 RPC pages × four fixture states, plus three static/disabled pages (79 renders); seven sales selector contracts plus Digital period comparison and focused money/freshness/error assertions | Real route → real loader/adapter → UI bindings after substituting RPC IO. No hydration, viewport, SQL or upstream proof |
| Login browser fixture at 360/768/1440 | All three attempts `BLOCKED_BROWSER_STARTUP`, `SIGABRT`, `EPERM`; Chromium crashpad socket startup fails | No DOM assertions or screenshots executed; width parameters alone do not prove mobile/desktop behavior |
| Real browser matrix | 66 NOT_EXECUTED; zero completed, zero screenshots | 22 routes × 360/768/1440; source/RPC/UI assertions prepared, no browser PASS inferred |

`preview-auth-boundary.test.mjs`, `preview-auth-probe.test.mjs` and
`preview-ui-contracts.test.mjs` contain 41 new subtests. The standard repository
runner reports one result per test file. Fixtures are synthetic, not business
measurements. P&L uses the existing bundled workbook and its actual calculator;
this does not reconcile finances. Operating gets a deliberately disabled mock
packet: no collector, filesystem run, current LIVE-run proof or task creation.
Sidebar brand/status IO, task interactions and chart client components are
stubbed. Server pages, Digital tabs/navigation, KPI markup, analytics, data
loaders, normalizers and filter argument builders execute their real code.
The fixture clock is fixed at 2026-10-24 UTC; external fetch and unmocked IO
dependencies are denied in tests. SSR markup is independent of viewport width.

The positive/null/empty/zero states test rendering without asserting unresolved
Sales null preservation (D04), SQL/fallback LFL equality (D07) or finance validity
(D08). Digital tests explicitly preserve the independent Ads/GBP windows (D05
remains OPEN). Meta retains USD/null purchases and withheld ROAS; Google Ads
money/currency and ROAS stay fail-closed. All 117 application/component/library/migration files byte-match the reviewed
source; no application/SQL code changed. The 2026-10-25 stored Google Ads parity and shifted
coverage receipts remain unchanged; they establish no new upstream/RPC/UI proof.

## Reproduction and matrix

- `node --experimental-strip-types --test web/tests/preview-auth-boundary.test.mjs web/tests/preview-auth-probe.test.mjs web/tests/preview-ui-contracts.test.mjs`
- `node scripts/bi-audit-browser-qa.mjs --check` validates the committed 66-row [execution matrix](qa-execution-matrix.json). `--matrix` emits JSONL; `BI_AUDIT_BASE_URL=https://EXACT-PREVIEW-ORIGIN` selects the confirmed origin. The checked-in localhost URLs do not assert a running deployment. Generator output never marks a test passed.
- `node scripts/bi-audit-auth-probe.mjs https://EXACT-PREVIEW-ORIGIN` runs bounded credential-free GETs on 22 pages and six API paths. It follows at most one same-origin `/login` redirect, does not send cookies/headers/passwords, and does not submit login or mutations. It outputs statuses/classifications, never response bodies or cookie values. 403 is classified as an unverified layer. A direct 401 is denial evidence only; the body is not audited. This command has **not** been run against the remote Preview because its origin could not be obtained here.
- `node scripts/bi-audit-login-browser.mjs` attempts the actual login SSR markup plus repository CSS in offline Chromium files at three widths. CSP blocks network and form actions; forms/links are intercepted, no password entered. Assertions: actual viewport, labelled password input, focus, font size, form fit and document overflow. Temporary browser profiles/HTML/stderr remain in `/tmp`. All three attempts here failed before assertions. This optional fixture cannot certify Next navigation or authenticated layout.

The matrix provides a unique ID/URL/viewport for each case, runnable
unauthenticated/mock work, session/runtime requirements, exact route RPCs, source
candidates, metric-field/UI assertions, filters, grain/timezone, and explicit
unknowns. Source candidates remain static lineage, not independently verified
production SQL definitions. Only `/login` (three widths) is session-free for
full page rendering; 63 BI cases require an existing authorized session. All 66
need a functioning browser runtime. SSR coverage shared across widths must never
be counted as 66 completed browser executions.

## Minimal secure tester-session process

1. Trusted runner/Barbara confirms the deployment origin and exact SHA from the
   existing PR #44 deployment metadata, records the identity in a redacted
   receipt, and runs the credential-free auth probe from a network-enabled QA
   environment. Report initial status, Location/next behavior and followed
   status separately; a 200 login shell is not BI access. A new revision requires
   its own deployment/SHA verification; prior Preview READY does not certify it.
2. An already-authorized tester uses their existing browser session locally on
   that exact preview origin. If that session is unavailable, mark SESSION_GATED
   and stop authenticated cases. Never paste a password, cookie, token,
   storageState file or bypass link into GitHub/chat, never change credentials,
   never copy production cookies to the runner. No credential action is needed
   for mock tests or this package.
3. Run each matrix case at its specified width. Record case ID, exact SHA,
   completed UTC window/timezone, selected account/property/currency/segment,
   expected SQL/RPC aggregate, displayed value, nullable field counts and source
   timestamps. Use only the already-authorized SELECT-only connection and audit
   diagnostics; if unavailable, source/RPC assertions remain UNKNOWN. Use
   current30/prior30/rolling12 coverage definitions, not a blanket “30 rows”.
4. Exercise only read-only selectors/navigation. Do not dispatch sync, task
   creation/update, manual analysis, credential forms or external actions.
   Loading/error/stale/empty and action-handler tests belong to disposable mock
   fixtures with outgoing requests intercepted. Record absent selectors as N/A;
   do not pretend all submodules accept the Overview date controls.
5. Record tooltip/drilldown, mobile scrolling/tap targets, keyboard/focus,
   console/runtime errors and sensitive-data boundaries. Shared-password auth
   does not establish distinct user roles; mark role cases N/A or UNKNOWN with
   the exact deployed capability, never invent RBAC or a low-privilege account.
6. Keep raw screenshots/HARs/session traces private and sanitize them before
   attaching evidence. Publish only redacted URLs/case outcomes and aggregate
   comparisons. No secrets, customer PII, cookies, raw exports or session files
   enter Git. Missing evidence is NOT_EXECUTED/BLOCKED, never PASS.

## Checks and remaining gates

`npm ci --prefix web`: PASS, 71 packages. Workspace `npm run check`: 19 test
files PASS, three fail because `.agents/runtime` is read-only; types/build not
reached there. The complete source copy at
`/tmp/issue43-40255887088-check-if6d4uj6` (runtime/build writes isolated; same
installed node_modules) passes all 22 test files, TypeScript and optimized Next
build. Initial copy accidentally omitted `supabase` and `.github`; that attempt
failed and is not PASS evidence. Both were copied unchanged before the successful
full run. `git diff --check` and whitespace checks of untracked text files pass.
See [machine receipt](preview-qa-verification-2026-10-26.json) for final commands.

The issue is **not READY FOR production audit acceptance**. Independent remote
HTTP, 66 real browser executions, actual viewport/hydration/chart QA and
source→RPC→UI equality remain blocked by execution/session/data evidence.
The next step is execution in a network/browser-capable QA environment with the
existing authorized tester session, not a new password or owner approval.
Trusted runner owns existing PR #44 publication and exact candidate SHA. Merge,
production promotion/deploy, migrations, credential changes, paid providers,
schedulers, ad changes and durable business writes remain separately owner-gated
and were not performed. Existing Meta Gate D was not duplicated.
