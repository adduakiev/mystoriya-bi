# Issue #43 / PR #44 — atomic Sales transport preparation

PREPARE ONLY. Same branch `astra/issue-43-40107435112`, clean starting HEAD
`9c91c116a92ad619874b9995fdc0ea6b652bdd69` verified before edits; an exact
`git archive` was retained under `/tmp` for isolated baseline verification.
No commit, push, PR creation, credential action, production request, migration,
deployment, import, scheduler or business write was performed.

The issue trigger supplies the trusted base receipt:
[Actions 41546061091](https://github.com/adduakiev/mystoriya-bi/actions/runs/41546061091),
461/461 native tests, zero skips, PostgreSQL 16 server/single-user fixtures,
TypeScript and optimized Next build on that exact base. This supersedes older
sandbox-only failures **for the base**. It does not verify this uncommitted
candidate. Final candidate SHA and runner URL must be attached to existing PR #44
by the trusted workflow after its own checks; neither is available inside Codex.

## Prepared boundary

`supabase/functions/sync-google-sheet/prepared-sales-transport.mjs` is a pure,
injectable server dependency, unreferenced by active code. Factory construction
requires explicit `enabled: true`, exact existing HTTPS Supabase origin, an
explicit service-role JWT and injected fetch. It rejects browser execution,
anon/user/wrong-project/expired JWT claims and alternate URL spellings. Local
claim validation is an accidental-credential boundary, not signature verification;
Supabase must verify the JWT. New secret-key formats need separate review.
No environment lookup, hidden credential fallback, CLI, import-time I/O or logging
exists. Source-reader injection is a trusted test/server dependency, never an
HTTP parameter. Production uses the fixed private OAuth reader; no public Sheet
or caller-selected source/baseline is supported.

`readBaseline` performs only GETs against fixed `import_runs` and
`fact_sales_daily` paths. `recover` obtains that baseline, reads the fixed source,
prepares exact bodies, rereads the complete baseline, then invokes only:

1. `POST /rest/v1/rpc/begin_sales_snapshot_v2` with `p_manifest`.
2. `POST /rest/v1/rpc/stage_sales_batch_v2` with validated `p_run_id`, numbered
   `p_batch_no` and literal `p_rows`.
3. `POST /rest/v1/rpc/commit_sales_snapshot_v2` with the same validated run ID.

Manifest/batch text is concatenated directly into wrappers. It is never parsed
or reserialized; exact decimal literals survive, including
`90071992547409.91`, signed cents and trailing zeros. Numeric receipt totals are
not used as reconciliation evidence. Output contains only a validated run ID,
aggregated count and raw count. No source rows, credentials, arbitrary upstream
fields or error bodies escape. Both production entrypoints retain their exact
original unconditional `SALES_IMPORT_SAFETY_GATE` 503 bytes. SQL is unchanged.

## Authoritative baseline — currently CLOSED

Current `import_runs` has `rows_read`, `rows_loaded`, cutoff and details. Existing
atomic details contain a **warehouse** snapshot min/max, not prior **source**
provenance. Legacy records are weaker still. Neither fact min(date_id), earliest
observed audit date nor a user's supplied date establishes prior-source minDate.
There is deliberately no initial-load, warehouse-only or legacy fallback.

The prepared read contract requires a successful atomic record with zero rejects,
valid UUID/timestamps/counts, matching `details.snapshot` bounds/count, plus a
future governed `details.accepted_source_v1` object:

| Field | Required evidence |
| --- | --- |
| `run_id` | Same accepted import UUID |
| `spreadsheet_id`, `range` | Existing fixed private source and `'Данние короткі'!A:N` |
| `raw_rows` | Exact accepted source count, equals `rows_read` |
| `min_date`, `max_date` | Actual complete accepted source bounds; max equals cutoff, completed Kyiv date |
| `observed_at` | Actual source observation, within two hours before run start through finish |
| `sha256` | Lowercase SHA-256 identifier of retained confidential accepted source evidence |

**No existing importer or NOT APPLIED SQL emits this object.** Its absence raises
`SALES_TRANSPORT_AUTHORITATIVE_SOURCE_EVIDENCE_REQUIRED` before even reading the
private Sheet or invoking begin. Mock/synthetic records in tests are not evidence
that real accepted-source provenance exists. Checking a hash's shape does not
verify an artifact: a separate authorized read-only review must establish the
snapshot, hash algorithm/bytes, full row count, exact bounds, run association and
source→warehouse reconciliation, with controlled confidential retention and
ownership. Never backfill this metadata from fact bounds, a guessed date, or a
current source reread. If historical evidence cannot establish it, keep CLOSED;
owner-reviewed baseline bootstrapping is a separate design and approval gate.
Recording evidence or changing the writer/schema is outside this patch.

Warehouse verification pages all fact identities in 1,000-row ordered pages,
requires exact Content-Range totals/page widths, safe integer unique ascending
IDs, valid dates and every row owned by the accepted run. It rejects unknown
totals, truncation, mixed runs and date/count mismatches. Reads are bounded by
200,000 accepted rows, no arbitrary row-limit assumption. The accepted record's
raw response bytes must match before/after pagination and after source preparation.
This catches record changes without rounding monetary metadata. GETs do not form
a repeatable-read transaction; coordinated writer quiescence and unchanged SQL
historical-key/generation/transaction locks remain required. These checks do not
prove full source closure, exact totals, mappings or UI parity.

## Timeouts, cancellation and retry/ambiguity contract

All requests omit cookies, refuse redirects, disable cache, keep apikey/Bearer in
headers and accept only bounded JSON responses. Per-fetch deadline includes body
consumption (default 30 seconds, explicit range 1–60,000 ms). Limits: accepted
record 64 KiB, fact page 256,000 bytes, run ID/stage receipt 128 bytes and commit
receipt 4 KiB. Source preparation has the same outer deadline and forwards abort
to OAuth and Sheets. External abort stops further requests. An injected fetch or
source dependency ignoring abort cannot hold the caller open past its deadline;
a real write already delivered may still finish on the server.

Only a staged batch can retry: default one retry, configurable 0–2, immediately
using identical run ID, number and payload after a network/deadline failure or
HTTP 502/503/504. SQL's identical-batch idempotence is mandatory. Validation/auth/
conflict responses never retry. Begin never retries (it allocates a run); commit
never retries automatically, despite SQL's same-run committed-receipt support.
Each factory permits at most one begin attempt, including concurrent invocations
or lost begin responses. It exposes no resume/run-selection or whole-flow retry.
After an ambiguous begin/commit, stop and obtain separately authorized read-only
run/warehouse/generation evidence. Never create another run to resolve ambiguity,
reset generation, or repair through old writers. A timeout/abort/invalid receipt
is not proof that a delivered transaction rolled back. Incomplete private staging
can remain until expiry; this module performs no cleanup writes.

## Verification and handoff

Local outcomes are recorded below and in the [machine-readable receipt](sales-transport-verification-2026-11-03.json). Full
acceptance requires the trusted runner's **new exact candidate SHA** with zero
skips and real disposable PostgreSQL server concurrency/cancellation/47k plus
duplicate raw fixture, single-user precision/rollback, native suite, TypeScript,
optimized Next build, inventory generator `--check` and `git diff --check`.
No socket restriction is waived and no READY FOR GATE/RELEASED claim is made.

The new server fixture routes the sender's unchanged HTTP JSON bodies into real
local SQL, injects a lost stage acknowledgement after delivery, and checks
47,001 raw → 47,000 facts, exact cents across facts/all MVs, raw-count provenance
and unchanged snapshot on same-run commit retry. It also verifies that unchanged
SQL has not manufactured accepted-source evidence. It uses synthetic data and a
disposable local database only. Other unit tests mock every fetch/source read.

Release dependencies from the existing [preparation runbook](SALES-RECOVERY-PREPARATION-2026-11-02.md)
remain CLOSED: authoritative baseline/source closure; source→warehouse→RPC→UI
reconciliation; backup and restore rehearsal; installed SQL/helper/grant/RLS and
writer inventory review; separately approved SQL/cutover and credential access;
compatible reviewed runtime integration/deployment; separately approved first
protected import and later scheduling. This patch grants none of these actions
and leaves the original SQL file NOT APPLIED, ending in ROLLBACK.


## Final local receipt — acceptance BLOCKED in inner sandbox

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web` | PASS; no lockfile change |
| Focused transport/private reader/preparation | 36 PASS, 0 FAIL, 0 SKIP |
| `npm run check` in isolated byte-identical code/test candidate | 43 passing files, 1 failing file, 0 SKIP; only server fixture socket EPERM |
| Expanded suite, same candidate | 461 PASS, 1 FAIL, 0 SKIP; `listen EPERM 127.0.0.1` before nested server fixtures execute |
| Real PostgreSQL 16.15 single-user fixture | PASS: 47,001 raw → 47,000 facts, exact cents, rollback, same-run idempotence |
| TypeScript / optimized Next build | PASS independently; full check stops before these stages |
| Inventory generator `--check` | PASS: 22 pages, 7 API routes, 758 templates |
| `git diff --check` | PASS |
| Live source/Supabase/browser QA | NOT EXECUTED |

Reproduce the sole isolated-candidate failure with
`node --test --test-isolation=none web/tests/sales-atomic-postgres.test.mjs`.
The same failure was reproduced on the archived exact trusted base. An initial
workspace check also encountered three read-only `.agents/runtime` test failures;
those pass in the isolated writable archive. No repository permissions or test
skip conditions were changed. No socket restriction was worked around or waived.
The new nested server transport test remains unexecuted here; the passing
single-user test exercises the existing preparer, not that sender/server path.
This is an inner Codex sandbox limitation, **not a trusted outer runner failure**.

Final local HEAD remains `9c91c116a92ad619874b9995fdc0ea6b652bdd69`; changes are
uncommitted by contract. A new final commit SHA/runner URL cannot be supplied or
posted from Codex. The trusted workflow must attach its actual final SHA and green
receipt to existing PR #44 after independently running all required server and
other checks. Source provenance, backup/restore, SQL permissions/cutover,
credentials, deployment, first import and scheduling remain separate closed gates.
