# D288 — Glovo brand analytics, issue #43 / #48, existing PR #44

Preview-code candidate only. Source integration is BLOCKED; no live refresh,
financial correctness, authenticated Preview acceptance or production release is
claimed. The wider tab-by-tab audit remains incomplete.

## Authority and preflight

WORKING recorded in commentary before implementation; no GitHub status message
posted from Codex. The trusted outer runner owns issue/PR handoff and confirmed
PR #44 OPEN/unmerged, expected branch and remote starting SHA. Local HEAD matched
`c39095111d895833c95fc6b26145a689a25533a9`, branch
`astra/issue-43-40107435112`, with a clean initial worktree. Local process listing
contained Codex and its command only. Remote concurrency/drift and subsequent
commit/push remain outer-runner responsibilities; no inner remote checks.

Scope follows the supplied D288 trigger and owner-priority quotation. Linked
issue #48, #6 owner comment and latest remote issue/PR content were not separately
fetched: no GitHub connector or authorized GitHub token is available here. No
untrusted network/auth retry was made. D287's supplied exact-base independent
receipt records PG16.15 and PG17.11 646/646 PASS and Preview READY; it accepts that
baseline's narrow offline CSS gate only, not this new candidate.

## Source register and read boundary

Approved source descriptor supplied by the owner: private native Sheet
[Glovo workbook](https://docs.google.com/spreadsheets/d/1HyYPtd1A369n7FYs0Oty_Z2oCZaq5hBxe4E-g2B0k98/edit),
`Дані`, headers A5:I5, records from row 6. The seven supplied tab names are
`Огляд`, `Динаміка`, `Бренди`, `Заклади`, `Бренд × заклад`, `Дані`, `Перевірка`.
Owner-supplied independent connected-reader observation: 341 month/brand/location
rows, 331 with both numeric measures, 10 missing numeric (Jan 5 / Feb 2 / Nov 3),
7 raw brands and 8 normalized location labels. Jan–Oct monthly orders and purchase
sums reconcile at difference zero *within the transformed Sheet*. These figures
are receipt context, not locally downloaded data or proof of original export
parity; no actual business measures are copied into the repository.

Actual latest source event time, currency identity, expected complete row volume,
BI runtime account/access, connector ownership and schedule are UNKNOWN. Partial
November is reported present despite the Jan–Oct title. No new source observation
was made. There is no authorized exact Glovo runtime provider in the inspected
code: `web/lib/data/source.ts` uses public gviz CSV for legacy Sales; prepared
`google-sheet-reader.mjs` / `prepared-sales-sheet-capture.mjs` are fixed to a
*different Sales spreadsheet and range*. Neither establishes Glovo authorization.
No credentials were inspected, broadened, added or requested; no Sheet fetch or
sharing change was attempted.

`web/lib/data/glovo-source.ts` is a server-only, disconnected read boundary. It
returns SOURCE UNAVAILABLE, null report/latest-event/read time, and makes no I/O.
There is no environment toggle, public CSV fallback, sample result fallback,
Sales/P&L substitution, new endpoint or claim of live refresh. A future authorized
provider must independently establish exact descriptor/access, bounded private
read and typed-month conversion before connecting to the pure transform.

## Implemented report and source-to-metric lineage

`/aggregators/glovo` adds a separate accessible report and sidebar child, plus an
in-content link on `/aggregators` so it remains discoverable when the mobile
sidebar is hidden. Existing Aggregator Control Center/P&L calculation and filter
paths are unchanged. New route stays under existing middleware login protection;
its child link does not propagate unsupported LFL. Sidebar links keep prefetch
explicitly disabled, accessible labels at collapsed widths and active-page state.

The page deliberately renders blocked KPI, month-trend and brand/location table
structures with em dashes and an explicit unavailable explanation. No fabricated
chart points, financial amounts, currency sign, filters suggesting available data
or business actions. Tables have captions, column headers, focusable scroll
regions and local horizontal overflow; scoped KPI layout adapts to narrow widths.
Static/SSR checks do not prove rendered viewport containment.
The SSR test substitutes the shared SidebarBrand to exclude session/sync I/O;
the actual shared sidebar retains its existing Sales status behavior. A Sales
status observation cannot establish Glovo connectivity or completeness.

Prepared pure transform `web/lib/data/glovo-contract.ts`:

| Source column | Prepared meaning / restriction |
| --- | --- |
| Місяць | Order Created Local Month; canonical YYYY-MM only; no UTC/date-title inference |
| Бренд | Dynamic raw-brand discovery; original label retained |
| Заклад: група та головний бренд | Source location label; not proof of actual physical location |
| Назва / Адреса у джерелі | Preserved independently in the composite identity |
| Доставлені замовлення | Nonnegative safe integer numeric cell; missing/invalid stays null |
| Сума покупок, лок. вал. | Nonnegative finite numeric cell; no UAH/net-profit/fees claim |
| Рядок Excel | Positive integer source lineage, never order ID or unique key |
| Є числові дані | Preserved typed boolean; formula semantics unverified, never used to infer F/G completeness |

The input matrix starts at row 5; a future provider must prove actual source cell
representations. Current header names derive from the supplied contract, while
ISO month/typed-cell input support is PREPARED and tested with synthetic records,
not verified against private Sheet response bytes. Header/structural/duplicate
drift rejects the whole dataset, with row numbers and safe error codes only.
Key = month + raw brand + source location label + original name + original address;
source row can repeat across months. Aliases stay independently inspectable.

Only the explicitly listed Meat Bar / Meatbar / Мітбар aliases (and the supplied
combined slash label) normalize to МітБар, with apostrophe/case/whitespace
canonicalization; no fuzzy matching or guessed new-brand groups. All other groups
remain null; physical location, own/franchise and real/virtual classifications
remain UNKNOWN with visible reason. No orders/status/refunds/margin audit can be
inferred from monthly aggregates.

Metrics sum independently only if every selected row has that measure. Empty or
incomplete totals are null; measured zero remains zero. Average ticket is ratio
of sums with positive known order count. Default period is explicitly Jan–Oct
2026; November cannot leak into default totals. Explicitly selected new months
remain PARTIAL without separate verified coverage. Row presence and same-Sheet
subtotal equality never establish completeness. Missing months produce null
trend points; comparisons require both complete periods and positive prior sum.

[Machine-readable block matrix](glovo-d288-inventory.json) covers every new visual
block and records its source/definition, grain, default period, missingness,
freshness and evidence. The generated full source inventory and CSV matrix are
refreshed for the new route/shared navigation (23 pages, 7 API routes, 771 static
templates), with WAITING status, no business RPC/fallback and runtime parity
UNKNOWN. Historical data receipts are unchanged. Positional template IDs and
shared paths cause generated-file churn, not additional application changes.

## Reproduced discrepancies and coverage

| ID / priority | Expected | Observed / reproduction | Disposition |
| --- | --- | --- | --- |
| G288-01 / P1 BLOCKED | Authorized exact Glovo source in BI | `loadGlovoSource()` returns SOURCE UNAVAILABLE and null report; fail-on-fetch regression proves no request | Honest blocked UI; authorized provider remains unimplemented |
| G288-02 / P1 RISK CONTROL | Default Jan–Oct excludes partial November | Synthetic 11-month input defaults to 10 months; explicit November remains PARTIAL | Tested prepared contract; no historical production bug claimed |
| G288-03 / P1 RISK CONTROL | Missing values and duplicated keys must not inflate totals | Null stays null; duplicate composite key rejects whole input; repeated source Excel row across months accepted | Tested prepared contract; synthetic evidence only |
| G288-04 / P2 PREPARED | Discoverable separate brand report | New child and content links target `/aggregators/glovo`; existing P&L untouched | SSR/navigation/auth regression covered |

30-completed-day / prior-30-day parity: NOT APPLICABLE to this monthly source;
order-level dates and statuses are absent. SQL/warehouse/UI source parity:
UNVERIFIED, because no provider is connected and no SQL call is introduced.
12-month coverage: NOT PROVEN; supplied receipt covers Jan–Oct and partial Nov,
not a complete rolling year. The default Jan–Oct window is a selection rule,
not a claim that all its source measures/rows are complete. Current runtime
freshness and all source counts remain UNKNOWN; no zero-filled coverage report.

## Verification

Logs/SSR fixture/browser artifacts remain in `/tmp/d288-*`, not in the repository.
No authenticated browser session
was available; no login bypass, private Preview fetch or screenshot claim.
Historical 17 responsive cases remain UNVERIFIED on real Preview.

| Check | Local result |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages installed |
| `node web/tests/glovo-contract.test.mjs` | PASS; 7 individual tests, zero failures/skips |
| `node web/tests/glovo-preview.test.mjs` | PASS; 4 individual tests, zero failures/skips; actual source/page with shared-brand and CSS-module test boundary |
| `node web/tests/navigation-prefetch.test.mjs` | PASS; 3 individual tests, including child navigation and every active sidebar route |
| `node web/tests/preview-auth-probe.test.mjs` | PASS; 3 individual tests with synthetic HTTP only; new route included |
| `node --experimental-strip-types web/tests/bi-audit.test.mjs` | PASS; 10 individual tests, including reproducible inventory and every route |
| Existing Aggregators status, preview UI, sidebar, shared shell and navigation suites via `node --test` | PASS; 5 file-level tests, zero failures/skips |
| Inventory/queries generators `--check` | PASS; no SQL execution |
| TypeScript `tsc --noEmit --project web/tsconfig.json` | PASS |
| `cd web && node node_modules/next/dist/bin/next build` | PASS; optimized Next.js 15.5.27 production build includes `/aggregators/glovo` |
| Full `npm run check` (final `/tmp/d288-check-final-contract.log`) | FAIL at test stage; 61 file-level tests, 51 pass / 10 fail / zero skips; TypeScript/build stages not reached by this command |
| Disposable PG16 direct role-hardening test | FAIL; 1 static pass / 1 native failure; Unix socket bind EPERM before native assertions; PG17 binaries unavailable locally |
| Offline source-derived Glovo SSR fixture at 360px in Chromium | BLOCKED before rendering: exit 134 / crashpad `client.StartHandler`, `setsockopt: Operation not permitted`; no viewport or screenshot result |
| `git diff --check` | PASS |

Browser attempt used only an offline `/tmp` fixture with real page markup and
source CSS, restrictive no-connect CSP and substituted shared brand. It was not
an authenticated application or real Preview. No browser restriction workaround
or runtime-permission change was attempted.

The ten full-check failures match the historical D287 file set: `.agents/run`,
`operating-tasks`, `operating-v2`, and seven Sales native PostgreSQL suites
(`atomic`, `attestor`, `backup-restore`, `prewrite`, `rehearsal`, `release-v234`,
`role-hardening`). The full reporter explicitly exposes protected
`.agents/runtime/` mkdir ENOENT in operating-tasks; the separate direct PG16 test
exposes socket EPERM. Other file-level failures are not upgraded to specific
diagnoses without detailed evidence. Both new Glovo suites and updated inventory,
navigation and auth-probe suites pass in the final full run. Separate final
TypeScript and optimized build pass after the final contract change.

**Handoff: candidate prepared, acceptance BLOCKED/PENDING trusted outer native
checks and exact-new-SHA Preview.** No commit, push or new SHA was created here.
Source integration is separately BLOCKED on exact authorized runtime access and
verified cell/coverage semantics. This is not READY FOR RELEASE or completion of
issue #43's broader audit.

## Changed files

- Report: `web/app/aggregators/glovo/page.tsx`, `report.module.css` in the same directory.
- Prepared data boundary/transform: `web/lib/data/glovo-source.ts`, `glovo-contract.ts`.
- Discovery: `web/components/DashboardSidebar.tsx`, `web/app/aggregators/page.tsx`,
  one child-link rule in `web/app/globals.css`.
- Regressions: `web/tests/glovo-contract.test.mjs`, `glovo-preview.test.mjs`,
  updated `navigation-prefetch.test.mjs` and `preview-auth-probe.test.mjs`
  (29 inventoried read-only probe targets, including Glovo login denial).
- Inventory: `scripts/bi-audit-inventory.mjs`, generated
  `docs/audit/2026-10-24/inventory.json` and `tab-block-matrix.csv`.
- Evidence: this report, `glovo-d288-inventory.json`, links/status in
  `docs/BI-DATA-AUDIT-2026-10-24.md` and `docs/PROJECT-STATUS.md`.

## Separate handoff gates and execution plan

1. Review this reversible working-tree candidate. Trusted runner alone checks
   remote drift/concurrency and same-PR state, runs full disposable PG16/PG17
   `npm run check`, then handles any commit/push to existing PR #44. No new PR.
2. Independently inspect exact-new-SHA native CI and exact-head Vercel Preview.
   Neither the baseline 646/646 receipt nor local SSR accepts this new code.
3. Authorized-session Preview QA at `/aggregators` and `/aggregators/glovo`,
   desktop/mobile: navigation, login, missing state, keyboard focus, containment
   and inner-table scrolling. No claim of authenticated QA before execution.
4. Separate source gate: owner confirms existing authorized private Glovo reader
   for the exact descriptor, actual typed date/cell contract, coverage and mapping
   evidence. Then prepare bounded server-only reading and source-vs-transform-vs-UI
   reconciliation; no new sharing/credentials assumed. Financial/ownership/order
   semantics remain UNKNOWN where unsupported.
5. Any production release/data mutation requires its own explicit owner approval.
   No SQL DDL/DML/migration, import, sync-google-sheet v9, DB/Edge/canary, credential,
   scheduler, provider, paid service, ad or Glovo action, deployment or merge.
   Sales atomic recovery and its 503 guards remain unchanged; SU-545195 / hosted
   401 HOLD remains unresolved. Digital v2/Data Gap Workshop remain queued.
