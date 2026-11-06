# Issue #43 / existing PR #44 — bounded Sales role/grant retry

PREPARE ONLY. NOT READY FOR GATE. SQL NOT APPLIED. Native verification BLOCKED locally.
WORKING acknowledged in the implementation transcript; no GitHub comment posted.
Clean branch `astra/issue-43-40107435112` and exact starting HEAD
`3ea0d0154282d6365e5cea81041ef2ee0378d2a4` verified locally before edits.
No remote ref was queried; comparison is against the trigger's pinned SHA. A git worktree was denied by the
read-only `.git` mount; implementation/initial checks use an isolated archive of
that exact HEAD at `/tmp/issue-43-sales-role-review`, then identical files are
copied to the runner workspace. No commit/push/new SHA is created by Codex.

The trigger reports trusted Actions 41586954961 / outer job 125754581498 FAILED:
530 tests, 528 PASS, 2 FAIL, 0 SKIP. Its GENERATED ALWAYS `id` UPDATE failed
validation before ACL evaluation. That was a real test defect, independent of
this sandbox's socket restriction. The uncommitted failed candidate is unavailable
at the pinned HEAD; this retry recreates only its specified bounded scope.

## Review artifacts and assertions

- [Hardening draft](../../sql/issue-43-sales-role-hardening-NOT-APPLIED.sql):
  separate transaction, rollback by default, requires both atomic and exact
  rejection-only overlays. Revokes direct/PUBLIC table and independent column
  writes on 12 public Sales tables, three private staging/generation tables,
  flat view and three caches; removes owned-sequence USAGE/UPDATE, private-schema
  access and legacy batch/finalize/refresh/manual-trigger EXECUTE. SELECT and
  owner SECURITY DEFINER reservation/staging paths remain. No new EXECUTE grant,
  function body, owner, role, membership, RLS policy or default ACL is installed.
- Inherited permissions (including NOINHERIT memberships usable via SET ROLE),
  owner/elevated memberships, schema CREATE, relevant explicit global/per-schema
  write/EXECUTE defaults, missing dependencies, unexpected RPC overloads or an
  ungated commit body produce a transactional `55000` STOP. The draft does not
  broaden its scope by changing unrelated memberships/default grants.
- [Read-only preflight](../../sql/issue-43-sales-role-preflight-READ-ONLY.sql):
  catalog-only role/membership/owner/RLS/effective table/column/sequence/RPC ACL,
  default-grant and trigger metadata; no function bodies, cron SQL, credential
  values or business/source rows. NOT executed against production.
- [Native regression suite](../../../web/tests/sales-role-hardening-postgres.test.mjs):
  local binaries and fresh socket/data directory, TCP disabled, minimal environment,
  no remote URLs, skip or fallback. Repository schema/functions and synthetic rows
  only. All 15 mutable tables have valid INSERT/UPDATE/DELETE positive controls
  before REVOKE, with writable non-identity columns and valid constraints/FKs.
  The same probes must then fail with psql-extracted SQLSTATE **42501**, independently
  of effective `has_table_privilege`/`has_column_privilege` assertions and complete
  row/sequence parity after each denial. Identity/constraint errors cannot pass.
  Private table ACLs are also tested with temporary fixture-only schema USAGE.
  Tests cover RLS+BYPASSRLS, PUBLIC/explicit/column grants, rollback default,
  idempotent replay, STOP/transaction rollback hazards, legacy/manual denial,
  forged evidence rejection and service-caller/owner-definer staging without promotion.

## Evidence limits and remaining gates

The 2026-11-03 05:55 UTC installed-grant finding (service_role BYPASSRLS + Sales
DML, legacy SECURITY DEFINER writers and anon manual trigger), fact 46,286 through
2026-10-26 and Edge v8 gviz 401 are **trigger-supplied observations**, not fresh
reads here. Warehouse rows do not authenticate historical Google source evidence.
Preflight must be reviewed for unknown views, functions/overloads, owners,
external writers and jobs; this bounded draft is not proof of every installed
Supabase permission. Concurrent DDL/default/role changes require quiescence and
separate approved design. Default-grant STOP is intentional where Sales-only
revocation cannot safely change global policy. PostgreSQL 16+ is required.

Historical accepted_source_v1, independent attestor/trust root, runtime private
Google authentication, real production backup plus verified restore, writer
quiescence and coherent SQL/Edge release remain separate unmet owner gates.
The private OAuth reader stays UNWIRED, both preview handlers stay unconditional
503, and the original evidence overlay continues to reject ALL evidence.
No production reads/imports, old writer calls, migration/deployment, credentials,
scheduler/provider/ad/SYRVE changes, business writes or broader Digital/UX work.
No automatic next task. Runner owns verification and publication to the same PR.

## Verification

| Check | Actual local result |
| --- | --- |
| `npm ci --prefix web` | PASS in workspace and isolated archive; 71 packages; lockfile unchanged |
| Focused native test (`node --test --test-isolation=none web/tests/sales-role-hardening-postgres.test.mjs`) | 1 PASS / 1 FAIL / 0 SKIP; static contract passes; PostgreSQL 16.15 Unix socket startup fails `Operation not permitted`, before native assertions |
| Final isolated `npm run check` | FAIL: 45 test files PASS / 3 FAIL / 0 SKIP; Sales atomic, backup/restore and role-hardening server files cannot run in this sandbox |
| Workspace `npm run check` | FAIL: 42 test files PASS / 6 FAIL / 0 SKIP; same three Sales server files plus `.agents/run.test.mjs`, `operating-tasks` and `operating-v2` blocked by protected `.agents/runtime` |
| Supplemental disposable native single-user SQL validation | PASS: 740 SQL calls through the same generated fixture, DML, ACL/parity, owner-path and STOP assertions with a temporary single-user adapter; NOT a PASS of the committed psql/socket suite |
| Independent TypeScript `--noEmit` | PASS |
| Independent optimized Next production build | PASS |
| `node scripts/bi-audit-inventory.mjs --check` | PASS: 22 pages, 7 API routes, 758 templates; production parity UNKNOWN |
| Test syntax, `git diff --check`, new-file whitespace, isolated/workspace code parity | PASS |
| Existing atomic/evidence SQL, Next/Edge guards, AGENTS.md, workflow | Byte-identical to starting HEAD |

Full checks stop at test failure, so their TS/build stages do not execute.
Independent TS/build results are separate evidence on identical application
sources; final later edits affected only test assertions and documentation.
The supplemental validator stayed under `/tmp`, uses fresh synthetic PostgreSQL
16.15 data and regular-file single-user input, and changes neither the repository
suite nor runner command. It helped catch and correct a fixture-only non-idempotent
overlay recreation; the final test restores only the existing commit function
body when testing overlay removal. No existing SQL draft was edited.
It does not verify psql formatting, server startup or the full native suite.

The outer runner must run the focused suite and full `npm ci --prefix web &&
npm run check`, inventory and whitespace checks without failures/skips. Its
previous FAILED run cannot clear this candidate. Local logs remain temporary,
not committed runtime artifacts. Candidate code SHA-256 values:


- `docs/sql/issue-43-sales-role-hardening-NOT-APPLIED.sql`: `82588c8b893b4cb4116b2264e900719bf27f6314efb111656880edbf05b923a6`
- `docs/sql/issue-43-sales-role-preflight-READ-ONLY.sql`: `0d13d38a662e6d913fa3d3e06f3029a9a05a0dfd672c0232949144d18025e245`
- `web/tests/sales-role-hardening-postgres.test.mjs`: `4b70ea103ac7e16782dedbac1c04f154efb6bea1803e2450b4a646ad4cf48c76`

**BLOCKED — local native server verification; NOT READY FOR GATE.** Reproduce
with the focused command above. No trusted outer retry result is available in
this session. Leave the candidate uncommitted unless runner verification passes;
only the runner may publish it to existing PR #44. There is no new commit SHA,
pre-commit green gate, post-commit check, SQL installation or production proof.
