# Issue #43 / existing PR #44 — synthetic attestor TRUNCATE retry

WORKING acknowledged in the implementation transcript. PREPARE ONLY; SQL NOT
APPLIED. **BLOCKED on native multi-LOGIN/server verification; NOT READY FOR GATE.**

Exact clean starting HEAD: `47c274cf02a9bcbe63ca4eb25c8911a128720c1b`, branch
`astra/issue-43-40107435112`. Implementation used an isolated `git archive` of
that exact SHA at `/tmp/issue-43-attestor-review`; resulting scoped files were
copied back byte-identically. No commit or resulting new SHA exists in Codex.
No GitHub comment, remote-ref probe, push, new PR or workflow change was made.
The trusted runner must independently verify PR #44 remains open/unmerged, branch,
exact checkout/pushed SHA and fast-forward ancestry before publishing anything.

## Evidence and bounded reconstruction

The trigger reports trusted outer [run 41692514617](https://github.com/adduakiev/mystoriya-bi/actions/runs/41692514617),
job 126114443665, **563 total / 561 PASS / 2 FAIL / 0 SKIP**: one failed subtest
plus its parent. Its reported failure expected `42501` for plain `TRUNCATE
sales_attestor_private.receipts`; native PostgreSQL first rejects the referencing
FK with `0A000`. [D207](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6612753987)
is trigger-linked forensic evidence, not independently fetched here. That run is
FAILED evidence, not approval or a result for this candidate. Its uncommitted
draft is absent at the pinned HEAD and in available workspace artifacts. This is
a bounded reconstruction from the existing PR sources and supplied forensic
contract, **not a recovered or byte-equivalent copy of the failed artifact**.
Its future native test total must be recorded independently, not assumed to be 563.

Only the synthetic trust-boundary/receipt draft, regression suite and audit
evidence are prepared. Data Gap, Digital, runtime Google auth and Sales cutover
remain queued. Existing atomic/rejection/hardening SQL, deployed code, production
runners, application code, AGENTS.md and workflow are unchanged.

## Draft boundary

- [Standalone rollback-default SQL](../../sql/issue-43-sales-attestor-NOT-APPLIED.sql)
  refuses any database except `sales_attestor_synthetic`, existing schema,
  missing/elevated/inappropriate LOGIN roles, reviewer/owner memberships or
  unreviewed default ACLs. It creates no role, membership, credential, first-run
  root, public RPC, Sales success branch or production binding.
- `sales_attestor_private` has a NOLOGIN owner and empty protected reviewers and
  exact-target policy. Only the disposable fixture provisions synthetic policy,
  prior-root reference, generations, source/raw-count/date/manifest hashes,
  canonical identity/exact-cent rows and full aliases/hash. Caller JSON cannot
  provision policy or authenticate a source. SQL pins the complete JSONB binding
  and its database SHA-256; this is a synthetic DB trust-boundary experiment, not
  verification of Google source bytes, signatures or a historical trust chain.
- Separate actual `-U sales_reviewer_a` / `-U sales_reviewer_b` LOGIN connections
  call an owner SECURITY DEFINER function with `search_path=pg_catalog` and fully
  qualified objects. Identity is `session_user`, never a supplied observer ID,
  service-role JWT, `SET ROLE`, or `current_user` of the definer. `service_role`
  stays NOLOGIN; reviewers have no memberships or table privileges. Each caller
  can read only its own immutable receipt. Distinct protected independence groups
  and matching target bindings are required for the FK-linked accepted review.
- Target row locks serialize independent reviews and retries; duplicate same-user
  calls return the exact original receipt. Changed/expired/unknown targets fail
  with `42501`. Both receipts and accepted review roll back on transaction error
  or cancellation. No Sales generation, facts or accepted_source_v1 is promoted.
  ALWAYS triggers reject UPDATE/DELETE/TRUNCATE with `42501` and exact message
  `SALES_ATTESTOR_IMMUTABLE`; reviewers cannot disable them. Administrative DDL
  remains inside the trusted fixture/owner boundary, not an attacker capability
  the draft claims to eliminate.

## Regression gate

[Native suite](../../../web/tests/sales-attestor-postgres.test.mjs) uses minimal
environment, TCP disabled, fresh local sockets/data directories, explicit LOGINs,
synthetic rows and native PostgreSQL tools only. No skip, fallback, production
URL, inherited PG environment, credentials or network probe is introduced.

The receipt subtest now checks independent layers:

1. Plain `TRUNCATE receipts` must fail with SQLSTATE **0A000** because of the FK.
   This is dependency evidence only, never proof that the immutable trigger ran.
2. `TRUNCATE receipts CASCADE` must fail with **42501** and the exact immutable
   error. Any mismatch or success fails the gate.
3. A further CASCADE probe temporarily disables only the child's immutable guard
   inside a transaction. The receipts guard must independently reject it; child
   immutability cannot mask a missing receipts guard. Disconnect on error rolls
   back the temporary DDL.

After **each** denial, compare complete SHA-256 content digests and counts for
every fixture relation/sequence, including both receipts, targets, reviewers and
all FK-linked accepted-review rows, plus exact catalog/owner/effective ACL state.
The actual-bypass negative control disables both guards inside a rollback-only
transaction. Plain TRUNCATE still must report `0A000`; CASCADE then actually
clears receipts **and** linked rows (`0|0`). The same `42501` assertion must fail
on that real successful bypass. Rollback must restore exact content and triggers,
and both positive denial gates run again. No assertion is relaxed or skipped.

The suite also asserts rollback-default/pre-existing object/role/grant/data
preservation; actual SQLSTATE access denials; forged binding fields; deterministic
receipt rehash/readback; concurrent two-LOGIN/idempotent retries; transaction
failure/cancellation; native source-stop `pg_dump`/`pg_restore` to a fresh cluster;
complete restored row digests/counts, owners, definitions and **effective** table,
column, sequence, schema and function ACLs by role names. No raw `relacl` or OID
comparison is used for restore. Restored receipt/immutability and closed public
promotion paths are rechecked. These are assertions awaiting native runner proof.

## Actual local verification

| Check | Result |
| --- | --- |
| `npm ci --prefix web` | PASS in workspace and isolated archive; 71 packages, lockfile unchanged |
| Final focused four native Sales files with `--test-isolation=none` | **3 PASS / 4 FAIL / 0 SKIP**; atomic loopback `listen EPERM 127.0.0.1`; attestor, backup/restore and role-hardening Unix socket `Operation not permitted`, before native assertions |
| Isolated full `npm run check` | **47 test files PASS / 4 FAIL / 0 SKIP** (51 total); same four native server files fail; TS/build stages not reached |
| Independent `tsc --noEmit` | PASS |
| Independent optimized `next build` | PASS |
| Inventory generator `--check` | PASS: 22 pages, 7 API routes, 758 static templates; production parity UNKNOWN |
| Supplemental disposable PostgreSQL **16.15** single-user validation | PASS: draft installation, exact catalog rollback/pre-existing preservation, native FK `0A000`, independent receipt-trigger `42501`, actual bypass with rollback. **Not a pass of the native multi-LOGIN/concurrency/dump/restore suite** |
| Contract/query generators `--check` | PASS: 6 static KPI contracts, 35 prepared diagnostics; RPC/SQL execution 0 |
| Final syntax / workspace `git diff --check` / new-file whitespace / archive-copy parity | PASS |

The supplemental validator is temporary under `/tmp`; it uses regular-file
single-user input and owner-inserted synthetic receipt witnesses. It does **not**
impersonate reviewers, replace the committed native suite, prove authentication,
run concurrency or perform a dump/restore. It caught a draft-only PL/pgSQL record
alias ambiguity, which was corrected before final validation. The final focused invocation uses the final test code; receipt assertions remain
NOT EXECUTED because server startup failed.
Machine-readable [verification receipt](sales-attestor-truncate-verification-2026-11-03.json)
records code hashes and evidence limits. Logs/database files stay temporary.

## Handoff and remaining gates

The outer runner must run PostgreSQL **16.15**, full `npm ci --prefix web && npm
run check`, generators and whitespace checks with **0 FAIL / 0 SKIP**, independently
validate exact resulting SHA and scoped files, and only then publish to the same
existing PR #44. A test failure forbids commit/push. This sandbox's `EPERM` is not
evidence that the trusted outer native run failed; the supplied 561/563 result
is a separate actual failed test, and a fresh trusted result is still required.

Owner-approved authentic root/policy, truly independent production identities,
private Sheets credential/probe, real source closure, production backup/restore,
writer quiescence, SQL/grant installation and coherent release remain unmet.
No live read/auth probe, Google discovery/sharing, import, legacy batch or
finalize invocation, migration, credential/Vault operation, scheduler/provider,
SYRVE/Ads write, deployment, commit/push/merge or GitHub mutation was performed.
Both runtime 503 guards and rejection-only SQL remain intact. Trigger-reported
production 46,286 facts through October 26 and ACTIVE v9 unsafe CSV handler are
not new observations here. **No Sales recovery or broad audit completion claim.**

## Independent trusted outer-runner reconciliation — 2026-11-03 19:10 UTC

This appendix is a **subsequent external verification**, not a rewrite of the
restricted inner sandbox's truthful failed checks reported above. Independently
inspected GitHub [Astra Actions 41698505943](https://github.com/adduakiev/mystoriya-bi/actions/runs/41698505943),
outer trusted job `126135278833`, after Codex handoff:

- Outer runner's actual native PostgreSQL 16.15 `npm run check`:
  **564 tests / 564 PASS / 0 FAIL / 0 SKIP**. The new synthetic attestor
  multi-LOGIN/concurrency, FK `0A000`, immutable `42501`, negative bypass,
  rollback and source-stop `pg_dump/pg_restore` ran and passed. Existing 47k
  atomic, role-hardening/42501, backup/restore tests also passed; TypeScript,
  Next build and `git diff --check` passed.
- Outer trusted runner committed/pushed the candidate code and evidence to the
  **same** open/unmerged PR #44, commit
  `306bb3084224d39bf1d5708ef0b26b7c87a2ad60`. Independent GitHub
  compare to `47c274cf02a9bcbe63ca4eb25c8911a128720c1b`: one commit
  ahead, zero behind, exactly six scoped SQL/test/audit files.
- The original inner handoff saying "no commit" reflects its narrower sandbox
  context, and the original "blocked on outer tests" is now superseded **only
  for this isolated candidate** by the trusted runner evidence above.
- GitHub's automatic token push did not yield a separately verified post-push
  exact-SHA native Actions run on `306bb308...`. This documentation-only
  reconciliation commit is intended to trigger that independent check. Until
  it completes, **no exact-new-SHA CI pass is claimed**.

**PREPARE ONLY; NOT READY FOR PRODUCTION GATE / NOT RELEASED.** This validates
only the rollback-default **synthetic** attestor trust boundary. No
historical independently authenticated accepted-source root, approved live
reviewer policy, live server-only Google Sheets credentials/probe,
production backup+restore, SQL/Edge coordinated cutover, Sales import or
source→warehouse→RPC→authenticated UI parity has been accepted. SQL remains
NOT APPLIED; no production mutation, new PR, merge, credential or scheduling
change.
