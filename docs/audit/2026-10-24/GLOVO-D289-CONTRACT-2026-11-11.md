# D289 — Glovo column I contract correction, issue #43 / #48 / PR #44

Preview/offline code only; runtime integration and authenticated browser/data QA
remain BLOCKED. This narrow correction does not complete the wider BI audit.

## Authority and evidence boundary

WORKING recorded in commentary. Trusted outer preflight is authoritative for
PR #44 OPEN, branch and remote baseline. Local clean worktree, branch
`astra/issue-43-40107435112` and HEAD
`0ebf0ffe4d2d453103d34a125bb3492bd752640b` confirmed before changes.
Remote concurrency/drift, full native verification, commit/push and exact new SHA
belong to the trusted outer runner; no inner network/auth retry or GitHub write.
The supplied D289 trigger is the scope authority; linked issues and
[D288 independent acceptance](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6785580963)
were not separately fetched here. No prior result is claimed as this candidate's
exact-SHA acceptance.

The owner's already-authorized connected reader reports that the approved Glovo
Sheet's `Дані!A5:I5` headers match the prepared schema; month A is YYYY-MM,
F/G are typed numbers or blank/null, H is numeric, and I is native numeric 1/0
under `UNFORMATTED_VALUE`. `FORMATTED_VALUE` produces locale numeric strings.
This is owner-supplied source-shape evidence, not a BI runtime read or a local
source-parity measurement. No customer figures are copied into fixtures/docs.

## Discrepancy and correction

| ID / priority | Expected | Before / reproduction | Correction |
| --- | --- | --- | --- |
| G289-01 / P1 | Accept native 1/0 flags from the observed unformatted cell shape | On the pinned baseline, a synthetic otherwise-valid row with I=1 or I=0 returns ROW_CONTRACT_INVALID because the guard requires a boolean | Accept only booleans or exact native numeric 1/0; normalize to boolean |

`web/lib/data/glovo-contract.ts` changes only column I normalization/validation.
It rejects strings (including "1"/"0"), null/undefined, unexpected numbers and
other values; invalid rows still reject the whole dataset. F/G remain typed
numeric only. Missing/invalid measures remain null independently of I; true
measured zero remains zero. Column I remains metadata, not completeness proof.
Header/month/row/duplicate checks, Excel lineage, raw-brand/alias identity,
Jan–Oct defaults and partial-November coverage rules remain in force.
No additional source mismatch was established during this offline correction.

Focused synthetic regressions in `web/tests/glovo-contract.test.mjs` cover both
numeric flags and existing booleans, missing measures under either flag, measured
zeros, formatted numeric strings, unsupported flags, whole-dataset rejection,
extra columns, mismatched headers, duplicate keys and invalid months. Existing
alias/lineage and period tests remain. Fixtures copy observed types only.

## Verification and handoff gates

| Local check | Result |
| --- | --- |
| Clean pinned baseline replay from `git show HEAD:web/lib/data/glovo-contract.ts` using synthetic rows | Both I=1 and I=0 reproduce ROW_CONTRACT_INVALID |
| `npm ci --prefix web` | PASS; 71 packages installed |
| `node web/tests/glovo-contract.test.mjs` | PASS; 10 tests, zero fail/skip |
| `node web/tests/glovo-preview.test.mjs` after dependency installation | PASS; 4 tests, zero fail/skip; source/SSR/static checks only |
| `npm run check` | FAIL at test stage: 61 file-level tests, 51 pass / 10 fail / zero skips; this command does not reach TypeScript/build |
| `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS, independently |
| `cd web && node node_modules/next/dist/bin/next build` | PASS; optimized Next.js 15.5.27 build, independently |
| `node --experimental-strip-types web/tests/sales-role-hardening-postgres.test.mjs` diagnostic | FAIL; one static pass / one native failure; PG16.15 cannot bind a Unix socket, Operation not permitted |
| `git diff --check` | PASS |

The ten full-check failures are `.agents/run`, `operating-tasks`, `operating-v2`
and seven native Sales PostgreSQL suites (`atomic`, `attestor`, `backup-restore`,
`prewrite`, `rehearsal`, `release-v234`, `role-hardening`). The reporter directly
exposes protected `.agents/runtime/` mkdir ENOENT in operating-tasks; the direct
PG16 diagnostic exposes socket EPERM before native assertions. No sandbox
permission workaround, test exclusion or safety-gate weakening was attempted.
The first preview test attempt overlapped dependency installation and failed to
resolve `next/server`; the post-install rerun above passed all four tests.
These local failures do not override any actual trusted OUTER result; no new
outer result was available during this implementation. Logs remain in
`/tmp/d289-*`; no runtime artifacts are added to the repository.

`web/lib/data/glovo-source.ts` is unchanged and explicitly disconnected:
SOURCE UNAVAILABLE, null report, no provider request or fallback. No private
credentials/access, source/public sharing change, environment toggle, Sales
import/recovery change, SQL/Edge/live probe, migration, production write, login
bypass, schedule, paid service, ad change, deployment or merge is included.
SU-545195 remains on its separate HOLD.

Trusted outer actual PG16 full verification with zero failures/skips must precede
handoff to the same open PR #44. Independent exact-new-SHA PG16+PG17 CI and matching
Vercel Preview require separate adjudication. Runtime source reconciliation and
authenticated desktop/mobile browser QA remain blocked by the absent authorized
BI runtime source/access; offline contract/SSR checks cannot satisfy those gates.

## Independent trusted OUTER adjudication — 2026-11-11 UTC

- [Astra D289 run 42949175081](https://github.com/adduakiev/mystoriya-bi/actions/runs/42949175081), job `130289158249`, COMPLETED SUCCESS. Trusted OUTER native PostgreSQL **16.15, 660/660 PASS, 0 FAIL, 0 SKIP**; optimized Next.js build and TypeScript PASS. The outer runner then actually committed/pushed `3d726c732c2cbe6692daef03018cfe6118222acf` to the existing open/unmerged PR #44. Codex inner sandbox's 51/61 suite-level result and no-push wording are not outer results.
- Independent compare `0ebf0ffe4d2d453103d34a125bb3492bd752640b..3d726c732c2cbe6692daef03018cfe6118222acf` = **one commit / five paths**: Glovo contract, synthetic contract regressions, and three audit/status docs. No runtime source adapter or Production/DB/Sales handler changed.
- Authorized owner-connected Google Sheet **read-only** `Дані!A5:I8` with `UNFORMATTED_VALUE` independently confirms the exact nine expected headers, numeric F/G/H cells and numeric I=1 in sampled rows; this does not establish BI runtime private source authorization, full transformed-to-raw parity or any live refresh. No customer rows or values are copied here.
- [Exact code-head Vercel Preview](https://vercel.com/adduakiev-9572s-projects/mystoriya-bi/2d9LdbPbWcZfFWvoRCuWVpsNjrYh) **READY**, correct code SHA, `target=null`. No exact-head native PG17 CI was present at this checkpoint; the mandatory **dual-PG exact-SHA acceptance remains PENDING**. This documentation-only receipt is used to trigger independent GitHub native CI on the new head without changing executable code; assess its actual jobs and matching Preview before declaring OFFLINE ACCEPTED.
- Glovo runtime source remains **SOURCE UNAVAILABLE**. No authenticated actual Preview browser/data QA, private Sheet runtime credentials, Supabase SU-545195 resolution, SQL/import/Edge/secret change, merge, Production deployment or scheduler changes are claimed.
