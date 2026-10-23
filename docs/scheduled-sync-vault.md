# Issue #27: scheduled sync Vault design — NOT APPLIED

Prepared for Barbara's design/security review only. This change has not executed
SQL, created a Vault secret, altered cron, called the Edge Function or rotated a
credential. Production mutation requires a separate, explicit Kostiantyn approval
for the exact reviewed action. Even executing the rollback-only validation file
requires that separate gate; it is not a harmless read-only query.

## Evidence and scope

The trusted issue's 23 October 2026 audit reports job ID `1`, name
`myastoriya_google_sheet_sync_daily`, active, schedule `15 4 * * *`. Server-side
extraction found one 26-character SQL pair literal for `x-bi-sync-key`; its SHA-256
matched `public.bi_runtime_config` at `config_key = 'sync_key'`. No credential or
actual hash was supplied to this implementation, and none was needed. These are
reported audit facts, not new live verification by this change.

The issue reports Vault 0.3.1 installed with no secrets and the four-argument
`vault.create_secret` and six-argument `cron.alter_job` signatures available.
`pg_net` 0.20.4 is non-relocatable, owns the separate `net` schema and remains an
explicit managed exception to the `extension_in_public` advisor finding. Do not
move/reinstall it or change any unrelated cron jobs.

The [review SQL](sql/issue-27-scheduled-sync-vault-NOT-APPLIED.sql) stays outside
`supabase/migrations`, begins a transaction and ends with `ROLLBACK`. It creates
no persistent functions, RPCs, grants, scheduler or deployment path. No migration
or production-ready commit variant is included.

## Planned transaction

1. Suppress session statement/error/parameter logging and reject known pgAudit
   or auto_explain capture. Acquire bounded locks on cron metadata, runtime config
   and Vault secrets. Require the exact audited job ID/name/schedule/active state
   and current database; preserve all other job fields without assumptions about
   their values. Missing/duplicate jobs and drift abort the transaction.
2. Require exactly one header marker and one ordinary SQL pair literal. Extract
   only inside PL/pgSQL memory. Reject escaped/control-character literals,
   unexpected length and duplicate occurrences of the candidate anywhere in the
   command. Compare SHA-256 against runtime config **before** any Vault insert.
3. Fail on any existing secret with the stable, non-secret name
   `myastoriya_google_sheet_sync_key`, including one that might match. Do not
   overwrite or reuse pre-existing data. Check effective table/column/PUBLIC
   privileges and membership in privileged roles. Only superusers, `postgres`,
   `supabase_admin` and `service_role` are allowed direct access. Any other reader
   or member of those roles blocks this design; do not silently broaden the list
   or revoke unrelated grants to make it pass.
4. Require privileged Vault schema/read access for both cron's existing username
   and the SECURITY DEFINER owner of `public.bi_trigger_sync(text)`. The latter
   executes the stored cron command for dashboard manual refresh. Do not grant
   Vault access to `anon` or `authenticated` to support that path.
5. Create the named secret from the verified in-memory candidate. Read it back
   by ID/name and verify its hash. Replace only the SQL value literal with:

   ```sql
   (select decrypted_secret from vault.decrypted_secrets
    where name = 'myastoriya_google_sheet_sync_key')
   ```

   Call `cron.alter_job` with only `job_id` and `command`. Assert byte equality
   outside that replacement, no candidate remaining in the new command, exactly
   one lookup, and equality of every non-command job field. This preserves URL,
   request body, timeout, all non-secret headers, ID/name, schedule, database,
   username, active state and any other cron metadata. Missing Vault rows later
   yield no credential; multiple rows cause a scalar-subquery error rather than
   selecting an arbitrary secret.
6. Reconstruct the old command in memory using the verified Vault value and
   require exact equality. Return only hashes, job metadata, stable secret name
   and assertion flags from a temporary table, then `ROLLBACK`. No HTTP statement
   is executed. Generic exceptions never include original errors or values.

The extraction deliberately supports only the audited ordinary pair syntax. A
different literal/cast/header construction requires a new review. Preserving
bytes is not a SQL parser or proof of execution semantics. Locks protect these
table changes, but do not stop an already running cron or manual invocation.

## Separate validation/application gate

Barbara should review this artifact before any request for owner approval. Static
tests verify source contracts only; this issue authorizes **no database execution,
including local SQL**. PostgreSQL syntax, extension behavior, privileges, logging,
concurrency and HTTP behavior remain unverified.

Before separately authorized database validation or application:

- Have a privileged DBA verify all SQL/session settings and the extension
  signatures in a safe environment. Resolve any ACL failure by explicit security
  review. Review exposed SECURITY DEFINER wrappers, Vault decrypt/create/update
  function permissions, PostgREST schema exposure, role membership and cron-table
  read permissions; table ACL checks do not prove absence of every indirect path.
- Ensure the execution client does not echo variables/results beyond the allowed
  metadata. Verify pgAudit, auto_explain, PostgreSQL error/parameter settings,
  proxy/support tooling and external telemetry cannot record nested decrypted
  parameters, original cron text or request headers. The SQL's local settings and
  generic exception handler alone cannot guarantee external log redaction.
  Do not collect `cron.job.command`, `vault.decrypted_secrets`, pg_net request
  headers or detailed internal errors as evidence.
- Arrange an approved window excluding the daily run and manual refreshes; check
  that no sync is running. Do not change the schedule or active flag to accomplish
  this within this issue. Coordinate concurrent Vault/admin access. Confirm
  extension-specific side effects/locks and rollback behavior in authorized
  integration validation before drafting a production application artifact.
- Retain only the SQL-produced hashes/metadata in review evidence. Do not save an
  original-command dump to GitHub, disk exports, SQL editor history or PR output.
  A separate reviewed application artifact must explicitly define its transaction
  and approval; do not simply replace this file's final `ROLLBACK` with `COMMIT`.

## Edge Function validation design

`supabase/functions/sync-google-sheet/index.ts` already reads `x-bi-sync-key`,
loads the `sync_key` hash from runtime config and compares SHA-256 before any
import work. Its code and credential remain unchanged. The existing path stays
`cron -> net.http_post -> sync-google-sheet`; only the header value source changes.
The hash comparison and byte-preservation checks establish the proposed input
equivalence, not successful network delivery.

After a separately approved application, prefer observing the next existing
scheduled sync. Any explicit test invocation also needs authorization because
this function writes import/business data. Correlate the cron run's metadata,
pg_net request ID and HTTP status with `import_runs` status/counts, recording only
redacted metadata. A pg_net request ID or cron success alone is not HTTP success;
the queue is asynchronous. Confirm an expected successful response (or documented
already-running response), no authentication error, and normal import completion.
Do not export response bodies or customer rows. Validate manual refresh under its
existing privileged function owner in the approved window as well; never expose
Vault to the caller to make it work. None of these live checks were run here.

## Rollback and recovery design

Before commit, an error or the mandatory final `ROLLBACK` undoes both the proposed
Vault insert and cron alteration. Disconnect/failed transaction must be rolled
back; never continue after a validation error. The file performs no HTTP call,
so it cannot enqueue an import during rehearsal.

After a future approved commit, prefer repairing the named Vault lookup/access
under a separate owner gate. Keep the secret available while investigating. If
restoring the prior inline command is explicitly approved as emergency recovery,
use a separately reviewed server-side transaction with the same logging, locks,
hash and privilege gates:

1. Require the same job metadata and the exact previously approved new-command
   SHA-256. Require exactly one copy of the exact named lookup from this artifact;
   reject any other Vault reference or command drift.
2. Fetch exactly one named secret inside DB memory and verify its SHA-256 against
   both runtime config and the approved metadata. Abort on absence/ambiguity or
   mismatch. Never take a credential from GitHub, a human paste or an export.
3. Replace that exact lookup with `quote_literal` of the verified Vault value.
   Require the reconstructed command SHA-256 to equal the approved pre-change
   hash; the design SQL already prepares and checks this inverse in memory.
4. Bind the reconstructed command directly to `cron.alter_job`, preserve all
   metadata, recheck hashes and perform the separately approved validation.
   Return only hashes/flags. Keep the named Vault secret through recovery; any
   later deletion needs its own review and explicit approval.

This restores the original security finding and is an emergency option, not an
automatic fallback. No executable recovery/apply path is included in this
design-only change. No plaintext backup is necessary in GitHub.
