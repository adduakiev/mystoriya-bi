# Issue #43 / PR #44 — synthetic restore and rollback readiness

PREPARE ONLY. NOT READY FOR GATE. Production backup/restore NOT PERFORMED.
WORKING acknowledged in the implementation transcript. The locally verified
clean starting branch is `astra/issue-43-40107435112`, HEAD
`b265cb32e7715461a26eb92db04c13658b811800`. No remote ref comparison was made.
The trigger supplies [Actions 41573963730](https://github.com/adduakiev/mystoriya-bi/actions/runs/41573963730)
as prior-base evidence (517 tests, no failures/skips); this is not verification
of the new candidate. The runner must publish the exact resulting SHA on the
same PR #44 after its checks. Codex creates no commit or resulting SHA.

## Bounded native rehearsal contract

[sales-backup-restore-postgres.test.mjs](../../../web/tests/sales-backup-restore-postgres.test.mjs)
is one native test, automatically collected by `scripts/test.mjs`. Missing local
`initdb`, `pg_ctl`, `psql`, `pg_dump` or `pg_restore` fails, with no skip or mock
fallback. It uses two fresh data directories and separate Unix socket directories
under one `mkdtemp`, disables TCP, explicitly pins every client to that socket,
checks the server's actual data directory, and passes a minimal environment.
Neither `DATABASE_URL`, inherited PG connection settings, a remote connection,
production snapshot nor Google/Supabase source bytes are used. Temporary files
contain synthetic data only and are removed after servers stop.

The fixture follows the existing atomic harness: warehouse Sales schema and
runtime prefix, lifecycle table, flat-cache MV shape, repository three-MV refresh
definition, then the original rollback-default atomic draft committed **only in
the disposable cluster**. It prepares 120 generated raw rows across 2024–2026,
including repeated raw keys, a mapped alias, lifecycle exclusions, historical and
current fact brands for the same location, null fields, exact cents larger than
JavaScript's integer range, and negative markup. It includes successful, running
and failed import metadata/details, nonempty raw staging and quality issues,
committed and staging private runs/batches, and generation. It does not create
`accepted_source_v1`, a receipt, attestor or trust root.

Before backup it commits the rejection-only accepted-source overlay in that
disposable cluster. Both commit routes must reject with the exact gate error;
legacy RPC EXECUTE and private schema access must remain denied to service-role,
and public commit EXECUTE must remain denied. This models the candidate's closed
state, not production installation. Both SQL draft files remain unchanged and
NOT APPLIED, outside migrations.

The test writes a native custom-format `pg_dump`, stops the source cluster,
initializes a separate target, provisions only the same credential-free fixture
roles (database dumps do not include cluster roles), and runs `pg_restore` with
ownership/ACLs, exit-on-error and a single transaction. It does not use
`--no-owner` or `--no-acl` to conceal missing roles/grants.

Required assertions, **not local restore results until the native test passes**:

| Proof | Required parity/evidence |
| --- | --- |
| All fixture data | Discover every public/private table, ordinary view, materialized view and sequence; exact count and SHA-256 of canonically ordered per-row SHA-256 hashes; duplicates and nulls retained; client output bounded |
| Nonempty coverage | Facts, all six dimensions, import history, mappings, lifecycle, raw staging, quality issues, private runs/batches/generation must contain evidence; exactly three MVs |
| Sequence state | `last_value` and `is_called` plus sequence definitions; excludes physical WAL `log_cnt`, which logical dumps do not preserve |
| Portable schema | SHA-256 of ordered definitions: columns/defaults/identity, owners, effective ACLs, RLS/force-RLS/policies, functions/security modes, schemas, constraints, indexes, views/MVs and sequences; no OID or dump-order comparison |
| Historical identity | Hash of complete date/location/fact-brand/ownership/channel-group/channel-name/order-type and exact cents/checks; same location must retain two historical fact brands |
| Exact totals | Facts, ordinary flat view, flat MV, weekly and monthly MVs must each have synthetic revenue `90071992547421.81`, checks `120.00`, markup `-3.60`; date bounds `2024-10-01..2026-10-30`; generation `1` |
| Restored closure | Recheck old/new commit rejection and legacy/private/public privilege boundaries after restore and after each rollback probe |
| Failed mutation | Owner-only synthetic transaction updates facts, location, mapping/lifecycle, imports/details, raw staging, private runs/batches/generation and refreshes all MVs, then raises a specific error; full baseline must return |
| Cancelled mutation | Same mutation completes before PostgreSQL statement timeout cancels a sleep with SQLSTATE `57014`; psql must exit on that error and disconnect/rollback, then full baseline must return |

Mutation probes use UPDATE rather than allocating new sequence values:
PostgreSQL sequence increments are not transactionally rolled back. The existing
native atomic test separately covers real promotion cancellation/concurrency and
47k rows; this focused restore fixture does not replace or waive those checks.
Digests are consistency checks within this isolated test, not authenticated source
evidence or production backup authentication. It tests the Sales fixture subset,
not the complete Supabase platform, extensions, auth/storage or all migrations.

## Recovery distinctions

This is a **logical database backup/restore rehearsal**: SQL objects and data in
a native dump are recreated in a new cluster. Even a passing synthetic run says
nothing about whether a production backup exists, can be decrypted/read, has
complete roles/extensions/platform configuration, or meets production RPO/RTO.
Physical disaster recovery (base backup, WAL/PITR, infrastructure, external
secrets/storage/network dependencies and service recovery) is untested here.

Transaction rollback undoes one failed/cancelled transaction. Deployment/schema
rollback requires a separately reviewed inverse compatible with retained data,
permissions and evidence history; the drafts' default ROLLBACK is not that inverse.
A data restore may discard later accepted writes and requires an explicit loss
window and reconciliation decision. Re-enabling the old non-atomic writer is
never the fallback. No executable restore/cutover/migration script is added.

## Source-grounded Sales writer inventory (repository only)

These are inspectable definitions, **not assertions of current production grants**.
The trigger reports active deployed Edge v8 and unsafe legacy mutators; no live
database, deployed function, cron command, credential or grant was read here.

| Surface / repository evidence | Inspectable contract and future verification dependency |
| --- | --- |
| [Next POST](../../../web/app/api/data-sync/route.ts), [Edge entrypoint](../../../supabase/functions/sync-google-sheet/index.ts) | Both source handlers return unconditional 503 `SALES_IMPORT_SAFETY_GATE` before credentials/source/DB. Edge's unreachable old body contains direct import history updates plus batch/finalize calls. Source guard does not prove deployed v8 is guarded. |
| [Manual trigger migration](../../../supabase/migrations/20261012_dashboard_manual_sync.sql) | `bi_trigger_sync(text)` is SECURITY DEFINER and repository-granted to anon after password verification; executes an existing cron command. Must inventory that route and in-flight pg_net requests without executing it or revealing the command. Definition does not prove current cron activity. |
| [Warehouse runtime](../../../supabase/migrations/20261008_warehouse_runtime.sql) | `sync_sales_batch(jsonb,uuid)` mutates dimensions/facts; `finalize_sales_snapshot(uuid)` deletes stale facts and refreshes aggregates; `refresh_bi_aggregates()` refreshes caches. Repository grants service-role EXECUTE, denies public/anon/authenticated. These are unsafe legacy paths for recovery; never call against production. |
| [Flat cache migration](../../../supabase/migrations/20261009_performance_tuning_flat_cache.sql) | Refresh definition covers flat, monthly and weekly MVs. Backups, readback and rollback must cover all three; source role/ACL inspection is still required. |
| [Atomic draft](../../sql/issue-43-sales-atomic-NOT-APPLIED.sql) and [rejection overlay](../../sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql) | NOT APPLIED. Draft revokes legacy EXECUTE, reserves/stages privately, serializes generation; original commit is an ungated regression candidate. Overlay replaces that body and adds an evidence route that both reject unconditionally. Never install original alone; there is no authenticated success branch. |
| [Prepared transport](../../../supabase/functions/sync-google-sheet/prepared-sales-transport.mjs), [Sheets capture](../../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs) | Unwired adapters. They establish no deployed writer, Google authorization, protected database evidence producer or authentic historical artifact. |
| Direct REST/SQL, SECURITY DEFINER owners, role memberships, jobs and other clients | Repository definitions cannot establish all installed table/column/sequence grants, default privileges, role inheritance/BYPASSRLS or external writers. Require redacted, read-only installed catalog/client inventory before quiescence or release; service-role is not an attestor. |

## Read-only future cutover/rollback dependency checklist

This is a review checklist, not authorization or commands. Every production
action below needs its exact owner gate. Stop at any unmet prerequisite; no
automatic dispatch. Existing credentials, schedules and grants remain untouched.

| Order | Required future evidence and stop condition |
| --- | --- |
| 1. Read-only preflight | Pin approved SQL/Edge/Next SHAs, installed definitions/owners/effective grants/role memberships, writer clients and all trigger/job paths. Do not print secrets/cron commands. Resolve deployed v8 vs preview 503 mismatch. Current installed-grant inventory is missing: STOP before release work. |
| 2. Real backup and restore rehearsal | Owner must separately approve actual backup, private retention/access and isolated restore destination. Record snapshot time, consistent scope, tool/platform versions, roles/extensions/sequences, archive integrity, encryption/access evidence, restore results and bounded parity including all Sales dependencies, plus RPO/RTO. Neither synthetic test nor backup creation alone satisfies this. No production backup availability is proven: STOP. |
| 3. Writer quiescence and final checkpoint | Separately approved operators freeze all legacy/direct/manual/job/Edge writers and drain or cancel in-flight requests/transactions. Verify stable facts/imports/generation and no queued pg_net/cron deliveries using redacted evidence. Preserve a final consistent checkpoint under quiescence; a pre-freeze backup cannot silently stand in for it. Do not activate or change a scheduler here. |
| 4. Close legacy bypasses | Approved operator must revoke/deny legacy batch/finalize and unnecessary direct writes for actual callers, audit inherited/default grants and SECURITY DEFINER reachability/owners, and prove denial while all runtime 503 guards remain. A source-file REVOKE is not production proof; do not rely on hiding a UI button. |
| 5. Authenticated source/evidence | Require authentic historical October 30 source artifact and prior receipt/root, approved independent observer policy and authenticated DB channel, private retention and repeatable evidence-bound success/readback/cancellation tests. No warehouse/new Sheet reconstruction, caller JSON, synthetic root or first-run exception. All are unresolved here: STOP. |
| 6. Coordinated SQL + Edge release | Only a separately reviewed complete evidence-bound SQL implementation and matching server-only authenticated Sheets adapter may be deployed under exact owner approvals. Keep guards closed through compatibility/grant/version verification; no window exposing the original one-argument commit. Current overlay has no success branch and current adapters are unwired: STOP. |
| 7. Smoke and first import | First run read-only deployment/ACL/closure checks. A separate owner-approved first import then needs complete source/manifest/identity/exact-cent reconciliation, zero unexpected rejects, immutable evidence receipt/generation, all MV and UI readback, and retry/concurrency behavior. Ambiguous acknowledgement means stop and investigate read-only, never retry legacy writes. No import authorized here. |
| 8. Rollback decision | On privilege/evidence mismatch, missing history, unexpected totals, stale generation, partial publication or ambiguous commit, close writers/keep 503, preserve approved evidence and inspect read-only. Record the last accepted generation, scope of later writes and exact owner decision. Transaction failure should leave the accepted baseline; do not assume it did without readback. |
| 9. Approved recovery execution | Code rollback may restore the prior **guarded** handler only. SQL inverse or data restore requires its own reviewed compatibility, dependency/role/ACL and loss-window plan plus owner approval; never restore the unsafe deployed v8 writer or reopen legacy RPCs. Validate facts, all dimensions/mappings/lifecycle, imports/details, staging/private runs/generation, sequences, all three caches and authenticated receipt history. Physical DR needs a separate platform plan. |
| 10. Resume decision | After parity, evidence chain, denial tests and stable readback pass, owner explicitly decides any writer reopening and later scheduling. A restored stale pending run must not auto-promote; expiry/generation/evidence must be re-evaluated. No scheduler creation/activation or automatic follow-on belongs to this task. |

## Verification and handoff

| Check | Actual local result |
| --- | --- |
| `npm ci --prefix web` | PASS in workspace and isolated candidate; 71 packages; lockfile unchanged |
| Focused native restore test | FAIL, 0 PASS / 1 FAIL / 0 SKIP; PostgreSQL 16.15 cannot bind its fresh Unix socket: `Operation not permitted`, before backup/restore |
| Existing native atomic test, detailed reproduction | Static test PASS, server test FAIL / 0 SKIP: `listen EPERM 127.0.0.1`, before server startup |
| Temporary native single-user SQL validation | PASS for synthetic setup, guard rejection, all parity queries over 23 relations/sequences, exact totals; no sockets, dump or restore; NOT restore evidence |
| Workspace `npm run check` | FAIL: 42 test files PASS / 5 FAIL / 0 SKIP; protected `.agents/runtime` prevents three runtime test files, plus two socket-blocked server files |
| Final isolated `npm run check` | FAIL: 45 native test files PASS / 2 FAIL / 0 SKIP; only existing atomic and new restore server files fail; existing single-user 47k/accepted-source fixture PASS |
| TypeScript `--noEmit` | PASS independently in isolated candidate |
| Optimized Next production build | PASS independently in isolated candidate |
| Inventory `--check` | PASS: 22 pages, 7 API routes, 758 templates; production parity UNKNOWN |
| Test syntax / checklist source links / `git diff --check` | PASS |
| Production backup/restore, source/DB/GitHub/browser reads, imports or other external actions | NOT PERFORMED |

The isolated copy is an archive of the exact starting HEAD plus byte-identical
new code/tests and handoff docs under `/tmp/issue43-restore-check-u86kxv3d`.
Dependencies were installed there with native npm ci; no test command, skip,
workflow, runtime guard or socket workaround was changed. The full check stops
at its native test failure, so its own TS/build stages did not run; successful
independent TS/build runs are separate evidence. The temporary single-user
validation used the actual fixture setup/guard/parity SQL; it does not substitute
for the blocked native test. Final test-code hash and unchanged runtime guard/SQL
hashes are recorded in the [local receipt](sales-restore-verification-2026-11-03.json).
Only handoff documentation/receipt was finalized after the test snapshot.

**BLOCKED — local native restore verification**, reproducible with
`node --test --test-isolation=none web/tests/sales-backup-restore-postgres.test.mjs`.
This is a sandbox execution blocker, not an outer runner failure and not a
simulated restore PASS. The trusted runner must execute the new native test plus
existing 47k/concurrency/cancellation suite without failures/skips and report its
resulting exact PR SHA. No new SHA is asserted: HEAD remains the starting SHA,
and only the authorized workflow may commit/push to the same PR #44. Production
restore remains unperformed even if synthetic tests pass. Both runtime guards
remain unconditional 503; historical source/evidence gates are closed; no SQL,
credentials, grant, scheduler or production deployment was changed. Broader
BI/Digital/UX work stays outside this bounded revision. No automatic follow-on.
