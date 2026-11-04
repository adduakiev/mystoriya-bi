> **D235 trusted-outer reconciliation (2026-11-04, ~20:05 UTC):** The original D234 report below records the *Codex inner sandbox*, where native tests could not bind sockets. Independently inspected the actual trusted OUTER [Astra run 41900350186](https://github.com/adduakiev/mystoriya-bi/actions/runs/41900350186), job 126820763206: native PostgreSQL **16.15**, full `npm run check` **602/602 PASS, 0 FAIL, 0 SKIP**, protected synthetic `pg_dump/pg_restore` and RLS negative control PASS, TypeScript/optimized Next build and `git diff --check` PASS. The trusted outer runner verified starting PR HEAD `c2731a4216f0d1b00aa6a080c77fcaf4b70a126a`, then published precisely the six D234 candidate files at **`78c02fbafb88bae84177b5e1b077db3ef3e34d05`** in this SAME open, unmerged PR. Vercel status for that published SHA: SUCCESS. There is **NO independent exact-published-SHA PostgreSQL 16+17 run** yet; GitHub-token-originated push did not create one. This documentation-only correction is intended to trigger the already-existing `push` acceptance workflow; the new final SHA must be checked separately in BOTH PostgreSQL majors before any next gate is accepted. This synthetic draft is **NOT a real authorized Sales importer**, and the production historical genesis/independent attestor, credential, backup, Edge deployment, and authenticated QA gates remain closed. **NO Production changes. NOT READY FOR GATE / NOT RELEASED.**

# Issue 43 / PR 44 — D234 bounded reconstruction

**BLOCKED for native acceptance. NOT READY FOR GATE / NOT RELEASED / SQL NOT APPLIED.**

Initial local HEAD was exactly `c2731a4216f0d1b00aa6a080c77fcaf4b70a126a`, with a clean worktree. The issue's trusted outer PR-open/branch/head verification was accepted; no inner GitHub/DNS check was attempted. These are uncommitted workspace changes for the existing PR only. No prior uncommitted D232 patch was needed or claimed recovered.

Changed files:

- `docs/sql/issue-43-sales-release-v234-NOT-APPLIED.sql`: uniquely versioned, rollback-default **disposable synthetic** transaction draft. Reuses warehouse schema/runtime definitions, private generation, canonical cents/alias tuples and the independent-LOGIN attestor draft. Creates only its private namespace, leaving existing public function bodies, owners and grants intact.
- `supabase/functions/sync-google-sheet/prepared-sales-release-v234.mjs`: private, opt-in server preparation adapter. Reuses readonly OAuth capture, paginated baseline reader and Ed25519 provenance verifier. Snapshots trusted policy, aliases and evidence. Two matching signed observations still return BLOCKED; `release()` always rejects before I/O. No DB writer or runtime integration exists.
- `web/tests/sales-release-v234-postgres.test.mjs`: mandatory native PG16/17 fixture with ephemeral SCRAM principals, prewrite parity, exact amounts, rollback, competing sessions and source-stopped native dump/restore. Uses repository schema rather than a simplified replacement. No skips or socket substitutes.
- `web/tests/prepared-sales-release-v234.test.mjs`: signed synthetic observations, pin/credential/server boundaries, changed capture, forged signature, cancellation, no DB POST and no runtime references.
- `web/tests/prepared-sales-cutover.test.mjs`: narrowly permits composition by this named private adapter; the new adapter test scans all active runtime directories and forbids imports of the adapter. All other runtime restrictions remain.

The transaction model authenticates its fixed disposable caller and requires protected pinned authority/root plus two distinct PostgreSQL reviewer LOGIN receipts before reserving `import_runs` or staging. It validates the full manifest, exact numeric precision, completed Kyiv cutoff, source binding, current generation, alias resolution, canonical uniqueness and every historical identity. Only then does it stage and write dimensions/facts, refresh all three MVs, verify readback, and atomically record immutable history/receipt and generation. An identical latest-generation retry returns the immutable receipt without writes; competing distinct runs and older receipts fail stale. There is no old batch/finalize call or fact deletion.

New fact IDs are allocated explicitly under the fact-table lock, without `nextval`/`setval`. This permits exact sequence-state rollback even after inserting new facts. It deliberately leaves the identity sequence unchanged. This is a synthetic design choice requiring separate review of future authorized writers and identity allocation before any production implementation; it is not permission to enable a legacy writer.

The restore fixture models a **disposable-only** `NOLOGIN BYPASSRLS` MV owner (`sales_restore_operator`) with explicit SELECT grants, and a separate fixture superuser restore session. No production role or RLS policy is modified. A rollback-only negative control removes that fixture role's bypass and requires native MV refresh to reproduce the RLS failure. The protected restore retains owners, ACLs, RLS flags, rows, sequences and receipts; it uses neither `--no-owner` nor ignored restore errors. These native assertions are prepared, **not locally proven**.

Verification on 2026-11-04:

| Check | Observed result |
| --- | --- |
| `npm ci --prefix web` | PASS, 71 packages; lockfile unchanged |
| Focused adapter + cutover + provenance (`node --test --test-isolation=none ...`) | PASS: 29 tests, 0 failures, 0 skips |
| Five focused preparation test files with normal process isolation | PASS: 5 files, 0 failures, 0 skips |
| Native v234 test (`node --test --test-isolation=none web/tests/sales-release-v234-postgres.test.mjs`) | FAIL: static boundary test passes; native startup fails before server subtests, Unix socket bind `Operation not permitted`; 1 pass / 1 fail / 0 skips |
| Supplementary disposable PG16.15 single-user diagnostic | PASS: draft installation, exact cents, promotion and identical retry. Not authenticated LOGIN, concurrent server or native restore acceptance; temporary diagnostic not committed |
| `npm run check` | FAIL: 46 file passes / 10 file failures / 0 skips. Three existing agent/Operating tests require writes to sandbox-readonly `.agents/runtime`; seven native Sales files require prohibited local sockets. TypeScript/build stages therefore not reached by this command |
| Independent TypeScript `tsc --noEmit` in `web` | PASS |
| Independent optimized `next build` in `web` | PASS |
| `git diff --check` | PASS |

The native blocker reproduces with the command above. PG16.15 logs `could not bind Unix address .../.s.PGSQL.5432: Operation not permitted` and `FATAL: could not create any Unix-domain sockets`. No test was skipped or converted to a single-user acceptance test. A prior runtime-import scanner regression introduced during composition was fixed and the focused suites rerun successfully.

Production success remains intentionally sealed: there is no owner/reviewer-approved independent historical genesis or real immutable accepted-source receipt chain, approved pinned signer policy, or authenticated production attestor channel. The draft's roots/receipts are labelled OFFLINE SYNTHETIC ONLY and can never stand in for historical source evidence. The adapter's cryptographic observations do not provision or approve any root; the SQL model does not claim to authenticate real Google bytes or Ed25519 signatures. A real signature-verification-to-DB attestor bridge remains unimplemented pending that policy. Client JSON/JWT/service_role/SET ROLE cannot open a production path. No fixture result proves production data correctness.

Remaining distinct gates:

1. Trusted outer runner must recheck existing PR 44 OPEN/head against the expected SHA, run full PG16 checks with zero failures/skips on the final candidate, and alone handle any commit/push. Inner sandbox results do not waive this gate.
2. Post-commit PG16 → PG17 verification of the **same exact committed SHA** remains mandatory and NOT PERFORMED. No candidate commit SHA or successful runner result is asserted here.
3. Owner/reviewer approval of authentic historical prior-root/genesis or an existing accepted receipt, pinned signer/identity/project policy, private access and a separately authenticated production attestor. No root was fabricated to bypass this blocker.
4. Separate review and owner gates for a production transaction/attestor implementation, identity allocation, protected restore/backup evidence, migration execution, deployment and first import. This fixture-only SQL is not a migration to apply to production.

Edge/Next POST 503, disabled refresh UI and private Sheets remain unchanged. No production/staging SQL, Google HTTP probe, import, manual refresh, production backup, workflow edit, credential change, scheduler, ad/SYRVE/business write, commit, push, new PR, merge or deployment was performed. Historical audit/status claims were left unchanged because no new live evidence was obtained.
