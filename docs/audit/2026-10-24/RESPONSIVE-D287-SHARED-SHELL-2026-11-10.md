# D287 — shared shell containment, issue #43 / existing PR #44

**Preview-code candidate; trusted OUTER acceptance pending. NOT READY FOR RELEASE.**
The only application change is three CSS declarations. Local static/SSR checks
pass; local browser measurements are BLOCKED. The historical 17 page-level
overflow cases remain open. The broader data/source audit remains incomplete.

## Baseline, acknowledgement and authority

- Read `AGENTS.md` before inspection/edits. Local HEAD exactly matched
  `644f36b7af940a373e9597cd204dc5e100df909a`; initial worktree was clean on
  `astra/issue-43-40107435112`.
- The supplied trusted OUTER receipt establishes PR #44 OPEN/unmerged, expected
  branch and exact remote starting SHA. No inner `gh`, remote probe or credential
  check was required or attempted. Remote drift/concurrency checks and any
  commit/push remain the trusted runner's responsibility. Local process listing
  showed Codex and its command only; it cannot inspect the GitHub run queue.
- WORKING was recorded in commentary before implementation. No GitHub message
  was posted inside Codex; the runner owns the issue/PR status handoff.
- D286 was already adjudicated; no duplicate D286 run. Its
  [report](RESPONSIVE-D286-NO-CHANGE-2026-11-10.md) remains historical evidence.
  The trigger reports OUTER PG16.15 642/642 PASS plus build for D286; earlier
  dual-PG acceptance was at code-identical `371607a`, not the exact starting
  docs-only SHA. Neither receipt accepts this new CSS candidate.

## Independent source inspection before patch

`web/app/globals.css:17` originally used `230px 1fr`; line 84 used `74px 1fr`
at 1100px. `.workspace` at line 31 was a grid item with `width:100%`, 64px
horizontal padding, 1650px maximum, auto margins and automatic minimum width.
The 720px rules change the shell to block, hide the sidebar and reduce padding.
Universal border-box and zero body margins are present.

| Route | Actual source chain | Intended inner scroll |
| --- | --- | --- |
| `/` | `web/app/page.tsx:166` main.shell → section.workspace → section.panel.management-panel → div.management-table-wrap → div.management-table | `globals.css:143–144`: overflow-x:auto, minimum table width 1050px |
| `/delivery` | `web/app/delivery/page.tsx:197` main.shell → section.workspace → section.panel.delivery-locations-panel → div.delivery-table-wrap → div.delivery-table | `globals.css:226–227`: overflow-x:auto, minimum table width 1220px |

The source matches the independently supplied simplified synthetic case: an
automatic grid track/item minimum can expand the workspace to fit the table
instead of constraining the inner wrapper. `.panel` already clips overflow; it
does not constrain the automatic outer grid minimum. No source contradiction
was found. Actual route SSR with synthetic RPCs also confirms these ancestor
chains and table wrappers; this is not an authenticated application rendering.

Before patching, created the simplified fixture using the unchanged full CSS
and attempted baseline Chromium measurement. Browser startup failed before any
DOM measurement. Per D287's explicit fallback, proceeded with bounded static/SSR
failure controls and the supplied independent synthetic evidence.

## Discrepancy and external measurements

**P1, shared-shell intrinsic minimum:** expected page width bounded by viewport,
with horizontal movement inside the intended table wrapper. Actual independently
reported synthetic baseline expands the page and leaves the wrapper unscrollable.
Provenance: [D287 independent receipt](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6781589137),
as quoted in the trusted trigger; not re-fetched or measured inside Codex.

All numeric results below are **EXTERNAL / SIMPLIFIED SYNTHETIC DOM**, not local
results, full-application results, or authenticated Preview acceptance.

| Route | Viewport | Baseline document | Corrected document | Baseline wrapper client/scroll; scrollLeft | Corrected wrapper client/scroll; scrollLeft |
| --- | ---: | ---: | ---: | --- | --- |
| `/` | 768 | 1226 | 768 | 1050/1050; 0 | 592/1050; 458 |
| `/delivery` | 768 | 1396 | 768 | 1220/1220; 0 | 592/1220; 628 |
| `/delivery` | 1440 | 1552 | 1440 | 1220/1220; 0 | 1108/1220; 112 |

The supplied receipt also reports containment at 360px (document 360) with
working inner scrolling, without complete per-route wrapper metrics. No numeric
360px wrapper result or 1440px Overview result is invented here. Historical
authenticated Preview Delivery widths were 1395/1551; the approximately 1px
synthetic difference is acknowledged. Historical agreement supports the
hypothesis but does not close any real-route QA case.

## Patch and regression boundaries

- `web/app/globals.css`: default `230px minmax(0, 1fr)`, 1100px breakpoint
  `74px minmax(0, 1fr)`, `.workspace { min-width:0 }`. Existing maximum, padding,
  margins, mobile sidebar behavior and internal scroll rules are retained.
- `web/tests/shared-shell-containment.test.mjs`: four bounded source/SSR tests.
  They reject each independently reverted declaration, check mobile/workspace
  bounds and internal scrollers, reject root clipping masks, render actual
  Overview/Delivery pages through the existing offline harness, and inspect the
  source-derived fixture. These do not compute viewport layout.
- `web/tests/support/shared-shell-fixture.mjs`: simplified DOM with real class
  hierarchy, unchanged full CSS, no external I/O and restrictive CSP. The
  baseline control removes only the three candidate declarations; verified
  byte-for-byte equal to `git show HEAD:web/app/globals.css` from the starting
  SHA, using a temporary file. No test depends on Git access.
- `scripts/bi-audit-shell-browser.mjs`: bounded offline browser gate for both
  routes × 360/768/1440 × baseline/corrected (12 cases when browser available).
  It checks document width, wrapper client/scroll widths, nonzero scrollLeft and
  final-column reachability. Baseline overflow is required at 768 for both and
  1440 Delivery; 360 and 1440 Overview are non-overflow controls. Startup failure
  exits nonzero, never skips or reports PASS. This optional browser gate is
  separate from the automatically collected static/SSR regressions.

## Actual inner verification

| Command | Result |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages installed |
| `node --test web/tests/shared-shell-containment.test.mjs web/tests/preview-ui-contracts.test.mjs web/tests/gbp-location-labels.test.mjs` | PASS; reporter counts 3 file-level tests, zero failures/skips |
| `node web/tests/shared-shell-containment.test.mjs` | PASS; 4 individual tests, zero failures/skips |
| Baseline fixture CSS vs starting HEAD CSS | PASS; byte-for-byte equality |
| `node scripts/bi-audit-shell-browser.mjs --baseline-only` before CSS edit | BLOCKED_BROWSER_STARTUP; first case `/` 360, SIGABRT / EPERM, no measurements |
| `node scripts/bi-audit-shell-browser.mjs` after CSS edit | BLOCKED_BROWSER_STARTUP at baseline control; corrected cases not executed |
| `npm run check` | FAIL in test stage; 59 file-level tests, 49 pass / 10 fail / zero skips; TypeScript/build stages not reached |
| `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS separately |
| `cd web && node node_modules/next/dist/bin/next build` | PASS separately; optimized Next.js 15.5.27 build, type validation and static generation |
| `git diff --check` | PASS |

The full check reports the same failing file set documented by D286:
`.agents/run.test.mjs`, `operating-tasks`, `operating-v2`, and seven native Sales
PostgreSQL files (`atomic`, `attestor`, `backup-restore`, `prewrite`, `rehearsal`,
`release-v234`, `role-hardening`). The captured reporter explicitly shows
`ENOENT` creating protected `.agents/runtime/` in `operating-tasks`; it does not
expose the other file-level failure causes. No PostgreSQL acceptance is inferred,
no failure is suppressed, and no sandbox/runtime permissions are changed.

Chromium stderr reports `setsockopt: Operation not permitted (1)` and
`Check failed: client.StartHandler(...)` in crashpad startup. No alternative
protection bypass was attempted. Local logs/fixtures/profiles remain in `/tmp`
(`d287-{npm-ci,focused,shell-direct,check,tsc,build,browser-baseline,browser-candidate}.log`
and `issue43-shell-browser-*`); no screenshots or runtime artifacts are added.

## Handoff and distinct gates

The candidate is available for code review in the working tree, but trusted
acceptance is **BLOCKED/PENDING**, not READY FOR RELEASE. No new commit SHA,
commit/push, PR, deployment, DB migration/write, hosted Edge/canary request,
credential, scheduler or data import was produced. Production recovery paths,
D284 GBP identity, data loaders, KPI/filter definitions and routes are untouched.

1. Trusted runner rechecks remote HEAD/branch, PR OPEN/unmerged and writer
   concurrency, then runs focused tests and full disposable native PG16
   `npm run check` without skips. It alone may commit/push to the existing branch
   after successful checks and must record exact new SHA and changed paths.
2. Independently record exact-new-SHA GitHub-native PG16+PG17 CI and Vercel
   Preview status. These results are not available inside this attempt.
3. Run `node scripts/bi-audit-shell-browser.mjs` in a permitted browser
   environment. Retain baseline failure-control and corrected metrics with the
   synthetic label. Its success still cannot substitute for full-app QA.
4. Authenticated Preview QA for `/`, `/delivery`, `/locations`, `/digital/local`
   at 360/768/1440 remains UNVERIFIED: no authorized browser session was supplied.
   Do not request credentials/share links or close the historical 17 failures
   without actual measurements, internal scrolling and visible-control checks.
5. Supabase `SU-545195` HOLD, hosted v3 401, all Sales release/data-write gates
   and the wider issue #43 audit remain separate and unresolved.

## Independent trusted OUTER adjudication (2026-11-11 UTC; documentation-only receipt)

This appended receipt is **independent of Codex's inner handoff wording**. Astra [workflow #42919311671](https://github.com/adduakiev/mystoriya-bi/actions/runs/42919311671), trusted OUTER job `130189830476`, COMPLETED SUCCESS. Its actual outer native PostgreSQL **16.15** reported **646/646 PASS, 0 fail, 0 skipped**; optimized Next.js build and `git diff --check` PASS, then the trusted runner really committed/pushed `6a6fe79405591d99216070de6fc020ebb8a1db52` to existing open/unmerged PR #44. Compare `644f36b7af940a373e9597cd204dc5e100df909a...6a6fe79405591d99216070de6fc020ebb8a1db52` = **one commit / six paths**: shared CSS, shell regression/fixture/browser script, evidence/status docs. No importer, auth, SQL, data source, or Production paths changed. Inner `49/59` sandbox file-level failures do not override the outer native result.

Exact D287 application SHA `6a6fe79405591d99216070de6fc020ebb8a1db52` has **Vercel Preview READY**, `target=null`, correct branch, deployment `dpl_mAYxjKDE9XU5onWWbKxtTwUX5vjb`. This is Preview metadata, **not** authenticated browser/viewport confirmation. Independent GitHub check search as of this receipt found **no exact-head PostgreSQL 17 native acceptance run**; earlier dual PostgreSQL 642/642 belongs to old code SHA `371607af0027e3197cd07e20f865a7a46bc4819e` and **cannot** be transferred to the CSS change. Historical 17 real-browser responsive cases remain open; only the external synthetic fixture verifies width/scroll behavior.

**Next single gate:** trigger and independently inspect exact-new-head PostgreSQL 16 + 17 acceptance without changing application code. This **documentation-only append** on the *same PR branch* intentionally creates a GitHub-App-authored push to activate the existing push-only native workflow (Astra's `GITHUB_TOKEN` push does not trigger it). The resulting new commit SHA, dual native logs and new exact-head Preview must be adjudicated separately; until then **NOT FULLY ACCEPTED / NOT RELEASED**. After the narrow gate, owner priority is backlog [#48 Aggregators → Glovo brand analytics](https://github.com/adduakiev/mystoriya-bi/issues/48), beginning with read-only source-contract review. Supabase `SU-545195` hosted 401 remains HOLD. No deployment/Edge request, import, DB/SQL, secrets, production release, merge, new PR or schedule modification.
