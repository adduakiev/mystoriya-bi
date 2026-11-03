# Issue #43 / existing PR #44 — composed Sales review and blocked cutover

PREPARE ONLY. NOT READY FOR RELEASE OR FIRST IMPORT. WORKING acknowledged in
this Codex transcript; trusted workflow owns GitHub status publication. Verified
local branch `astra/issue-43-40107435112`, clean starting HEAD
`c7e94f4d641563eb115f007e471b23c046811de8`. An isolated local clone at that SHA
was used because this sandbox cannot create `.git/worktrees`. No commit/push,
new PR, production read/import, migration, credential, grant or scheduler action.

The trigger supplies trusted **base** evidence for Actions
[41595108624](https://github.com/adduakiev/mystoriya-bi/actions/runs/41595108624):
PostgreSQL 16.15, 524/524 PASS, 0 FAIL/SKIP, native valid-DML 42501 denials and
Next build PASS. That receipt is not independently fetched here and does not
certify these uncommitted changes. Existing deployed Edge v8/gviz 401 and latest
Sales 2026-10-26 are trigger observations, not new observations from this task.

## Exact source-trust audit and reproduced discrepancy

| Priority | Reproduced actual behavior at base | Required behavior and candidate disposition |
| --- | --- | --- |
| P0: unauthenticated metadata can start prepared transport | `prepared-sales-transport.mjs` accepted a plausible `import_runs.details.accepted_source_v1` object and matching fact IDs/dates; its synthetic fixture could then begin/stage/commit. There was no verification of that object's signature or trust chain. Current service-role DML is not proven hardened in production. | Metadata consistency cannot authorize reservation/promotion. `recover()` now rejects unconditionally before I/O, and the adapter has only fixed GET requests. All DB POST code is removed from the candidate. |
| P0: no approved root or SQL attestor | `verifyPreparedSalesProvenance` verifies Ed25519 signatures relative to keys, prior receipt and observer independence groups supplied in `trustedContext`. A digest and its recomputed prior receipt are integrity checks, not proof of an approved root. Its WeakSet token cannot authenticate a DB session. | Do not promote that context, `verified:true`, a service-role JWT or any self-selected signer set into authority. The new composition accepts no such options and never invokes the signing verifier as an authorization gate. |
| P0: no authenticated repeatable promotion | The original atomic SQL writes `{atomic:true,snapshot:...}` without authenticated accepted-source evidence. The separate rejection overlay intentionally rejects both commit RPCs with SQLSTATE 55000. | Preserve the overlay, runtime 503s and NOT APPLIED SQL. A genuine attestation success path and approved historical initialization are still missing engineering/release prerequisites, not owner credential toggles. |

Evidence: `prepared-sales-cutover.test.mjs` exercises real synthetic RSA OAuth
signatures, two genuine caller-selected Ed25519 signatures, forged prior metadata,
zero DB POSTs, exact cents and rejected readback authorization. Transport tests
retain pagination, completeness, drift, deadline/abort and sanitization checks.
The native 47k test now checks private preparation plus unchanged facts/views
when forged metadata is presented to `recover()`. Existing direct native atomic
rollback/idempotence/concurrency tests remain; unauthenticated sender delivery
and retry tests were replaced because that sender is intentionally removed.
Additional native ACL cases attempt valid `details` INSERT/UPDATE as all three
API roles and require actual SQLSTATE 42501 with snapshot parity.

## What is connected, and what remains blocked

`createPreparedSalesCutover` is opt-in, server-only and unreferenced by production.
Its explicit trusted configuration pins the existing project/Sheets reader,
private secret dependency, complete alias mapping, fetch and deadlines. No
import-time I/O, environment lookup, persistence, signer or new credential exists.
Each private `review()` invocation:

1. Reads the latest metadata and every fact ID/date in exact-count pages, with
   before/after run checks. These are structural, **unauthenticated** read evidence.
2. Uses one fresh readonly OAuth exchange and one fixed typed Sheets API capture,
   retaining immutable typed cells and defensive copies of original response bytes.
3. Produces exact-cent manifest/batch strings from the same canonical capture,
   rechecks the baseline, derives source/manifest/mapping/warehouse digests, and
   verifies capture-to-manifest binding without a second source read.
4. Returns confidential in-process review material marked `BLOCKED`,
   `priorAuthenticated:false`, `SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE`.
   The result is not an HTTP response, accepted receipt or commit capability.

Missing authentic metadata in today's legacy records still stops the review
before Google OAuth. No fallback substitutes warehouse minimums or invents a
first accepted source. A complete synthetic review with forged-but-consistent
metadata is deliberately possible **only as untrusted preview**, never as a
write authorization. Concurrent invocations own separate immutable captures;
reviewer clocks/mappings are snapshotted before asynchronous work.

`refresh()` and transport `recover()` always reject before source/auth/network.
The preview manual UI, Next `/api/data-sync` POST and Edge entrypoint retain
byte-identical unconditional 503 guards. No candidate path can call legacy batch
or finalize RPCs, create an import run, stage or promote. The old atomic SQL is
retained as a disposable test fixture, not an installable cutover bundle. No SQL
file, production component, Digital page or inventory item changes in this task.

A fully accepted cutover candidate is **not achievable under the current trust
contract**. This patch closes the unsafe prepared sender and connects reviewable
read/preparation pieces. It deliberately does not claim authenticated end-to-end
success, source completeness, installed hardening, actual backup/restore, live
browser correctness or completion of the broader issue #43 audit.

## Independently safe read-only probe design (not installed or executed)

Do not use the composed recovery review or manual refresh as an access probe.
A separately reviewed standalone process must have **no Supabase credential,
DB adapter, RPC client, scheduler or import dependency**. It receives an existing
private Google reader credential through the owner's approved secret mechanism;
never through HTTP fields, CLI arguments, PR text, logs or artifacts.

Allow exactly one OAuth token POST to `https://oauth2.googleapis.com/token` with
issuer `myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com`,
RS256 assertion lifetime 300 seconds and only
`https://www.googleapis.com/auth/spreadsheets.readonly`. Then allow exactly one
GET to the pinned spreadsheet `1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA`,
range `'Данние короткі'!A1:N1`, ROWS, UNFORMATTED_VALUE, SERIAL_NUMBER. Deny
redirects, caller-selected endpoints/ranges, fallback, retry and credential
forwarding to any other origin. Use omit credentials/no-store and a 30-second
whole-operation deadline including streams and non-cooperating dependencies.

Require HTTP 200 JSON, at most 32 KiB decoded body, exact returned header range,
one row and 14 cells, and the nine required column labels from `source-safety`.
Reject partial/extra rows, malformed Unicode/numbers/metadata, missing headers,
401/403/429/5xx and redirects. Return only fixed auth/header PASS/FAIL codes and
a run timestamp; no token, assertion, private key, cells, response body, upstream
error, cookies or raw headers. Retain no raw body. Exit on any uncertainty.
The existing `readPrivateSalesSheet({probe:true})` is a useful reader primitive,
**not a claim that this stricter isolated probe boundary already exists**.

This header probe proves access and schema only. It cannot prove latest business
date, row completeness, accepted historical receipt, totals, warehouse parity or
readiness to import. Full-data observations and DB SELECT preflight require
separate approved read scopes. Probe success cannot open either 503 guard.

## Blocked release checklist and minimal owner-side actions

All boxes remain open. Source, credential, schema, attestation, backup and release
gates are distinct; no broad approval substitutes for any one of them.

- [ ] Owner/authorized administrator confirms the existing pinned service account,
  private Viewer access to the fixed spreadsheet, Sheets API availability and
  whether an existing valid credential is securely available. No new key is
  required by this patch. If access/credential provisioning is needed, record
  approval for that exact action and perform it through the approved owner-side
  system; never paste the secret into GitHub or this conversation.
- [ ] Owner approves the standalone header-only probe scope above. Engineering
  implements/verifies its strict isolated boundary before any real run; owner
  executes only with approved existing access. Nothing in this patch runs it.
- [ ] Owner/security reviewer records an authoritative historical acceptance
  policy and the allowed signer identities, independent custodians, key pins,
  rotation/revocation policy and retained receipt provenance. There is currently
  no original authenticated `accepted_source_v1` root. Historical data must not
  be relabeled accepted. A first-recovery/initialization design needs its own
  explicit approval and evidence; two new captures cannot authenticate history.
- [ ] Engineering prepares and independently reviews a DB-authenticated evidence
  channel, immutable receipt persistence and transactional success/readback, bound
  to run, manifest, canonical identities/cents, source bytes, aliases and generation.
  Prove rejection of service-role forgeries/replay/caller keys, concurrent stale
  generations and cancellation/rollback. Do not replace the rejection overlay
  with a success stub, JSON flag or JavaScript-only verification.
- [ ] Authorized DBA performs separately approved **read-only** role/catalog/writer
  preflight, source/warehouse reconciliation and freshness checks. Unknown
  ownership/default/inherited grants remain STOP gates. No production hardening
  has been performed by this task.
- [ ] Authorized owner/DBA captures a real protected consistent backup, exact object
  inventory, row/cent/generation digests and executable restore instructions;
  proves restore to an isolated authorized destination, with complete parity and
  recovery timing. Synthetic fixture success cannot certify the live backup.
- [ ] Trusted outer workflow verifies the **new exact PR #44 HEAD**: full native
  PostgreSQL/negative ACL/authenticated-channel/concurrency/backup tests,
  `npm ci --prefix web`, full `npm run check`, optimized build, inventory and diff,
  zero FAIL/SKIP. Attach actual run URL and SHA. Current base receipt is historical.
- [ ] Owner approves the exact coordinated SQL/grants/credential installation and
  cutover artifact after dependencies above pass. Keep SQL NOT APPLIED until
  then. Separately approve merge, deployment and first manual import; wire only
  the authenticated atomic adapter with reviewed request authorization. Confirm
  legacy batch/finalize and alternate writer paths are unreachable before opening
  either guard. Scheduler/business writes remain separately gated.

Owner credential actions alone cannot make this candidate releasable. Remaining
implementation and evidence are explicit blockers, not requested permissions in
this session. Data Gap Workshop, wider audit, schedulers, Digital/UX and all other
business integrations remain out of this bounded continuation.

## Verification and handoff

Final local results and independently cross-checked file hashes are recorded in
`sales-cutover-verification-2026-11-03.json`. Local verification cannot produce a
new GitHub PR HEAD because Codex must not commit or push. The trusted workflow
must publish only to existing PR #44 after its deterministic checks pass, attach
its actual resulting SHA and runner receipt, and retain PREPARE ONLY status.

Local verification used the byte-identical isolated clone; final review files
were transferred back to the original branch without a commit. PostgreSQL is
16.15. No test skip/waiver, socket workaround or weakening of ACL checks was
introduced. The single-user fixture additionally applies the existing hardening
**only inside its disposable cluster**, proves valid metadata DML first, then
checks all six actual 42501 denials and complete import metadata/snapshot parity.
An initial positive-control fixture needed SELECT alongside column INSERT/UPDATE;
that fixture grant was corrected before the passing run. No production grants
were changed.

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web` | PASS in isolated clone and original workspace; lockfile unchanged |
| Focused cutover/capture/provenance/transport | 58 PASS / 0 FAIL / 0 SKIP; final transport-only cleanup recheck 11 PASS / 0 FAIL / 0 SKIP |
| Final single-user native PostgreSQL fixture | 1 PASS / 0 FAIL / 0 SKIP; 47,001 raw → 47,000 facts, exact cents, rollback, rejection gate, hardening and metadata 42501 controls |
| Full `npm run check` | FAIL: 46 test files PASS / 3 FAIL / 0 SKIP; atomic server, backup/restore server and role-hardening server suites cannot start sockets (`EPERM`) |
| TypeScript `--noEmit` | PASS independently; full check stops before this stage |
| Optimized Next production build | PASS independently; full check stops before this stage |
| Inventory generator `--check` and zero inventory diff | PASS: 22 pages, 7 APIs, 758 visual/control templates; runtime parity UNKNOWN |
| `git diff --check` | PASS |
| SHA and isolation parity | Git commit object independently hashed to the exact base SHA; candidate files cross-checked with SHA-256 via Python and `sha256sum`; transferred bytes identical |
| Actual Google/Supabase/GitHub/browser/production checks | NOT EXECUTED; no live completeness or acceptance claim |

Reproduce server blockers with `node --test --test-isolation=none
web/tests/sales-atomic-postgres.test.mjs` (loopback `listen EPERM`) and the analogous
backup/restore and role-hardening test files (PostgreSQL socket startup `EPERM`).
The new server-native review and role metadata tests remain unexecuted here;
they are not reported as passed or skipped. The passing single-user fixture
proves the bounded SQL/ACL behavior above, not server concurrency or restore.

**Handoff: BLOCKED for full local verification and authenticated release.** The
new PR HEAD and new trusted outer receipt do not exist in this session. Local
HEAD remains `c7e94f4d641563eb115f007e471b23c046811de8`; changes are uncommitted.
The runner must attach its actual new SHA/results to the same existing PR #44,
only after all deterministic checks pass. No release gate is opened by a green
runner: the missing approved historical root, pinned policy, authenticated DB
success channel, real source proof and actual backup/restore remain distinct
blockers. Do not deploy this review composition as an importer or advertise it
as a fully accepted cutover candidate.
