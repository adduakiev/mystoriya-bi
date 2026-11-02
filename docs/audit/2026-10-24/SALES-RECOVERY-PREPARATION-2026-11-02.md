# Private Sheets → atomic Sales recovery preparation

Issue #43, existing PR #44, branch `astra/issue-43-40107435112` only.
Reviewed base: `74e85661d4ff9231238b73cd4268c851017fca0f`.
PREPARED ONLY / acceptance BLOCKED pending server/concurrency verification.
No production observation or action was performed in this continuation.

## Prepared contract and review

`supabase/functions/sync-google-sheet/prepared-sales-recovery.mjs` explicitly
calls the existing fixed-account private OAuth reader, then returns immutable
JSON request bodies for the three proposed atomic RPCs. It has no database client,
RPC sender, CLI, environment access, import-time work or production entrypoint.
The Next and Edge manual paths retain their unconditional 503 guard.
There is no public CSV fallback. Production auth and SQL remain disconnected.

Money is parsed and totalled as integer kopiykas with BigInt. JSON contains exact
numeric literals, including amounts beyond JavaScript's safe integer-cent range.
**Do not JSON.parse/restringify those bodies or pass them through a JS-number
Supabase RPC serializer.** A future approved sender must preserve the request
body bytes, use fixed RPC URLs and bind its run ID safely; it is not implemented.
The private reader also rejects monetary JSON numbers at or above 2^45 UAH,
where upstream double representation can collapse adjacent cents. Exact source
text is required at that magnitude. This cannot recover precision already lost
inside Sheets or certify formula/display precision.

The adapter requires a known previous accepted raw row count and warehouse date
bounds. It rejects any row-count shrink (stricter than legacy 5% tolerance), lost
date boundaries, empty/partial rows, unknown dimensions, duplicate normalized
source keys, sub-cent money, fractional/negative checks, invalid dates and today
or future dates in Europe/Kyiv. The source must reach yesterday in Kyiv; stale
cutoffs fail closed. There is no initial-load or date-closure override. Duplicate
source keys are not automatically aggregated: their business meaning needs source
contract review. Numbered bodies contain at most 2,000 rows/4 MiB, capped at 200,000
rows, matching the existing NOT APPLIED SQL contract.

Count/date checks cannot prove every source row is present. The unchanged atomic
SQL independently locks mapping/lifecycle/dimensions/facts and compares every
historical canonical key before promotion. Alias collisions fail in SQL. Existing
fact-level historical brand/channel identities, generation checks and all-or-nothing
fact/dimension/MV/status promotion remain mandatory. Source month/day closure,
mapping correctness and source→warehouse→RPC→UI parity still need approved evidence.
The caller must derive baseline metadata from authoritative records, never user input.

Review traced serialization through exact JSONB numeric casts, canonical-key
validation, old/new transaction visibility, receipt retries, and both manual guards.
No SQL design, migration, production permission, credential or scheduler changed.
Returned bodies contain confidential rows and must stay in server memory, never
logs, committed artifacts, browser responses, analytics or public storage.

## Verification receipt and limitations

The requested SHA was first exported with `git archive` into an isolated `/tmp`
directory. A detached worktree was unavailable because `.git` is read-only; no
branch was created or switched. An isolated candidate archive also permits tests
that need `.agents/runtime`, which is read-only in the managed workspace.

The unchanged base server test fails reproducibly at loopback `listen` with
`EPERM`; a Unix socket bind also returns `EPERM`. PostgreSQL 16 binaries exist,
and the non-root runner can execute actual PostgreSQL in single-user mode.
The server/concurrency suite stays enabled and failing here, never skipped or
rewritten to declare success. Single-user tests complement it; they cannot prove
two-session locking, cancellation or reader visibility. No environment approval
or production connection was requested to evade this boundary.

Final candidate results: `npm ci --prefix web` PASS; focused auth/preparation/
preflight/actual 503 tests **38 PASS, 0 FAIL, 0 SKIP**; actual PostgreSQL 16
single-user 47k test PASS (11.1 seconds locally, not a hosted SLA); artifact tests
17 PASS. TypeScript and optimized Next production build PASS independently.
Inventory/matrix generator `--check` and `git diff --check` PASS.
`npm run check` in the isolated candidate reports **42 passing test files / 1
failing file / 0 skipped**, stopping before its TypeScript/build stages.
Expanding the full suite with `--test-isolation=none` gives **444 PASS / 1 FAIL /
0 SKIP (445 total)**; the sole failure is the same server socket EPERM, not an
assertion failure in the new adapter. The restricted workspace also prevents
unrelated tests from creating `.agents/runtime`; the isolated archive resolves
those filesystem failures without changing tests. Initial single-user fixture
attempts timed out on piped input, including a small diagnostic case. Using a
file descriptor for synthetic SQL, matching the repository's existing single-user
fixtures, fixed that harness stall; the final 47k test passes in both full-suite
runs. Those earlier attempts are not recorded as passes.

Reproduction commands (synthetic/disposable only):

```bash
npm ci --prefix web
npm run check
node --test --test-isolation=none web/tests/prepared-sales-recovery.test.mjs web/tests/google-sheet-reader.test.mjs web/tests/source-preflight.test.mjs web/tests/data-sync-safety-gate.test.mjs
node --test --test-isolation=none web/tests/prepared-sales-recovery-postgres.test.mjs
node --test web/tests/sales-atomic-postgres.test.mjs
node scripts/bi-audit-inventory.mjs --check
git diff --check
```

The native server test now includes prepared exact-decimal 47k bodies, unchanged
historical identities, failure rollback digest, all three real MV shapes and retry.
The independent single-user fixture checks actual PostgreSQL numeric results for
47,000 facts/24 batches: revenue `90071992552109.81`, checks `47000`, markup
`-1410.00` in facts/flat/monthly/weekly, rollback after an injected post-refresh
status failure, and idempotent receipt/full-snapshot retry. All values are synthetic.
No test supplies a real secret, reads DATABASE_URL or connects to an existing DB.

Final local outcomes and file digests are recorded in
`sales-recovery-verification-2026-11-02.json`. Local work remains uncommitted by
instruction. The trusted runner must verify the resulting exact commit, attach
its actual SHA/check URLs to **existing PR #44**, and retain BLOCKED status until
the full suite (including server/concurrency tests with zero PG skips) is green.
No candidate commit SHA or remote PASS is invented here. Authenticated desktop/
mobile QA was not performed: no authorized session was available in this run.

## Production release and rollback runbook — NOT EXECUTED

This is the single release checklist for this bounded preparation. Each gate
requires explicit approval for its exact action; code review grants none of them.

1. **Code/evidence gate.** Review the exact candidate commit on PR #44. Require
   green `npm run check`, generator check, server rollback/concurrency/cancellation/
   47k suite, single-user exact-decimal suite, and no PG skips on that commit.
   Confirm installed helper definitions, owners, RLS/grants, schema/MV parity,
   every snapshot writer, hosting memory/runtime limits, and authoritative source
   baseline. Reject drift. Current local evidence does not meet this gate.
2. **Backup/restore rehearsal gate.** With separately authorized read access and
   approved confidential storage, capture a consistent full warehouse snapshot:
   facts with IDs/run references, all dimensions/date rows, mapping/lifecycle,
   import history, MV definitions, helper/function definitions, owners/grants,
   and any atomic generation/run state. Record timestamp, schema/source hashes,
   row counts, date coverage, exact totals and deterministic ordered JSONB digests.
   Record backup identifier/checksum and retention/access owner in private evidence.
   Restore into an approved disposable environment; verify referential identities,
   recomputed MVs and all digests/totals. No production backup or restore evidence
   exists in this run: leave this gate CLOSED until that rehearsal passes.
3. **Maintenance/SQL permission gate.** Kostiantyn must approve exact migration,
   grants/legacy revocations and coordinated writer quiescence separately. Drain
   old in-flight writers and verify none remain before any cutover. Keep manual
   guards and schedules disabled. Apply only the independently reviewed design
   under the approved plan; the repository SQL still ends in ROLLBACK and is not
   an executable release script. No application of it is authorized here.
4. **Credential/access gate.** Separately approve exact credential configuration
   or IAM actions, if needed. Verify existing private-reader access with an
   authorized no-write probe, then a bounded readonly reconciliation. Do not make
   the sheet public. A successful user-connected read is not service-account proof.
5. **Compatible sender/deployment gate.** Implement/review a server-only exact-body
   transport, paginated authoritative baseline reads, sanitized failures and run
   handling before separately approving deployment. Review against all legacy
   callers. The current adapter only prepares bodies; no activation flag exists.
6. **First protected import gate.** Separately approve the exact source snapshot,
   expected close date, full history/identity/cent reconciliation and one controlled
   atomic promotion. Compare source→facts→all MVs→RPC→authenticated desktop/mobile
   UI on one accepted generation, including dates absent from the former warehouse.
   Calendar cutoff alone does not establish business close completeness. Record
   actual run ID, generation and receipt privately. Do not enable a schedule.
7. **Rollback decision.** Before promotion commits, any exception/cancellation must
   leave the full previous warehouse snapshot intact; compare ordered digests,
   dimensions, MVs and run state, and keep imports disabled. Local injected-failure
   tests provide synthetic evidence only. After a committed promotion, disabling
   imports is the immediate containment; the previous snapshot is no longer an
   automatic transaction rollback. Require explicit owner approval for restoration
   of the rehearsed consistent backup and coordinated generation/import metadata,
   recompute MVs, reconcile identities/totals and retain the failed/new run evidence.
   Never repair via old batch/finalize calls, partial fact writes, grant restoration
   or resetting a stale run's generation. Re-enabling imports/schedules needs a new
   exact approval after reconciliation. No rollback SQL was executed or provided as
   a production shortcut.
