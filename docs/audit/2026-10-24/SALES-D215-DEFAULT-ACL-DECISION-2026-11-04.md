# Issue #43 / PR #44 — D215 default-ACL and writer decision evidence

PREPARE ONLY. **NOT READY FOR GATE / NOT RELEASED.** No remediation option is
selected or authorized by this memo. `SALES_ROLE_STOP_DEFAULT_GRANTS` remains
mandatory, and every SQL draft remains NOT APPLIED.

WORKING acknowledged in the implementation transcript. No GitHub comment, commit,
push or PR action was performed. The clean local branch
`astra/issue-43-40107435112` matched the trigger's immutable
`f73396bfd7ce04a9af78e6ac49386afa034adb95`. Work and checks use an isolated
`git archive` of that exact commit under `/tmp/issue-43-d215-review`; only the
bounded review test and this decision evidence return to the runner workspace.
No remote issue/ref/PR state was independently queried. The trusted outer runner
must verify issue #43, existing open/unmerged PR #44, its branch and expected old
HEAD before publishing, rejecting drift. No sandbox DNS inference is used.

## Evidence and its limits

The authoritative trigger cites [D215](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6621105139):

- `public.fact_sales_daily` and `public.staging_sales_raw` have RLS enabled,
  zero policies, and direct `TRUNCATE` for `anon` and `authenticated`;
  independent `has_table_privilege` returned true.
- Relevant `postgres` and `supabase_admin` default ACLs grant future table
  DML/TRUNCATE, sequence UPDATE and function EXECUTE to those API roles.
- An active Sales sync `cron.job` has schedule `15 4 * * *`; writer quiescence
  is unproven. The job's timezone, execution/in-flight state, transport and SQL
  command are not established by that schedule alone.

These are supplied read-only production findings, **not fresh production reads
by this implementation**. No production function body, cron command, credentials,
business/source rows or remote database was accessed here. An effective database
privilege is a real security boundary risk: RLS does not govern TRUNCATE. It does
not establish an externally reachable exploit. We have not proven an HTTP/RPC/SQL
transport lets an attacker exercise it, nor that either production table could
be truncated independently of its installed FK/trigger/dependency constraints.
No production exploit was attempted. RLS or a possible transport/FK obstruction
cannot substitute for privilege remediation review.

## Independent review of the unchanged draft

[The role-hardening draft](../../sql/issue-43-sales-role-hardening-NOT-APPLIED.sql)
first validates dependencies, exact rejection overlays, role/owner/schema
boundaries and default ACLs. Its default check examines explicit global and
relevant per-schema write/EXECUTE defaults of target relation/function/schema
owners, including PUBLIC and API role memberships. A match raises SQLSTATE
`55000`, message `SALES_ROLE_STOP_DEFAULT_GRANTS`, **before any revoke**.
Later inherited ACL checks also roll back the entire transaction on STOP.
The draft is rollback-default and never alters default privileges or memberships.
It therefore cannot currently pass the supplied D215 state. This is intentional.

Default ACLs apply when their specific creator creates an object; membership in
another role does not by itself select that role's defaults. Global defaults
apply across schemas; `IN SCHEMA public` defaults add to global defaults.
A per-schema REVOKE cannot subtract a global GRANT. Defaults do not retroactively
change existing objects, and revoking existing table ACLs does not fix defaults
for a later recreation. Revoking a caller's table privileges cannot clear table
or column privileges held by a parent role. On PG16, table-level REVOKE also
clears the same grantor's corresponding column grants to that same grantee;
this must not be confused with grants to another role. The draft's explicit
column revokes and inherited checks stay intact. Changing global defaults alone
does not remove existing object grants. Functions additionally have built-in
PUBLIC EXECUTE unless explicitly revoked: removing a named-role grant alone is
not proof of service-only execution.

This draft is a bounded review artifact, not an exhaustive installed security
inventory or an assurance about unlisted owners, views, RPC overloads, dependencies,
future DDL, database/schema CREATE, role changes or all external writers.

## Synthetic regression contract

Only [the existing review fixture](../../../web/tests/sales-role-hardening-postgres.test.mjs)
changes. It requires a fresh disposable native PG instance with TCP disabled,
an explicit local socket, minimal child environment and verified data directory.
No remote connection, production bytes, skip or fallback is added.

| Control | Required assertion |
| --- | --- |
| Fresh FK-free, trigger-free table, RLS ON, zero policies, two known synthetic rows | Both ordinary `anon` and `authenticated` lack BYPASSRLS/superuser, see zero rows under SELECT, but GRANT TRUNCATE allows each to actually empty the table; owner count is zero before rollback |
| REVOKE TRUNCATE on that same table | Effective privilege false; identical plain TRUNCATE fails with exact `42501` permission denial; owner reads exact original rows and all Sales row/sequence parity remains unchanged |
| Inherited TRUNCATE | Direct table REVOKE does not remove parent-role privilege; actual TRUNCATE succeeds transactionally; revoking the parent's grant denies the same statement |
| Inherited column UPDATE | Direct table REVOKE against the caller leaves a parent-role column grant; table UPDATE privilege false while column privilege true; valid UPDATE changes a row under explicit synthetic RLS policies; revoking the parent's column grant makes the same UPDATE fail with `42501` |
| Future defaults: two synthetic relevant owners × global/public scope × anon/authenticated × tables/sequences/functions (24 combinations) | Actual future object inherits each configured privilege; existing Sales TRUNCATE grants remain absent; object-level revoke does not remove the future default; unchanged draft still gives exact `55000` STOP; defaults, all recorded ACLs and Sales rows/sequences remain identical after rejection |
| Global GRANT plus public-schema REVOKE | New table still inherits global TRUNCATE and the draft still STOPs |
| Cleanup and existing regressions | Exact prior default ACLs and recorded object ACLs restored; draft replay remains idempotent; existing inherited/NOINHERIT/column/sequence/RPC/owner hazard controls retained |

Synthetic roles represent creator-specific semantics; they do not impersonate or
alter installed `postgres`/`supabase_admin`. Positive TRUNCATE and UPDATE controls
roll back and preserve exact immutable readback. Default propagation creates
and drops local synthetic objects only. The column test's permissive policies
are confined to its disposable probe; they are not proposed production policies.

## Explicit design choices — owner/security decision required

| Choice | Scope and necessary design evidence | Gate and limitation |
| --- | --- | --- |
| Retain STOP and defer changes | Leave all drafts uninstalled; collect authorized redacted catalog/dependency/writer evidence and a reviewed plan | Current state. No Sales release or claim of remediation; identified privilege risk remains unresolved |
| Separately designed Sales-only hardening | Revoke reviewed existing Sales table/column/sequence/RPC privileges without changing unrelated defaults. Specify every creator, membership/SET ROLE path, ownership boundary, recreation/future-DDL path and how privilege reintroduction is prevented; include atomic ACL verification, rollback and compatibility tests | Kostiantyn plus security reviewer must explicitly approve the precise scope and treatment of remaining defaults. This would be a separately reviewed design, **not** deletion/allowlisting/bypassing of today's STOP. Object revokes alone do not solve future grants; no safe exception is presumed. If isolation cannot be demonstrated, retain STOP |
| Wider schema/default-ACL policy | Separately inventory all relevant creators, global/per-schema defaults, PUBLIC grants, existing objects, functions and sequences; map effects on unrelated consumers/integrations and test replacement least-privilege rules and rollback | Explicit wider Kostiantyn/security approval, compatibility acceptance and maintenance/quiescence plan required. Removing defaults may break unrelated consumers; leaving built-in PUBLIC EXECUTE or existing ACLs can preserve exposure. No global migration is prepared or claimed safe here |

Do not silently choose a schema-level REVOKE as a global fix, grant API roles
new memberships, move owners, disable RLS, add permissive production policies,
mask inherited privileges, or execute any supplied remediation against production.
The separate design must state which future-object boundaries it can actually
guarantee; monitoring alone is not prevention. Security approval of a design
does not authorize execution, migration or release.

## Writer quiescence is a separate, unmet gate

The reported active cron writer means no writer freeze can be inferred from
code, RLS or these tests. An authorized operator must first inventory all writer
identities and entry points using redacted metadata: scheduled/queued/in-flight
cron/network work, legacy batch/finalize, manual/Edge/API callers, direct roles
and external clients. Do not inspect or publish cron SQL commands or secrets.

Kostiantyn must separately approve the exact maintenance window, operator,
writer/schedule actions, draining/cancellation criteria, rollback/resume plan
and a final consistent checkpoint. Only that later authorized procedure may
quiesce writers. Require redacted evidence of no active, queued or retryable
writes, stable generation/facts/import metadata, and controlled DDL/ACL changes
throughout the checkpoint and cutover. A sample of stable counts or a disabled
timer alone cannot prove drained external requests. No cron inspection or change,
writer invocation, legacy finalize, import, backup/restore or migration occurs here.

Historical source attestation, server-only private Google credentials/auth wiring,
real backup/restore, compatible SQL+Edge deployment and authenticated
source→warehouse→RPC→UI parity remain CLOSED. This narrow task changes none of them.

## Verification and handoff

Native PostgreSQL 16 and independent PostgreSQL 17 acceptance are mandatory; a restricted inner
sandbox failure is not a trusted outer-runner result. No completion or release
claim is permitted without both. Existing exact-SHA Actions jobs already sequence
PG16 then PG17; the workflow is unchanged.

Supplemental diagnostics used PostgreSQL 16.15 standalone mode against a fresh
disposable local cluster, regular-file SQL input and a temporary adapter under
`/tmp` only. The final diagnostic exercised 1,305 SQL calls through the fixture's
ACL, default-propagation, STOP and row/sequence checks. It exposed and corrected
the probe's initial same-grantee column-grant assumption and the cleanup snapshot
being captured after a temporary schema grant. The final diagnostic completed
without SQL/assertion failures. **Standalone PostgreSQL disables RLS**: its copy
omitted the RLS-hidden-row assertion, so this is NOT a native fixture pass or
proof of RLS behavior, psql formatting, server startup or PG17 parity. The
handoff fixture retains that mandatory RLS assertion, no adapter,
skip or fallback; the temporary diagnostic file is not part of the handoff.

| Check in the isolated exact-base archive | Result on 2026-11-04 |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages; lockfile unchanged |
| Final `npm run check` | **FAIL: 47 test files PASS / 5 FAIL / 0 SKIP**; the same five Sales native fixture startup failures. TypeScript/build stages not reached by this command |
| Final focused five native Sales files, `node --experimental-strip-types --test --test-isolation=none …` | **4 PASS / 5 FAIL / 0 SKIP**; atomic fixture cannot create loopback listener (`EPERM`); attestor, restore, rehearsal and role fixtures cannot bind Unix sockets (`Operation not permitted`), before their native assertions |
| Independent `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS |
| Independent `node node_modules/next/dist/bin/next build` in `web/` | PASS; optimized production build, 15 static pages generated |
| `node scripts/bi-audit-inventory.mjs --check` | PASS; 22 pages, 7 API routes, 758 static visual/control templates; production parity UNKNOWN |
| `node --check web/tests/sales-role-hardening-postgres.test.mjs` | PASS |
| Workspace `git diff --check`, new-file whitespace and isolation/workspace byte parity | PASS; only the existing review fixture and this memo differ from the pinned base |

Focused native failure reproduction:

```sh
node --experimental-strip-types --test --test-isolation=none \
  web/tests/sales-atomic-postgres.test.mjs \
  web/tests/sales-attestor-postgres.test.mjs \
  web/tests/sales-backup-restore-postgres.test.mjs \
  web/tests/sales-rehearsal-postgres.test.mjs \
  web/tests/sales-role-hardening-postgres.test.mjs
```

Only PostgreSQL 16.15 is installed locally. No independent PG17 result or
trusted-outer/post-push result is available. Supplemental checks do not satisfy
either mandatory native gate. Full-check failures stop its TypeScript/build
stages; independent results above are separate evidence, not a green full check.
Temporary logs, clusters, adapters, runtime files and dependencies remain outside
the handoff.

The trusted runner owns publication to **same PR #44 only**, without merge or
deployment, subject to expected-old-HEAD/drift checks. Both sequential post-push
jobs must report 0 FAIL / 0 SKIP on the exact resulting SHA. No new PR, forced
push, remote recovery action or GitHub settings change is performed here.

Unchanged draft SHA-256:

- Role hardening: `82588c8b893b4cb4116b2264e900719bf27f6314efb111656880edbf05b923a6`.
- Read-only preflight: `0d13d38a662e6d913fa3d3e06f3029a9a05a0dfd672c0232949144d18025e245`.

**BLOCKED — native verification in the restricted inner sandbox; NOT READY FOR
GATE / NOT RELEASED.** No production security remediation, writer quiescence,
source recovery, private-auth activation or release has been implemented.

## Independent trusted-outer/post-push verification addendum — 2026-11-04

This addendum records evidence obtained **after** the restricted implementation
sandbox produced the historical handoff above; it does not reinterpret that
sandbox's socket/loopback failures as test passes. The trusted outer [Astra
run 41762712487](https://github.com/adduakiev/mystoriya-bi/actions/runs/41762712487),
job 126353862063, independently ran the candidate on native PostgreSQL 16.15:
**577/577 PASS, 0 FAIL, 0 SKIP**, TypeScript and Next.js optimized build PASS.
It fast-forwarded one commit, `38dc079fb3ea5d6efac768721d95b39ab036aee0`,
into the same open/unmerged PR #44; exactly this memo and the disposable-only
role fixture changed. No Production access or mitigation is established by that.

At independent follow-up, GitHub's Actions run inventory contained **no
post-push run for that exact commit**; therefore the mandatory immutable-head
PG16→PG17 acceptance remained **UNVERIFIED**, regardless of the outer candidate
pass or green Vercel status. This documentation-only append is intended to
cause the existing unchanged push workflow to execute on its **new exact SHA**.
It is a trigger, **not** proof that the run started or passed: a reviewer must
independently identify the resulting workflow run, verify checkout equals its
`GITHUB_SHA`, PostgreSQL 16 and 17 native executions each have **0 FAIL / 0 SKIP**,
then check that the PR still points to that same SHA. No second Astra job is
requested. Any absence or failure stays a STOP.

**Production gate remains CLOSED.** In particular, live default ACLs still
raise `SALES_ROLE_STOP_DEFAULT_GRANTS`; no default-grant exception, permission
migration, writer quiescence, server credential provisioning, backup/restore,
Edge cutover, import, source attestation, or UI parity has been authorized or
performed as part of this addendum.
