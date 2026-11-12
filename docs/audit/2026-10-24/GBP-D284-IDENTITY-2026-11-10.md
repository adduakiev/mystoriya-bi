# D284 — stable GBP profile identity, issue #43 / existing PR #44

Preview code only for `/digital/local`, following the
[D284 control-room decision](https://github.com/adduakiev/mystoriya-bi/issues/6#issuecomment-6778051533).
Starting local HEAD independently matched `6934e0def8b18bfed7d4f17882ef024fa829e35c`;
branch `astra/issue-43-40107435112`; worktree was clean. The supplied trusted
OUTER gate established remote PR OPEN/branch/SHA/clean-checkout state. No inner
remote retry was made. Queued remote writers cannot be inspected here; remote
concurrency, final drift checks, candidate commit/push and exact-new-SHA CI remain
the trusted runner's responsibility. No candidate SHA exists inside Codex.
WORKING was posted in the transcript first; no remote comment is claimed.

## Reproduced defect and correction

P1, D26 follow-up: the existing helper changes a profile's label when a period
subset removes a duplicate title or adds a colliding six-character suffix.
Expected: the same source profile retains its displayed identity as the result
set changes. Actual, deterministic synthetic fixture on the starting SHA:
`М’ясторія` alone becomes `М’ясторія · ID locations/synthetic-111123456`
when another equivalent title with the same suffix appears.

Every profile now retains its source title (or explicit generic missing-title
label) plus the **full raw source ID**. Even a unique title keeps the ID, so
filtering does not change its identity. No ordinal, shortened suffix, generated
identity or guessed street is used. Missing/repeated IDs retain explicit
warnings; their existing raw React key limitation remains. Table and top-intent
card share the helper. An explicit `Адреса не підтверджена` note accompanies the
identity; the top card exposes it in its accessible label. Scoped CSS wraps long
IDs within the table cell and intent card; the existing table scroll remains.
Raw keys, normalization, metric calculations, sorting, null/zero, source counts,
coverage, date window, cache and RPC calls are unchanged.

## Safe source evidence and limits

| Identifier or address | Evidence | What is established |
| --- | --- | --- |
| `location_id`, `location_title` | `supabase/migrations/20261023133005_digital_correctness_rpc.sql`, `bi_digital_local_payload`, location aggregation | Checked-in RPC emits source ID/title, grouped by both; no address field. Installed current payload was not fetched. |
| `locationId`, `locationTitle` | `web/lib/data/digital-source-contract.ts`, `normalizeLocal` | Direct mappings from those RPC fields. No ID/address crosswalk is consumed. |
| Loader | `web/lib/data/digital-sources.ts`, `localCache` | Calls `bi_digital_local_payload`; no period arguments or additional identity lookup. |
| Verified streets / store ownership | Repository search and historical D26 evidence | No verified GBP-ID-to-address mapping located. Sales location dimensions cannot establish this crosswalk. No street is displayed. |
| Four duplicated source names | Supplied D284 trigger and historical D26 report | Relayed observation only; not a fresh live read. All IDs/addresses in tests are synthetic. |

No authorized authenticated session was supplied or accessed. No actual current
GBP payload, address, ownership or four-profile coverage is certified here.
Unique recognizable titles remain readable with a stable ID appended. Address
fallback is deliberately not implemented without independently verified data.
Tests reject unsupported address fields, including equal synthetic addresses;
same-address profiles retain separate IDs. A verified-address path requires a
future read-only crosswalk and its provenance before implementation.

## Verification

- `npm ci --prefix web`: PASS, 71 packages installed.
- Focused direct test execution: **25 PASS / 0 FAIL / 0 SKIP**, helper plus actual
  page synthetic SSR; covers duplicate/blank/unique titles, suffix/account-path
  collisions, missing/repeated IDs, subset/reordering stability, unsupported and
  same-address fields, long IDs, accessible labels, unchanged metrics and inputs.
- Four new behavior assertions against exact starting helper: **0 PASS / 4 FAIL**;
  revised helper: **4 PASS / 0 FAIL**, no skips. No live network or database.
- Initial workspace `npm run check`: **47 PASS / 11 FAIL / 0 SKIP** test files
  (58 total). Three runtime-writing files hit the read-only `.agents` mount;
  inventory reproducibility failed before regeneration (now refreshed); seven
  native Sales PostgreSQL files failed. TypeScript/build were not reached.
- Disposable copy `npm run check`: **51 PASS / 7 FAIL / 0 SKIP** test files
  (58 total). Inventory and all three runtime-writing files now pass; the same
  seven native Sales PostgreSQL files fail. All 377 tracked source files were
  byte-verified before execution; dependencies linked to the clean install.
  TypeScript/build were not reached. This is inner sandbox evidence, never a
  trusted OUTER acceptance substitute. Final documentation was added afterward;
  executable source and generated inventory remained byte-identical.
- Native PostgreSQL 16.15 binaries exist. Direct atomic test: **1 PASS / 1 FAIL /
  0 SKIP**; failure is `listen EPERM: operation not permitted 127.0.0.1` before
  disposable server startup. PostgreSQL 17 is absent. No hosted DB was invoked.
- Standalone TypeScript `--noEmit`: PASS.
- Direct optimized Next build: PASS, including Next's type/lint validation.
  This does not bypass or replace the mandatory full-check acceptance gate.
- Audit-contract regressions: **10 PASS / 0 FAIL / 0 SKIP**.
- Inventory regeneration/reproducibility: PASS; 22 pages, 7 API routes,
  758 static visual/control templates. Runtime parity remains UNKNOWN.
- Mobile browser attempt used only synthetic actual-page SSR at a local file
  URL, 390×844, with network resolution disabled. Chromium exited 134 before
  rendering: Crashpad `setsockopt: Operation not permitted`. No screenshot or
  viewport pass exists. CSS/SSR regression passes; desktop/mobile authenticated
  Preview acceptance and all 66 historical browser cases remain NOT_EXECUTED.
- `git diff --check`: PASS.

## Changed paths

- `web/lib/gbp-location-labels.ts`
- `web/app/digital/local/page.tsx`
- `web/app/globals.css`
- `web/tests/gbp-location-labels.test.mjs`
- `docs/audit/2026-10-24/inventory.json`
- `docs/audit/2026-10-24/tab-block-matrix.csv`
- `docs/audit/2026-10-24/HANDOFF.md`
- `docs/audit/2026-10-24/GBP-D284-IDENTITY-2026-11-10.md`
- `docs/PROJECT-STATUS.md`
- `docs/BI-DATA-AUDIT-2026-10-24.md`

## Handoff and gates

Code is prepared for same-PR review; **verification BLOCKED in the inner
sandbox**, not READY FOR RELEASE or proof of full audit completion. The trusted
runner must establish native OUTER PostgreSQL 16+17 checks, exact-new-SHA CI and
Preview acceptance separately, attach its actual committed SHA and paths to
existing PR #44, and publish WORKING/READY FOR REVIEW as appropriate. No new PR.
Real source identity acceptance needs the legitimate existing authenticated
session or safe read-only RPC evidence; do not request new secrets or invent
addresses. Broader issue #43 audit remains INCOMPLETE.

No Sales/auth/recovery change, hosted-401 retry, production/main deployment,
production SQL change/application, credential/provider/scheduler/import, upstream profile
mutation, business write or merge. SU-545195 remains HOLD. All owner gates and
production fail-closed paths remain intact; no next backlog task was started.

## D285 independent trusted-OUTER verification and CI trigger finding (2026-11-10 UTC)

This paragraph supersedes the *pre-commit* candidate and verification status
in the D284 inner-sandbox handoff above. A separate independent reviewer read
the trusted OUTER job `130097258421` in
[Astra Actions #42892583888](https://github.com/adduakiev/mystoriya-bi/actions/runs/42892583888):
actual PostgreSQL **16.15**, **642/642 PASS, 0 fail, 0 skip**; optimized Next
build and diff check PASS. The outer runner **committed and pushed** the
D284 candidate as `9b6eae101e5e36104a3b31a6179428663fa45029`
at 2026-11-10 20:18:51–52 UTC. Old-to-new compare: exactly **one commit,
ten files**, scoped to GBP identity, generated inventories and documentation.
The inner report's no-commit language described only the earlier Codex
workspace and does not override the outer push.

Exact D284-head Vercel Preview
[READY](https://vercel.com/adduakiev-9572s-projects/mystoriya-bi/HiwhwF1T9UBhsxsHJJUTaBRWpyX1),
branch and SHA matched, `target=null` (not Production). The essential
**exact-new-head GitHub PG17 verification was not present** in the workflow-run
collection at this review; the older dual-PG 639/639 applies to an older SHA,
not D284. Root cause: the Astra workflow pushes using `${{ github.token }}`
while `sales-pr44-native.yml` listens only for `push`; GitHub explicitly
suppresses downstream push workflow runs caused by its own `GITHUB_TOKEN`.
[GitHub trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
The separate PR-only evidence-receipt update containing this section is
intended to obtain a normally triggered **exact-current-SHA** native CI
verification via the connected GitHub App write, without modifying any
test/production code. This is a gate attempt, not CI acceptance; independently
inspect whether a new run is created and its trusted PG16+PG17 logs. If no run
appears, diagnose rather than claim success. No duplicate Astra cycle,
production action, importer, server request or credentials were used.

See [independent PR D285 adjudication](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6779665474)
and [Control Room D285 receipt](https://github.com/adduakiev/mystoriya-bi/issues/6#issuecomment-6779671764).
Real GBP address crosswalk, 66-case authenticated browser QA, source-to-UI
parity, and hosted Sales auth still remain unverified. NOT RELEASED.
