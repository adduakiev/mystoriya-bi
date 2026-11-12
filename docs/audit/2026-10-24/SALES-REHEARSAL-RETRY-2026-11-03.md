# Issue #43 / existing PR #44 — offline synthetic rehearsal retry

WORKING acknowledged in the implementation transcript. **PREPARE ONLY; BLOCKED
on trusted outer native acceptance. Production NOT READY FOR GATE. SQL NOT
APPLIED to staging or production.** No commit/push or new resulting SHA exists.

Clean starting checkout and unchanged local HEAD:
`b4ee5a9520b9b3c5110c01c77184f2d74f0e67f1`, branch
`astra/issue-43-40107435112`. No parallel agent or other engineering workstream.
PR #44's remote open/unmerged state and remote branch/SHA have **not** been
independently verified inside this restricted sandbox. The trusted outer runner
must do that and stop on drift; local socket/DNS restrictions are not drift.

## Reconstruction boundary

The supplied trigger describes failed outer [41713981173](https://github.com/adduakiev/mystoriya-bi/actions/runs/41713981173),
**575 total / 567 PASS / 8 FAIL / 0 SKIP**, and forensic
[D209](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6615506130).
Those are trigger-supplied evidence, not new GitHub observations here. The last
uncommitted rehearsal files and prior handoff are absent in this clean checkout.
This is a **bounded new reconstruction** from pinned sources and the supplied
failure classification, not a recovered or byte-identical candidate.

The accepted immutable base [41713058100](https://github.com/adduakiev/mystoriya-bi/actions/runs/41713058100),
**564/564 PASS**, is historical base evidence only. Neither its result nor the
failed candidate's test count applies to this reconstruction. Record the new
outer test count from its actual run, without assuming either historical total.

Only three new implementation files and this directory's review evidence are
prepared:

- `docs/sql/issue-43-sales-rehearsal-NOT-APPLIED.sql`;
- `web/tests/sales-rehearsal-postgres.test.mjs`;
- `web/tests/fixtures/sales-rehearsal-catalog.mjs`.

Every existing tracked file stays byte-for-byte unchanged, including atomic,
accepted-source, role-hardening and base attestor SQL; deployed/runtime SQL,
Edge/API, OAuth/capture/provenance/transport code, runner/branch checks,
`AGENTS.md`, inventory and historical audit evidence. No real trust root is
created. No existing public function is replaced, renamed or granted to the
rehearsal caller. No legacy batch/finalize import is executed.

## Prepared fixes and mandatory native assertions

These are **implemented assertions awaiting native outer execution**, not passes.

| Supplied failure | Scoped retry / required evidence |
| --- | --- |
| Direct legacy EXECUTE returned `42501`, not inner `55000` | Separate tests: actual narrow caller/reviewer LOGINs get `42501`; fixture administrator uses the already-authorized `service_role` principal to reach rejection-only public bodies and require exact `55000 / SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE`. No grant to the caller, including temporary legacy grants. Missing private authority separately requires `55000`. Compare all rows, catalog, ACLs and sequences. |
| Forged ALWAYS identity INSERT stopped at `428C9` | Use an actual writable `revenue` UPDATE on two existing fact rows. It must fail with native `42501`. In a rollback-only administrative control, grant only SELECT/column UPDATE and a fixture RLS policy; the SAME DML must actually update two rows. The SAME denial parser must reject that successful bypass. Rollback restores rows/hash/ACL/policies/sequence state; rerun the denial. |
| PL/pgSQL `x` ambiguity | Private function uses `v_` variables, qualified record/column references, distinct SQL aliases, and `#variable_conflict error`. Positive commit must execute all expressions, not merely install the function. |
| Stale/concurrent test exited 0 | Check generation under its row lock BEFORE any prior-success shortcut; this rehearsal deliberately rejects every replay, including committed runs. An administrative rendezvous holds that row until TWO real caller backends report PostgreSQL Lock waits. Different-run and same-run races must each yield exactly one native success and one exact stale-generation `55000`, one increment, one successful run, two facts, unchanged canonical rows/receipts, then exact no-change denials on replay. No expectation changed to accept duplicate success. |
| Restore failed refreshing an RLS-protected monthly MV | Fixture MVs have a separate nonsuperuser SELECT-policy owner. Native default single-transaction restore must reproduce the RLS refresh error and roll back to the exact empty restore baseline. Retry on that clean database with native `pg_restore --enable-row-security --exit-on-error --single-transaction`. Keep all RLS flags, SELECT policies, original owners, immutable guards and effective ACLs. No `--no-owner`, BYPASSRLS grant, trigger disabling, policy removal, skip or fallback. Full source-stop parity is mandatory. This option and reproduction remain UNVERIFIED here. |

The draft installs only into the fixed disposable `sales_attestor_synthetic`
database under its fixed synthetic administrator. It requires the existing
rejection overlay and creates an **empty** immutable/RLS authority table. The
fixture alone provisions a clearly labelled `OFFLINE_SYNTHETIC_ONLY` prior
reference, exact target/manifest/staging payload and authority. Caller JSON or
receipts cannot provision that authority. This is not a production root,
authenticator, credential path or installable Sales cutover.

Two separately invoked in-memory mock captures exercise the unchanged real
capture/derivation modules with ephemeral synthetic RSA material and an explicit
non-network fetch dependency. Each positive reviewer independently derives and
checks source, manifest, exact cents/identity/date and full alias mapping before
its own actual SCRAM LOGIN review. Fixture passwords are ephemeral and never
printed, passed as CLI arguments or saved in evidence. Wrong passwords must fail;
the configured first local HBA rule must be SCRAM. No real Google credential or
source is read, created or probed, and no auth token/body is logged.

Authority provisioning preserves prepared monetary JSON text without Number parsing;
the positive native witness includes `90071992547409.91` and must match every cent.
The private fixture commit consumes frozen staged batches, exact fixture
policy and two immutable independently identified receipts. It rechecks
manifest, generation, complete alias resolution, canonical tuples and their
compact JSON digests, plus every existing historical identity before UPDATE /
INSERT. It refreshes all three MVs and records the synthetic result in the same
transaction. There is **no fact DELETE**, public promotion opening, real
`accepted_source_v1`, legacy batch/finalize call or manual refresh path. This
private synthetic SQL does not replace or certify the existing atomic/runtime
implementation or lifecycle/LFL behavior.

The native suite must additionally show:

- HTTP/auth 401, partial and oversized responses do not change any database
  state; a changed second capture cannot add its receipt or promote;
- forged review fields, absent authority, prior/root mismatch, canonical identity,
  alias/mapping drift, manifest mismatch, staging mismatch and lost historical
  keys fail closed, with per-attempt complete state comparisons;
- failures and cancellation **after** changed facts/MVs/run status, and an inserted
  dimension / changed dimension metadata, roll back. The injected trigger checks
  those writes were actually reached. These probes update existing fact IDs so
  no nontransactional identity allocation obscures exact sequence comparisons;
- an actual successful rollback-only private promotion is rejected by the same
  failure assertion, and rollback restores the full baseline;
- native custom-format dump, source shutdown **before** restore into a second
  cluster, exact counts and SHA-256 multisets for every table/view/MV/sequence,
  portable definitions, owners, roles/memberships, policies, immutable triggers,
  schema/table/column/sequence/function effective privileges (including grant
  options), and sequence logical state all match. Restored receipt readback,
  immutable denials, stale denials and both closed public boundaries run again.

## Actual restricted-inner checks

| Command/check | Observed result |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages, lockfile unchanged |
| `npm run check` | FAIL: **52 file-level tests / 44 PASS / 8 FAIL / 0 SKIP**; TS/build stages not reached. These are local file-level totals, not outer native subtest totals. |
| Five focused Sales PostgreSQL files with `--experimental-strip-types --test --test-isolation=none` | **9 tests / 4 PASS / 5 FAIL / 0 SKIP**. Atomic loopback listener gets `EPERM`; attestor, backup, role-hardening and new rehearsal cannot bind Unix sockets. |
| New rehearsal alone, `node --test --test-isolation=none web/tests/sales-rehearsal-postgres.test.mjs` | **2 tests / 1 PASS / 1 FAIL / 0 SKIP**. Static boundary passes; native parent fails at server startup before any of the eight native subtests. |
| Other three failed files, focused with strip-types/isolation none | **31 tests / 28 PASS / 3 FAIL / 0 SKIP**. `.agents/run.test.mjs`, `operating-tasks.test.mjs`, and `operating-v2.test.mjs` cannot create `.agents/runtime` in this sandbox's read-only `.agents` tree (`ENOENT`). No unrelated file or test was changed. |
| `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS |
| `cd web && node node_modules/next/dist/bin/next build` | PASS; optimized Next 15.5.27 production build |
| Four audit generators with `--check` | PASS: inventory 22 pages / 7 API routes / 758 static templates; 6 contracts; 35 diagnostics; 66 browser cases. Production parity UNKNOWN and browser cases NOT_EXECUTED. |
| New JS syntax, existing tracked-file preservation, new-file whitespace and `git diff --check` | PASS |

Reproducible native blocker: PostgreSQL **16.15** starts, then logs
`could not bind Unix address .../.s.PGSQL.5432: Operation not permitted` and
`FATAL: could not create any Unix-domain sockets`. The harness reports failure,
never skips or substitutes a mock/single-user backend. This is not proof of any
SCRAM, concurrency, RLS, dump/restore or positive-promotion assertion.

A separate temporary, uncommitted single-user PostgreSQL 16.15 diagnostic
successfully installed the draft, exercised the private body with synthetic
inputs, compared canonical joined rows and checked review-required/stale errors;
the portable catalog query also parsed/executed. This is **SQL-body diagnosis
only**: administrative session authorization in that diagnostic is not LOGIN
authentication, and standalone mode cannot establish native RLS or restore
behavior. An attempted supplemental RLS-off negative probe did not reproduce the
server-mode RLS failure; it is NOT positive RLS evidence. No such diagnostic is
wired into the committed suite, counted as native acceptance, or offered as a
fallback. Temporary inputs/logs/database files remain outside the repository.

## Outer handoff and remaining STOP gates

Status is **BLOCKED**, not READY FOR REVIEW / READY FOR GATE. The restricted
inner engineer cannot execute the mandatory trusted OUTER PostgreSQL 16.15 gate.
This candidate is uncommitted and unaccepted; any new native failure must be
reported verbatim and STOP publication rather than relaxed or skipped.

The trusted runner must independently confirm PR #44 remains open/unmerged on
the requested branch and expected base SHA, run `npm ci --prefix web`, FULL
`npm run check` with **0 FAIL / 0 SKIP**, all four generators `--check` and
`git diff --check`, verify the scoped file list and protected bytes, then handle
any permitted non-force handoff to the SAME PR. No Codex commit/push is authorized.
Record actual full commands, test totals, exact resulting SHA and an independent
post-push exact-SHA recheck; all remain outstanding. No remote drift assertion
has been made from sandbox restrictions.

Production gates remain CLOSED: independently approved authentic historical
source/root and real reviewer policy; private source credential/probe and source
closure; owner-approved production backup/restore; writer quiescence; reviewed
SQL/RLS/grants plus coordinated SQL/Edge release; complete source → warehouse →
RPC → authenticated UI parity. Google Sheet stays private and manual `Оновити`
stays prohibited. No staging/production migration, Edge deploy, trigger/import,
credential operation, scheduler, Ads/SYRVE/business write, PR creation/merge or
GitHub settings change occurred. All other BI tasks remain queued/read-only.

## Trusted outer-runner reconciliation — 2026-11-03 21:38 UTC (PREPARE ONLY)

This appendix records **independent post-handoff GitHub verification**; the original preceding text and JSON evidence above are the *restricted inner sandbox's narrower observations*, not the final trusted runner outcome. Do not overwrite or misinterpret the inner EPERM notes as native failures.

- Trusted GitHub Actions [Astra run 41719386978](https://github.com/adduakiev/mystoriya-bi/actions/runs/41719386978), job `126207814859`, finished **SUCCESS**. In its final native outer `npm run check`, **574 tests: 574 PASS, 0 FAIL, 0 SKIP** on PostgreSQL **16.15**, plus TypeScript, optimized Next build, generators and `git diff --check`.
- Native rehearsal subtests passed, including two independently captured observations, SCRAM LOGIN review receipts, exact-cent/readback, ACL/RLS positive-and-negative controls, 401/partial/oversized/change/forgery no-write controls, generation-lock concurrent stale replays, fault rollback and source-stop dump/restore across isolated clusters. All tests used **synthetic/disposable data**; no real source or production was contacted.
- Trusted outer runner pushed exactly five scoped new rehearsal/test/audit files to the **same** existing PR #44 in non-forced commit `a31444e093645e78ad6b5c54e19f6614d19b1087`. Independent GitHub PR metadata confirmed this exact HEAD, OPEN/unmerged, and compare `b4ee5a95..a31444e` one commit ahead / zero behind with those five files only. No second PR, SQL deployment, import, key creation or source probe.
- **Outstanding independent gate:** the above 574/574 was measured by the runner before its commit/push. A distinct **post-push native CI on the exact immutable HEAD** has not yet been observed; Vercel SUCCESS alone does not establish PostgreSQL acceptance. This documentation-only reconciliation commit is intended to trigger the existing read-only `sales-pr44-native.yml` push workflow. Require its exact `GITHUB_SHA`, 0 FAIL/0 SKIP, PostgreSQL 16, native backup/rollback, and a fresh HEAD check before closing the gate.
- The private-source historical trust root, real Sheets server credential, source cutoff, Production backup/rollback readiness, compatible coordinated SQL/Edge cutover, and actual authenticated source → warehouse → RPC → UI parity **remain unverified**. The manual `Оновити` is an unsafe production import trigger and must not be used. **NOT READY FOR GATE / NOT RELEASED.**
