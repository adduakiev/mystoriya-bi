# Issue #43 / existing PR #44 — D228 disposable pre-first-write decision

**PREPARE ONLY / NOT APPLIED / NOT READY FOR GATE. Native verification BLOCKED
in the inner sandbox.** No production source/root/identity acceptance is claimed.

WORKING was posted first. AGENTS.md was read; initial local HEAD was exactly
`6b3ceaba37355697bbfa599fac2524a26055cad5`, with a clean worktree. The supplied
trusted outer PR/branch/remote check is authoritative. No inner network/auth
check, commit, push, new PR, merge, deployment, source request or migration ran.
HEAD remains that baseline; these are uncommitted candidate changes for the
trusted outer runner, not final exact-SHA PostgreSQL 16/17 acceptance.

## Bounded artifacts and interface

- [Synthetic SQL candidate](../../sql/issue-43-sales-preflight-proof-NOT-APPLIED.sql):
  one new SQL file; explicit NOT APPLIED, transaction/default ROLLBACK, installation
  restricted to `sales_attestor_synthetic` with existing attestor/atomic fixtures.
  Adds one empty private singleton prior-root table and
  `sales_attestor_private.preflight(uuid,jsonb) RETURNS jsonb`. Reuses private
  attestor `targets`, `reviewers`, receipts and immutable-trigger machinery;
  provisions no identities, root contents, source evidence or credentials.
- [Existing native regression](../../../web/tests/sales-prewrite-postgres.test.mjs):
  extended in place, reusing its complete schema, seeded Sales witness, catalog/
  ACL/role/row/sequence snapshots and nontransactional write-attempt triggers.
  Changes its disposable database name to the existing attestor fixture name.
  Preserves the old begin/stage negative control and all four public rejection
  assertions; also snapshots/triggers the added attestor tables.

The administrator-only synthetic fixture pins the entire target JSON and its
PostgreSQL JSONB SHA-256, including this exact binding:

| Field | Synthetic decision contract |
| --- | --- |
| `kind` | `sales-preflight/synthetic-v1` |
| `run_id` | Exact preselected UUID; no reservation or sequence allocation |
| `prior` | Exact active private root's run UUID, receipt SHA-256 and decimal-string generation |
| `base_generation`, `generation` | Current locked warehouse generation and its exact successor, as decimal strings |
| `source_identity` | Literal `synthetic:private-sheet:A:N`; deliberately no production account identity |
| `response_sha256`, `source_sha256` | Exact pinned response-byte and canonical typed-source digests |
| `manifest_sha256`, `warehouse_sha256` | Exact pinned manifest and proposed warehouse digests |

Caller JSON must equal the private target in full; hashes alone confer no trust.
The root must exist, be unexpired, and match both the target and warehouse
version. The actual `session_user` must be an allowlisted safe LOGIN with no
protected-role memberships and an independence group different from the source
producer's group. Caller JWTs, GUCs, reviewer fields, SET ROLE and JSON approvals
supply no identity. Generation, active root and target acquire share row locks
in that order; binding, expiry (`clock_timestamp`) and replay checks run after
locks. Existing import history or attestor receipts, and reuse of the prior
root's run UUID, reject replay before any receipt or reservation is inserted.

A positive result is only `SYNTHETIC_PREFLIGHT_ONLY` with the bound run/digest,
reviewer and generation. Repeating an unchanged observation is allowed and writes
nothing; it does not consume or reserve a run. There is no bearer token, persisted
approval or subsequent write API. Any future first-write implementation must
reauthenticate/recheck all evidence under locks in its own transaction; a result
from this function cannot authorize a later write. READ COMMITTED contention is
the fixture's explicit concurrency contract; no production transaction or other
isolation-level acceptance is inferred.

The private NOLOGIN owner receives SELECT and column UPDATE privilege on the
synthetic generation table solely because PostgreSQL requires UPDATE privilege
for FOR SHARE. A SELECT policy and UPDATE USING policy expose the row to the
lock; UPDATE WITH CHECK(false) forbids actual version changes by that owner.
These narrowly scoped fixture ACLs/policies are not a production ACL proposal.
The old receipt-producing `review(uuid,jsonb)` EXECUTE is revoked from reviewers
in the composed fixture, so it cannot bypass preflight. Public Sales function
bodies are untouched and continue to reject with 55000 (or ACL denial for roles
without EXECUTE); Edge/Next POST 503 and the disabled UI stay unchanged.

## Verification and evidence limits

The extended native test asserts wrong-database rejection before DDL, exact
rollback-default parity, absent/expired/stale root, forged/altered bindings,
wrong generation, nonindependent reviewer, role/membership impersonation, direct
anon/authenticated/service-role attempts, reserved/prior/receipt replay, concurrent
read-only preflights, expiry after a generation-lock wait, and a concurrent
committed generation change. Snapshots must show no preflight write attempts,
including on positive decisions. Explicit fixture seed/perturbation writes are
separate; the race assertion allows exactly the administrator's one generation
update and its one witness increment. These are **assertions prepared for native
execution, not passing native evidence in this sandbox**.

Observed inner results:

- `npm ci --prefix web`: PASS.
- Focused native invocation (`node web/tests/sales-prewrite-postgres.test.mjs`):
  static test passed; PostgreSQL 16.15 startup failed before SQL assertions:
  `could not bind Unix address ... Operation not permitted`. The mandatory native
  test remains enabled; no skip, mocked DB or fallback was added.
- `npm run check`: FAIL (file-level report: 44 pass, 9 fail, 0 skipped).
  Native Sales test processes fail under the socket restriction; Operating test
  processes also cannot create `.agents/runtime` under read-only `.agents`.
  It did not reach its TypeScript/build stages. These are not full-suite passes.
- Separate `tsc --noEmit --project web/tsconfig.json`: PASS.
- Separate optimized `next build` from `web`: PASS, including type validation.
- Source-only focused assertion and `node --check` on the edited test: PASS;
  neither establishes PostgreSQL behavior.
- `git diff --check`: PASS.

A supplemental attempt to inspect SQL with a disposable single-user backend also
failed during database setup; it supplies no SQL/authentication/concurrency proof
and is not a substitute for the mandatory native regression. No production SQL
was executed. The trusted outer runner must run the focused native regression,
full checks and diff check before publication; independent PG16/PG17 runs at the
resulting exact PR HEAD remain required. No final acceptance SHA exists here.

## Genuine remaining STOP gates

The inspected readonly Google capture retains response bytes and canonical typed
cells with separate digests; it explicitly supplies no signature, authentic prior
receipt or historical trust root. This candidate does not turn those hashes into
authentication. No real independent custodians, authenticated historical genesis,
protected source/target provisioning channel or approved identity policy exist.
Live installation is rejected, and an empty synthetic root rejects with 55000.
Fixture provisioning proves no historical recovery or Google access.

Production backup/isolated restore, writer freeze/drain, default-ACL resolution,
reviewed coordinated SQL/Edge release, evidence-bound atomic success, immutable
accepted receipts and source→warehouse→RPC→authenticated UI parity remain separate
owner gates described in the D220 dependency memo. Runtime/migrations and all
public rejection paths are unchanged. No legacy batch/finalize, import, Supabase,
Google IAM/sharing/credentials, scheduler, provider, advertising, SYRVE or business
system action was invoked. The broader issue #43 audit and production correctness
remain unproven; PROJECT-STATUS.md is intentionally unchanged.
