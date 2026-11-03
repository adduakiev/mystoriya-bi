# Issue #43 / PR #44 — transactional accepted-source evidence gate

PREPARE ONLY / NOT APPLIED / NOT READY FOR RELEASE. WORKING acknowledged in
the Codex transcript. Starting branch `astra/issue-43-40107435112`, exact clean
HEAD `7004a19a65f3e033433fa183628dfd6b6c8fc8d4`; one worktree, no local edits.
No remote verification or GitHub comment was attempted. The trigger independently
reports branch equality and trusted [Actions 41569479186](https://github.com/adduakiev/mystoriya-bi/actions/runs/41569479186),
job 125698796930: 516/516 tests, zero failures/skips, actual disposable PostgreSQL
16.15 concurrency/cancellation/47k, TS/build/inventory/diff. That is supplied
**base evidence**, not a result for these uncommitted changes. The trusted runner
must identify and verify its new exact SHA on the same PR #44.

## Proven discrepancy and bounded decision

P0 release blocker: `commit_sales_snapshot_v2` in the original
`docs/sql/issue-43-sales-atomic-NOT-APPLIED.sql` sets success details to
`{atomic:true,snapshot:...}` only. A subsequent prepared transport baseline read
rejects it with `AUTHORITATIVE_SOURCE_EVIDENCE_REQUIRED`. The existing synthetic
47,001-raw/47,000-fact server test reproduces that exact behavior. A successful
candidate promotion is therefore not a repeatable authenticated accepted baseline.

The existing JS provenance verifier checks real Ed25519 signatures against the
keys in `trustedContext`, but that context is supplied by its server/reviewer
caller. Its WeakSet token never crosses the DB boundary. Neither Supabase's
service-role JWT, shape-valid JSON, `verified:true`, a SHA-256 digest nor two
signatures under caller-selected keys establishes an approved attestor to SQL.
The prepared transport's `accepted()` check is metadata consistency only; its
synthetic baseline fixture is not production authentication. It remains unwired.

Repository review found no approved Sales attestor role/trust-root installation,
pinned observer policy, PostgreSQL Ed25519 verifier, immutable evidence store or
historical accepted receipt. Existing `pgcrypto` references do not establish an
Ed25519 verifier or signer policy. No installed production extension/grant is
claimed: there were no live database, Google or GitHub reads. The trigger also
explicitly states the historical artifact/root and owner gates are absent.

Per trigger step 4, this revision stops at a **fail-closed contract and executable
rejection demonstration**. It does not implement authenticated persistence or
claim the transactional success criteria have passed.

## Deliberately closed SQL seam

New review overlay:
`docs/sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql`.
It depends on the original atomic candidate in a disposable fixture and ends in
ROLLBACK. It is outside migrations and referenced by tests only. It adds a
two-argument evidence seam and replaces the original one-argument commit body;
both unconditionally raise SQLSTATE `55000`,
`SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE`, including committed-run retries.
There is no retained ungated helper, SQL success branch, receipt table, attestor
role, key, trust-root bootstrap or authenticated flag. The draft service-role
EXECUTE declaration only lets the synthetic caller reach rejection; it is not
an installed production grant or evidence authentication.

The original SQL is preserved byte-for-byte as a **pre-activation atomic
regression candidate**, with its happy-path/concurrency/cancellation/47k tests
intact. It must never be installed alone or described as release ready. The
overlay is a separate review artifact, not an instruction to install either
file. Existing production v8 is unsafe and untouched. Both Next and Edge manual
POST handlers retain their unconditional 503 guards. No runtime adapter changed.

## Proposed authenticated channel — unresolved release gate

Two viable designs require additional, explicit review and owner action; neither
is established by currently approved components:

| Option | Required enforcement | Missing prerequisite |
| --- | --- | --- |
| DB-verifiable signatures | Audited Ed25519 verification over exact canonical bytes; DB-owned pinned public keys, independent domains and policy version; service-role cannot replace pins or verification code | Reviewed available verifier/extension and policy installation; owner-designated independent custodians; authentic prior root |
| Separate attestor role | Restricted authenticated attestor identity alone may insert private verified bindings; service-role cannot assume it, write receipts, change policy or call ungated commit; signed evidence still retained and verified by attestor | Approved independent credential/role boundary, grants/RLS/writer inventory and threat model; owner provisioning and authentic prior root |

An Edge function using the same service-role credential is not a separate
attestor boundary. A security-definer wrapper trusting request JSON also fails.
Do not provision either option here. The precise owner-only action, if this design
is selected, is to approve the attestation policy/root and independent custodians
with their authenticated channel and private retention policy; any credential,
grant/SQL installation or source access requires its own exact approval. A fresh
Sheet or warehouse reconstruction cannot attest the October 30 legacy run.
If the actual historical source artifact cannot be recovered, a separately
scoped owner recovery decision is required; no automatic first-run exception.

## Transactional persistence contract for the future reviewed success branch

This table is a proposal, **not implemented SQL/schema**. The existing
[canonical provenance contract](SALES-PROVENANCE-CONTRACT-2026-11-03.md) defines
the source/manifest/identity/alias byte encodings and signed observation core.

| Transaction stage | Binding and invariant |
| --- | --- |
| Reserve | Actual DB-reserved run UUID, source identity/range, literal manifest UTF-8 bytes/hash and base generation; reserve grants no authenticity or promotion |
| Authenticate | Two independently authenticated signed observations bind that UUID, prior immutable receipt hash/run, base and base+1 promoted generations, source SHA-256/raw count/bounds, manifest hash, canonical identity+exact-cents hash and complete alias snapshot/hash; pins and independence come from approved protected policy, never request JSON |
| Freeze and recheck | Lock generation then run; use existing mapping/lifecycle, dimension and fact lock order. Require current generation=base, unexpired reservation and both observations <=15 minutes old at commit, no future/reordered observations. Recompute staged manifest and canonical identities/cents with complete mappings under locks. Reject stale pins/prior receipt, duplicate keys, mapping changes, historical-key loss, bad totals or fact ownership |
| Promote and bind | In one transaction, update dimensions/facts, remove stale facts, refresh all three MVs, validate complete promoted rows/totals/hash, insert immutable private receipt, publish success metadata and increment generation exactly once. Any exception/cancellation rolls back every business/evidence effect; no post-commit evidence repair |
| Retry | A committed-run retry returns the same private receipt only if run, binding hash and immutable success metadata agree. Conflicting evidence cannot rewrite a receipt or increment generation. Ambiguous transport outcome requires read-only investigation |
| Readback | In a consistent private snapshot, obtain generation before/after, exact private receipt, success metadata and all facts joined to actual dimension identities. Verify complete pagination, run ownership, zero rejects, row count/bounds, exact cents, both signatures and prior chain; require both generations=promoted and strict canonical accepted-source equality |

Proposed private receipt: primary key run UUID, unique promoted generation,
base/promoted generations, prior run/receipt SHA-256, policy version,
canonical binding bytes/hash, retained source/manifest/alias/canonical-rows private
references, exact canonical `accepted_source_v1` bytes/hash and committed result.
Revoke update/delete/direct insert from anon/authenticated/service-role; no caller
chooses the authenticated producer. Hash JSON bytes explicitly: PostgreSQL jsonb
text ordering/spacing is not ECMAScript `JSON.stringify`. Preserve canonical bytes
as bytes/text and validate their parsed values; never stringify monetary values
through IEEE-754. Artifact retention must be authorized and complete before commit;
PostgreSQL cannot atomically roll back a separately written external object.

Proposed `details.accepted_source_v1` has exactly the existing required source
fields (`run_id`, `spreadsheet_id`, `range`, `raw_rows`, `min_date`, `max_date`,
`observed_at`, `sha256`) plus `binding_v1`, `binding_sha256`, `receipt_sha256`,
`base_generation`, `generation` and `policy_version`. Construct it only from the
authenticated binding, with duplicated fields checked against the signed core.
The private receipt stores these exact bytes and the same parsed object. Define
receipt hashing without a self-reference: hash the receipt core excluding the
accepted-source `receipt_sha256`, then include that digest in accepted-source.
The existing JS readback helper covers `binding_v1` only; a future reviewed
adapter must validate the whole wrapper and immutable private receipt as well.

No private immutable receipt schema was created: an empty table or a privileged
JSON insert path would not solve authentication. Metadata must never be backfilled
from facts, a new Sheet read, supplied booleans or this synthetic fixture.

## Regression proof and intentionally unavailable success tests

`web/tests/fixtures/sales-accepted-source-gate-regression.sql` runs after the
unchanged atomic candidate tests in both disposable PostgreSQL harnesses. It
models reservation+staging+attempted metadata in one transaction and compares
all facts, dimensions, three MVs, mappings/lifecycle, import success/details,
private runs/batches and generation before/after each rejected subtransaction.
Cases: absent/empty evidence, `verified:true`, a complete forged object, stale
observation, wrong run, wrong generation, changed mapping, wrong totals, legacy
prior, and bypass through the old one-argument commit. Anon/authenticated have
no EXECUTE access. Signatures in that JSON are deliberately forged synthetic
strings; these tests prove unconditional closure, not DB signature verification.
The existing separate JS tests use ephemeral real synthetic Ed25519 keys.

The real single-user fixture verifies rejection/rollback without sockets. The
server fixture also runs the new SQL after existing actual concurrency,
cancellation and 47k tests. An error in the new fixture fails the native suite;
there is no new skip/waiver or production connection. Expected SQL errors are
caught only for the exact gate SQLSTATE/message. Test-only transactions do not
persist evidence outside their disposable cluster.

Authenticated success, strict whole-wrapper `accepted_source_v1` equality,
immutable receipt mutation denial, exactly one authenticated generation increment,
readback, and evidence-bound concurrent/cancelled promotion tests are **BLOCKED
BY THE MISSING AUTHENTICATED CHANNEL**, not passed or skipped tests. They must
be implemented with a reviewed success branch before release; the preserved
atomic happy path does not prove them. No synthetic production root is created
to make those tests green.

Verification outcomes and final handoff are recorded below after execution.
The broader audit, Data Gap Workshop and Digital UX/UI v2 remain queued/read-only.
Production, backups/restore rehearsal, source closure, attestor/root, SQL/grants,
runtime integration, first import and scheduling remain separate closed gates.

## Local verification and handoff

| Check | Actual local result |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages installed, lockfile unchanged |
| Focused provenance + transport + single-user PostgreSQL | 32 PASS / 0 FAIL / 0 SKIP before adding the rollback-default isolation assertion; final PostgreSQL harness separately rerun PASS after that addition/fix |
| Final disposable PostgreSQL single-user test | PASS, PostgreSQL 16.15; 47,001 raw → 47,000 facts, exact totals/rollback/idempotence, unmodified overlay ROLLBACK leaves no gate installed, installed fixture overlay rejects all modeled evidence without partial effects |
| Final `npm run check` on isolated code/test candidate | FAIL: 45 native test files PASS / 1 FAIL / 0 SKIP; sole failure is the server fixture's local socket `listen EPERM 127.0.0.1` |
| Focused server fixture reproduction | FAIL before database startup: same `listen EPERM`; new nested server gate test NOT EXECUTED locally |
| TypeScript `--noEmit` | PASS independently on the isolated candidate |
| Optimized `next build` | PASS independently on the isolated candidate |
| Inventory `--check` | PASS: 22 pages, 7 API routes, 758 templates; production parity UNKNOWN |
| `git diff --check` | PASS |
| Live Google/Supabase/GitHub/browser/source reads or business writes | NOT EXECUTED |

The first full attempt also exposed a single-user harness issue while checking
the new default ROLLBACK (oversized error output, ENOBUFS). The final harness
finishes the original happy-path backend session before running the gate checks
in a second session on the same disposable cluster. Final focused and full native
results above include that fix. No production code was changed to resolve it.

Isolation used an archive of the exact starting HEAD with byte-identical changed
SQL/test files and a writable temporary runtime directory. Dependencies were
installed with npm ci and reused; no source changed to bypass workspace/socket
restrictions. The full check stops at its native test failure, so its TS/build
stages did not execute; the independent successful runs are explicitly separate.
No skip, waiver or socket workaround was introduced. Final code/test hashes and
unchanged runtime guards are in the [local receipt](sales-accepted-source-gate-verification-2026-11-03.json).
Only handoff documentation was finalized after the test snapshot.

**Verification handoff BLOCKED in the inner sandbox**, with a reproducible blocker:
`node --test --test-isolation=none web/tests/sales-atomic-postgres.test.mjs`.
The trusted workflow must run the full native suite, actual server concurrency/
cancellation/47k plus new gate fixture, TS/build/inventory/diff with zero failures
or skips on its resulting exact SHA before publishing to the same PR #44. Its
reported D191 base success is not overwritten by this sandbox failure. Codex made
no commit, push, PR, deployment, migration, credential/grant installation, import
or scheduler change. HEAD remains the starting SHA; no new SHA or trusted run URL
is claimed. Do not mark READY FOR GATE/RELEASED. The missing approved attestor/root
is a separate necessary owner-only release action, not a request to pause routine
prepare-only work or to provision anything in this task.
