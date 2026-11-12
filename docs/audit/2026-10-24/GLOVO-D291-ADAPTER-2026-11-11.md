# D291 — offline private Sheets adapter contract, issue #43 / #48 / PR #44

PREPARE ONLY / OFFLINE ONLY. No runtime source connected. Broader issue #43
data correctness, coverage, browser QA and source-to-UI parity remain unproven.

## Baseline and authority

WORKING was acknowledged before implementation. AGENTS.md was read first.
Local `git rev-parse HEAD` matched the trusted outer baseline exactly:
`9c3eea436d4177b8e973ddbc3fdee6ac2e7ad779`; worktree started clean on
`astra/issue-43-40107435112`. Local process inspection showed one Codex process.
The supplied outer gate authoritatively verified existing OPEN PR #44, branch
and remote HEAD. Remote concurrency/drift checks, commit/push and PR handoff
remain the trusted runner's responsibility; no inner GitHub/network retry or
parallel writer was started. No new commit SHA is claimed for this worktree.

The supplied D291 trigger reports D290 independently accepted at that baseline:
[D290 exact-HEAD acceptance](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6789567485),
[CI #42972276272](https://github.com/adduakiev/mystoriya-bi/actions/runs/42972276272),
native PG16.15 and PG17.11 each 665/665 PASS, zero fail/skip, optimized builds
and Deno offline PASS, and matching
[READY Preview](https://vercel.com/adduakiev-9572s-projects/mystoriya-bi/FANsze1B4QRKVJRDkyQLv8GTFXs9).
This supersedes historical D290 pending-acceptance descriptions for the baseline
only. D290 is accepted OFFLINE ONLY, NOT RELEASED. Issue #48, PR comments and
owner-connected workbook observations were supplied through the trusted trigger;
they were not independently fetched inside this sandbox.

## Prepared boundary and lineage

New server-only `web/lib/data/glovo-sheets-adapter.ts` exports a frozen descriptor
and `prepareGlovoSheetReport(transport, coverage)`. There is no default transport,
network implementation, token operation, credential discovery, env lookup, runtime
factory or page import. Only tests instantiate/call the injected transport.

| Contract boundary | Prepared rule / evidence limit |
| --- | --- |
| Approved source | Spreadsheet `1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98`, tab `Дані`, range `'Дані'!A5:I`; no caller-selectable source or URL |
| Request | Official `https://sheets.googleapis.com/v4/spreadsheets/{fixed-id}/values/{encoded-range}`, GET, ROWS, UNFORMATTED_VALUE, spreadsheets.readonly, redirect:error; no writes or public CSV/scrape |
| Authorization | Caller must assert the exact source and read-only scope before the transport can be invoked. This is typed preparation, **not** Google authorization verification; no secret is accepted by this seam |
| Response | Exact transport envelope: HTTP 200, exact request URL, not redirected, JSON content type and parsed body. Denials, redirect destinations, HTML, raw text and unknown envelopes fail with report:null |
| Provider body | Exact ValueRange keys `range`, `majorDimension`, `values`; ROWS; resolved `'Дані'!A5:I{last-grid-row}` covering the returned matrix. The grid endpoint is not treated as populated row count |
| Matrix coverage | Required independent `matrixComplete:true` and `expectedMatrixRows` including header/interior blanks. Header-only, wrong count, truncation and absent evidence fail closed. Metadata is a trusted caller assertion, not independently established by this adapter |
| Cell contract | Nine exact headers through the existing normalizer; populated rows exactly nine columns; native strings B–E, numeric H lineage, numeric I=0/1, typed nonnegative F/G or blank `""`. Counts must be safe integers; malformed/extra cells and duplicate keys reject the entire dataset |
| Monthly completeness | Independent `verifiedMonths`, validated and snapshotted before awaiting transport; row presence cannot supply it. Empty/incomplete verification remains PARTIAL. Claiming a verified month absent from the matrix is rejected |
| Metrics | Validated matrix → existing `normalizeGlovoSheet` → existing `buildGlovoReport`. No alternative parser, alias rules or aggregation logic |
| Runtime/UI | `glovo-source.ts` and `/aggregators/glovo` unchanged: SOURCE UNAVAILABLE, report:null, unknown freshness, zero new transport/auth/env/network calls |

The owner-connected account observation establishes the supplied shape only;
it grants no deployable BI runtime authorization. A future transport must enforce
redirect rejection before forwarding authorization and consume/parse the whole
response. This seam validates its supplied metadata but cannot police a malicious
injected implementation or manufacture independent coverage evidence. Runtime
wiring, transport implementation and actual authorization are separate owner gates.

## Synthetic regressions and discrepancies

New `web/tests/glovo-sheets-adapter.test.mjs` exercises eight offline cases:
descriptor/import inertia; integration through the existing normalizer/builder;
measured 0 versus missing null with native I=0/1; pre-transport authorization and
coverage rejection; response/redirect/HTML denial with sanitized failures and no
logging/fallback; malformed/truncated/header/column/type/duplicate rejection;
coverage snapshot against mutation during async work; and actual loader/page
remaining unavailable with zero adapter/network calls. All labels/figures are
synthetic. Shared SidebarBrand is substituted to exclude unrelated session/Sales
status I/O, consistent with D290 SSR tests; this is not whole-browser network QA.

New brands are discovered automatically. Two locations with the same raw brand
keep distinct keys, location labels and Excel-row lineage; physical location,
ownership and establishment identity remain UNKNOWN. Default Jan–Oct 2026
excludes partial November. No currency, fulfilled status, net revenue, commissions,
source freshness or financial correctness is invented.

| Priority / state | Expected vs actual / next action |
| --- | --- |
| P1 PREPARED | Previously no private Glovo request/response seam; now an isolated typed offline seam, with synthetic regressions; live source remains unavailable |
| P1 OWNER GATE | Deployable source-specific read authorization and independently verified matrix/month coverage are required; neither exists in this candidate |
| P1 ACCEPTANCE BLOCKER | Full native acceptance cannot be established inside the sandbox; see verification below and require trusted outer checks |

No new visual block or runtime dependency was added, so the generated tab/block
inventory is unchanged. This work does not prove latest-30/prior-30-day or 12-month
source completeness; the approved source contract is monthly and no real request
was made. Wider audit artifacts and historical source counts retain their limits.

## Verification

| Executed check | Result |
| --- | --- |
| `npm ci --prefix web` | PASS; lockfile install, 71 packages |
| `node web/tests/glovo-sheets-adapter.test.mjs` | PASS; 8 individual tests, zero fail/skip, including the final sparse-matrix rejection |
| `node --test web/tests/glovo-contract.test.mjs web/tests/glovo-preview.test.mjs web/tests/glovo-sheets-adapter.test.mjs` | PASS; all 3 file-level suites, zero fail/skip |
| `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS |
| `node scripts/bi-audit-inventory.mjs --check` | PASS; unchanged 23 pages / 7 API routes / 777 visual/control templates |
| `node scripts/bi-audit-queries.mjs --check` | PASS; generated SQL only, not executed |
| `cd web && node node_modules/next/dist/bin/next build` | PASS; optimized Next.js 15.5.27 build, including `/aggregators/glovo` |
| `SALES_TEST_PG_BIN=/usr/lib/postgresql/16/bin npm run check` | FAIL at tests: 62 file-level suites, 52 pass / 10 fail / zero skip. TypeScript/build not reached by this command; separately run above |
| `SALES_TEST_PG_BIN=/usr/lib/postgresql/16/bin node web/tests/sales-role-hardening-postgres.test.mjs` | FAIL; 1 static pass / 1 native failure. PG16.15 starts but cannot bind disposable Unix socket: Operation not permitted / pg_ctl EPERM, before native assertions |
| `git diff --check` | PASS |

One acceptance blocker is the inner sandbox's required test-runtime restrictions.
Reproduce the native socket denial with the direct role-hardening command above.
The full check also reports ENOENT when Operating tests create protected
`.agents/runtime`. Its failing file set matches the historical D290 inner receipt:
`.agents/run`, `operating-tasks`, `operating-v2`, and seven Sales PostgreSQL files
(`atomic`, `attestor`, `backup-restore`, `prewrite`, `rehearsal`, `release-v234`,
`role-hardening`). Only the direct role-hardening failure is individually
diagnosed here; no hidden per-file failure is asserted to have the same cause.
The additional adapter suite passes in the full run. No native test skip,
permission workaround or gate weakening was introduced. Logs stay in
`/tmp/d291-*`, outside the repository; no private records/runtime artifacts are
committed. Candidate acceptance is **BLOCKED pending trusted outer verification**;
no full native zero-failure or new-SHA acceptance claim is made.

## Remaining gates

1. Trusted outer runner: full native PG16 tests with zero failure/skip, TypeScript,
   optimized build and diff checks before same-PR #44 handoff; then independent
   exact-new-SHA PG16+PG17 acceptance and matching READY Preview. Baseline evidence
   does not accept this candidate.
2. Owner-only source-specific credential/runtime-read authorization, deployable
   transport review and independently established matrix/month coverage. No
   network implementation or runtime wiring is enabled here.
3. Separately authorized source reconciliation and authenticated desktop/mobile
   Preview QA before any live correctness/release claim.

Sales atomic recovery and both existing 503 guards remain untouched. Hosted
Supabase SU-545195 HTTP 401 stays HOLD. No live provider invocation, Sales sync v9,
SQL/migration/import/Edge probe, source edit/sharing, credentials/env/config,
scheduler, paid service, business write, commit/push, new PR, merge or deployment
was performed. NOT READY FOR RELEASE.

## Independent trusted OUTER verification receipt — 2026-11-11 UTC

Independently inspected completed [D291 Astra workflow #42977999216](https://github.com/adduakiev/mystoriya-bi/actions/runs/42977999216), trusted OUTER job `130381500295`, distinct from the inner Codex sandbox. Its actual output reports disposable native PostgreSQL **16.15, 673/673 PASS, 0 fail / 0 skip**, TypeScript and optimized Next.js 15.5.27 build PASS, followed by actual commit/push of `dd739c15412d6dc604d7960a0fce95d9f7a79088` to the SAME open PR #44 branch. The handoff's inner 52/62 suites and no-commit wording reflect sandbox restrictions only; they do not override trusted outer execution. Independent `9c3eea4..dd739c1` comparison: exactly **one commit and five files**, limited to inert Glovo server-only Sheets contract, eight synthetic regression tests and three audit/status documents. Live `glovo-source.ts` remains **SOURCE UNAVAILABLE** with `report:null`, no secret, transport or network wiring; no production/source/Sales mutation. [Matching D291 code-SHA Vercel Preview](https://vercel.com/adduakiev-9572s-projects/mystoriya-bi/G929TU4jDprg7rBDvCmkSevsr8Jc) independently reports READY, `target=null`.

**This receipt is documentary only.** Exact-HEAD native **PG16 + PG17** CI has not yet been observed for `dd739c15412d6dc604d7960a0fce95d9f7a79088`; prior dual-PG acceptance belongs to the older D290 SHA. This documentation-only update is intended to exercise the normal push-triggered native CI for a **new** same-branch HEAD. Until both exact-SHA runners and the matching Vercel Preview are verified, D291 is **OUTER PG16 PASS / DUAL-PG PENDING / NOT RELEASED**. No duplicate Astra writer was launched. Source authorization, independently proven matrix/month completeness, actual data parity and authenticated browser QA remain separate gates. Supabase SU-545195 hosted 401 remains on HOLD, no repeat probe.
