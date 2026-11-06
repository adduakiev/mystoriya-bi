# Atomic sales import preparation — #43 / existing PR #44

PREPARED / NOT APPLIED. Production import remains prohibited until separate gates.
Baseline: `f97b975a4c826906bfbbd785d2ce5391bb6923cc`.
Owner approved the Secrets design and continued code/test work; no credential,
production, migration, permission or scheduler action was approved or performed.

## Confirmed risk and design

2026-10-31 SELECT-only inspection of project `rxewpevxqtfmksybykvo` retrieved current
`sync_sales_batch`, `finalize_sales_snapshot`, `refresh_bi_aggregates` definitions and
`import_runs`/`fact_sales_daily` column contracts. Legacy batch RPC writes facts directly;
finalize deletes every fact with a different run ID. Separate calls are not atomic.
Refresh currently includes `bi_sales_flat_mv`, `agg_sales_monthly`, `agg_sales_weekly`.
Tests include all three with repository-backed aggregate shapes and the inspected refresh
chain, not merely totals in a mock table. Exact deployed view-definition parity is not
claimed. No production function invoked.

The candidate is `docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql`, outside migrations.
It ends with ROLLBACK. Only the disposable fixture commits its own copy.
No existing SQL/migration, Edge entrypoint, source reader, cron or UI is changed.

1. `begin_sales_snapshot_v2(manifest)` creates a run and captures the current warehouse
   generation. The manifest fixes aggregated row count, raw row count, batch count,
   exact decimal totals and date bounds. Metadata is not a live business snapshot.
2. `stage_sales_batch_v2(run,batch,rows)` stores private immutable numbered batches,
   validates every field before fixed-precision casts, and enforces exact expected
   batch length. An identical retry succeeds; a changed replay is rejected. Staging
   never changes dimensions, facts or aggregate views. Missing metrics never become zero.
3. `commit_sales_snapshot_v2(run)` locks generation then run, checks expiry, generation,
   complete batch manifest, totals, date coverage, historical shrink and canonical
   duplicate keys. Mapping/lifecycle rows are protected with table locks during merge.
   It calls the existing warehouse transformation once with the complete validated
   payload, then deletes obsolete rows and refreshes all aggregates in the SAME transaction.
   It verifies final warehouse totals/counts/dates before recording success and advancing
   generation. Any error/cancellation rolls back facts, dimensions, deletion, MVs and status.
4. A successful retry returns its stored receipt without mutation. Two runs begun against
   the same generation cannot both promote: the later one fails STALE_GENERATION.
   Refetch/revalidate the source and begin a new run; never retry by changing its generation.

The complete payload call avoids cross-batch alias overwrites and per-batch location
attribute ordering. Canonical duplicates are rejected, not silently merged. Existing
mapping/brand semantics still need business review; atomicity does not certify source truth.

## Privileges and operational boundaries

Staging/state live in `bi_import_private`, have RLS enabled, no policies and no direct API-role
access, including service_role. Only three public SECURITY DEFINER wrappers are granted to
service_role; PUBLIC, anon and authenticated EXECUTE are revoked. Search paths are explicit
and references qualified. These narrow privileged wrappers are necessary to prevent API
clients from changing staging/generation or independently calling the legacy write chain.
The trusted owner of the wrappers and legacy helpers must be identical and privileged;
ownership, grants and installed helper definitions require an exact pre-cutover audit.

The candidate revokes service_role EXECUTE on BOTH legacy mutators. That is mandatory:
otherwise old clients could still partially write or delete outside the new transaction.
In Production this is a permission change requiring explicit approval. The current Edge
function would fail closed after such a cutover; it is intentionally not wired here.
Direct superuser/service-role table writes are not made safe by this protocol.

Run expiry is two hours, input capped at 200000 rows, batches at 2000 rows/4 MiB each.
Failed/expired staging remains for review. No cleanup job is introduced. A later explicit
retention policy must remove only terminal/expired private staging, never live facts or
recent active runs. A cancelled promotion retains staging and RUNNING metadata, not SUCCESS.
Operational failure marking and progress display remain part of future Edge integration.

MV refresh can block readers until commit. Ordinary fact readers observe a complete old
or new transaction snapshot; multiple independent HTTP reads can span a commit and are
not guaranteed one shared generation. Hosted statement/runtime/memory limits still need
authorized capacity validation. Authentication and atomicity are separate gates.

## Verification and reproduction

Use Node >=22.13 and local PostgreSQL 17 binaries:

```text
SALES_TEST_PG_BIN=<local PostgreSQL bin directory>
node --test web/tests/sales-atomic-postgres.test.mjs
```

Set the environment variable using the local shell's syntax. The test NEVER reads a
DATABASE_URL or reuses an existing server. It creates a new temporary cluster with synthetic
data, binds to loopback on a free port, checks its data directory, and stops it in finally.
`initdb --no-sync` is used only for disposable fixture initialization. No Windows service
or scheduler is installed. Missing binaries produce an explicit skip, not an atomicity pass.
Existing unrelated PostgreSQL tests retain their own prerequisites and skips.

Tests cover denied grants, missing batches, replay conflicts, bad/null/fractional metrics,
canonical collisions, wrong totals, rollback after replacement and MV refresh, retry,
concurrent promotion with an uncommitted reader observation, expiry, cutoff regression,
backend cancellation, two-batch promotion, historical shrink, and 47000 synthetic rows
across 24 batches with reconciliation against all three materialized views.

At implementation/test SHA `f728a9f6ec49f97625d40899ecd45af90a3ce002`, full `npm run check`
executed 405 tests: **396 PASS / 7 FAIL / 2 SKIP**. All **13 atomic-suite tests passed**,
including 47000-row promotion (13.329 seconds locally), exact fact/flat/monthly/weekly
reconciliation, rollback after status failure, cancellation and concurrency. This is a local
synthetic timing, not a hosted SLA. The temporary server was stopped after testing.
The source tree was clean and `git diff --check` passed. The earlier exact Git archive
contains identical SQL design; the subsequent test-only change raises Windows initdb's
timeout from 60 to 180 seconds. Initial 60-second initdb and parent-test timeouts are failed
attempts, not successes; the final run has zero cancellations.

Prior verified baseline: 392 tests / 383 PASS / same seven FAIL / same two SKIP. The
13 added tests all pass with no new functional failure. Existing failures are stale
lineage/inventory/QA artifacts, two historical receipt-link assertions and two prepared-SQL
static assertions. Neither those tests nor artifacts were changed. Other PostgreSQL tests
still skip on their separate Linux-specific prerequisites. Combined check remains NOT PASS.
`npm ci --prefix web` completed from unchanged lockfile (existing one high/one critical
dependency advisory). Final remote SHA, separate TypeScript/build and log checksums are
recorded in the PR handoff comment. Do not claim a green release gate.

## Next gates / owner action

No owner action is needed to review this code/test preparation. Before activation:

- independent review of transaction/security design and exact-SHA test evidence;
- resolve existing repository check failures; verify hosted capacity, helper definitions,
  ownership, role grants and all snapshot writers;
- separately approve and prepare coordinated maintenance cutover: prevent old in-flight
  jobs, apply reviewed atomic protection, deploy the compatible Edge adapter, then perform
  bounded validation. No attempt to change existing jobs is included here;
- provision the previously approved Secrets design only after separate key/secret approval;
  retain a no-write authorization probe before any import;
- owner approves exact Production changes and first protected import separately.

Rollback should leave imports disabled and preserve the last accepted snapshot. Do NOT
restore legacy mutator grants merely to make imports run again. An operational rollback
script and exact cutover checklist require the installed-state review at that later gate.

Reference: [PostgreSQL 17 transaction/table/row locking](https://www.postgresql.org/docs/17/explicit-locking.html).
