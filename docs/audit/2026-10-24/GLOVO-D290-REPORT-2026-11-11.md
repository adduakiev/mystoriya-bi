# D290 — offline synthetic Glovo report rendering, issue #43 / #48 / PR #44

PREVIEW CODE ONLY. Candidate prepared; full acceptance remains BLOCKED in the
inner sandbox. No source connection, real financial records or release claim.
The broader issue #43 audit remains incomplete.

WORKING was acknowledged in commentary. AGENTS.md was read first. Local branch
`astra/issue-43-40107435112`, clean worktree and HEAD
`440bd15b52ae37dd6e898e5da440496ab35513fc` matched the trusted outer gate.
Local process names showed only Codex and its inspection command. Subsequent
remote drift/concurrency checks and commit/push belong to the trusted runner.
The supplied D290 trigger and local D288/D289 receipts define scope; linked
issues #48/#6 and latest GitHub comments were not independently fetched inside
the sandbox, which has no GitHub connector/token. No remote retry was made.
The trigger-reported baseline CI #42960290847 and SHA-matched READY Preview
accept the starting revision only, not this working-tree candidate.

## Change and lineage

`GlovoReportPresenter` accepts only a non-null `ReturnType<typeof buildGlovoReport>`.
The page renders it conditionally when the source supplies a report; the actual
source still returns SOURCE UNAVAILABLE, null report/event/read timestamps, and
performs no I/O. Its only change is an erased type import and nullable report
type assertion needed for the future conditional branch. No runtime provider,
fixture fallback, credential, fetch, refresh, SQL or aggregation path was added.

| Visual block at `/aggregators/glovo` | Value / lineage / limitation |
| --- | --- |
| Source notice and definitions | Existing unavailable notice and UNKNOWN freshness retained; unavailable-only planned-period notice avoids contradicting a future supplied report |
| Coverage and brand register | Builder `coverage`, `months`, dynamically discovered `brands`; PARTIAL means observed values, not a complete total |
| Delivered orders KPI | Builder `metrics.deliveredOrders`; null is unavailable, numeric zero remains measured zero |
| Purchase sum KPI | Builder `metrics.purchaseSum`; local currency identity UNKNOWN; no net-profit/commission claim |
| Average ticket KPI | Builder `metrics.averageTicket`, ratio of sums with positive known orders; no second calculation in presenter |
| Previous-period change | Always unavailable; no previous report supplied or invented |
| Monthly trend table | Builder `trend`, Order Created Local Month, orders/sum/average and per-month coverage; gaps stay unavailable/PARTIAL |
| Brand × source-location detail | Builder `rows`, raw brand, approved group, source location/name/address, source Excel row lineage; physical location/ownership/real-or-virtual identity UNKNOWN / needs mapping |

All report values follow `normalizeGlovoSheet` → `buildGlovoReport` → presenter.
Only the existing explicit МітБар aliases normalize. No parser, new identity rule,
financial attribution, comparison, order IDs/statuses, currency or source timestamp
is invented. Default Jan–Oct 2026 is inherited from the builder; synthetic November
records are excluded. Known values with unchecked/incomplete coverage are visibly
PARTIAL; missing cells are never zero-filled. COMPLETE refers only to the builder's
coverage condition, not upstream parity or live freshness.

Both tables use captions, column/row headers and keyboard-focusable scroll
regions. Scoped minimum-width rules allow the existing local horizontal overflow
at desktop/mobile widths. This is static CSS/SSR evidence, not browser QA.
Generated `inventory.json` and `tab-block-matrix.csv` are refreshed: 23 pages,
7 API routes, 777 static templates; runtime parity remains UNKNOWN.

## Verification and acceptance limit

| Executed check | Result |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages installed |
| `node web/tests/glovo-contract.test.mjs` | PASS; 10 individual tests, no failures/skips |
| `node web/tests/glovo-preview.test.mjs` | PASS; 9 individual tests, no failures/skips; 5 new actual presenter/page SSR regressions |
| Focused Glovo, Aggregators status, navigation and auth suites via `node --test` | PASS; 5 file-level tests, no failures/skips |
| `node --experimental-strip-types web/tests/bi-audit.test.mjs` | PASS; 10 individual tests, including final inventory reproducibility |
| Inventory / query generators `--check` | PASS; no source or SQL execution |
| TypeScript `tsc --noEmit --project web/tsconfig.json` | PASS |
| Optimized Next.js build, direct build executable | PASS; includes `/aggregators/glovo` |
| `npm run check` | FAIL at test stage: 61 file-level tests, 51 pass / 10 fail / zero skips; command did not reach TypeScript/build |
| Direct native role-hardening diagnostic | FAIL before native assertions: PostgreSQL 16.15 cannot bind Unix socket, `Operation not permitted` / `pg_ctl: EPERM`; 1 static test pass / 1 native failure |
| `git diff --check` | PASS |

One acceptance blocker is the inner sandbox's required test-runtime restrictions.
Reproduce with `node web/tests/sales-role-hardening-postgres.test.mjs`; socket bind
fails before DB assertions. Full-check output also exposes protected
`.agents/runtime` mkdir ENOENT in Operating tests. The failed file set is the same
as the historical D289 inner receipt: `.agents/run`, `operating-tasks`,
`operating-v2`, and seven Sales PostgreSQL files (`atomic`, `attestor`,
`backup-restore`, `prewrite`, `rehearsal`, `release-v234`, `role-hardening`).
No uninspected individual failure is upgraded to a more specific diagnosis.
No test skips, runtime permission workarounds or gate weakening were introduced.
Diagnostic logs stay in `/tmp/d290-*`, outside the repository.

Synthetic tests exercise multiple brands/months, all approved aliases with visible
raw names, new unknown brands, escaped source names, lineage, null versus zero,
missing/unchecked/empty coverage, November exclusion and unknown physical/virtual
flags. The real loader/page test rejects fetch, verifies null report and four
unavailable KPIs, and excludes synthetic numbers/labels from the actual page.
Only a test-local adapter override can render synthetic reports; no runtime
override or public fixture endpoint exists. Shared SidebarBrand is substituted in
SSR to exclude unrelated session/Sales status I/O, as in the prior harness.

## Separate next gates

Trusted outer full verification must pass before same-PR #44 handoff; subsequent
independent exact-new-SHA PG16+PG17 and matching Preview adjudication remain
pending. Authenticated desktop/mobile Preview, source parity and real-data QA
were not performed. Private Glovo source authorization/connection and coverage
evidence are separate future gates; 30-day/prior-30-day and 12-month upstream
coverage are not newly proven by monthly synthetic SSR tests.

No commit, push, new PR, merge, deployment, production/staging migration, external
request, source/sharing/credential change, scheduler or business write was made.
Sales recovery and SU-545195 HOLD remain unchanged. NOT READY FOR RELEASE.
