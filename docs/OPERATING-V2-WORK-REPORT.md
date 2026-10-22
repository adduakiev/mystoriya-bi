# Digital Operating Layer v2 — ready for release audit

Baseline `800b3ce9d9e062daf907825fd67fdadc11154a7c`; branch `feature/digital-operating-v2`. v1 production is LIVE. No new commit/push/PR, production changes, migration execution, scheduler, SYRVE integration or external LLM calls.

## Validation results

- **45/45 tests PASS** after Barbara's two-blocker review: previous 42 test cases retained, privilege assertion updated to explicit-REVOKE contract, three new static latest-run regressions added.
- **TypeScript PASS; Next.js optimized production build PASS**, exit 0. `/api/operating/runs` included as a dynamic Node route.
- Current Barbara follow-up verification: `node scripts/check.mjs` PASS end-to-end: 45 tests, TypeScript, optimized Next.js build, exit 0, 15/15 static pages. No permission retry needed this round. Existing Node MODULE_TYPELESS_PACKAGE_JSON warnings remain non-fatal. The earlier first-pass EPERM/retry is historical, not the current build result.
- Prior-stage local isolated HTTP check (not rerun for #7): Operations SSR **200**; manual availability GET **200/enabled=false**; manual POST with flag `1` **503/BLOCKED**; foreign-origin manual POST **403**; unauthenticated manual POST **307 to login**.
- Prior-stage Task HTTP regression (not rerun for #7): authorized GET **200**, unauthorized GET/POST/PATCH **307**, foreign-origin **403**, stale evidence **409**, revision conflict **409**, VERCEL=1 PATCH **503**, storage bytes unchanged.
- Migration checked statically for six entities, RLS and restricted grants. **SQL syntax/constraints/RLS were not executed**, by instruction; staging DB integration tests are still required.
- No browser visual QA claimed for v2; local SSR checked. No Preview or production deploy.
- Issue #7: `git diff --check` and changed-source/patch secret-runtime scan PASS; `.env.local`, runtime tasks and data bus ignored; only `web/package-lock.json` remains.

## Issue #7 audit fixes

- Core-enforced LIVE fresh fingerprint: missing callback blocks before collection/spend (`FINGERPRINT_REQUIRED`). After four specialists, error/timeout/invalid SHA-256 blocks with `FINGERPRINT_READ_FAILED`; mismatch blocks with `EVIDENCE_CHANGED`. No Council/Astra result on these paths. Replay stays replay and requires no callback. Local programmatic runner forwards the callback; CLI without fresh-read wiring is intentionally blocked.
- Task SQL INSERT verifies that problem/recommendation/evidence/impact match the approved Council row. UPDATE protects those fields plus id/source_run_id/recommendation_id/created_at with null-safe comparisons; revision/status checks remain.
- Persisted findings have bounded typed evidence lists and strings; SQL only accepts JSON-null impact. Application persistence rechecks each specialist against its own domain IDs and rejects non-null financial impact.
- Privilege hardening now uses explicit REVOKE per created private table/sequence/function. Barbara's follow-up supersedes the first-pass global/default-privilege approach: no ALTER DEFAULT PRIVILEGES remains and no dedicated creator role is assumed. Future private migrations must repeat explicit REVOKE, table RLS and reviewed server grants within their creation transaction; PostgREST exposure stays prohibited.
- Architecture unchanged. ProductionRuntime, SupabaseTaskRepository and manual LIVE remain unavailable. Migration remains unapplied. No owner/provider/credential decision needed for this issue.

Files edited specifically for #7: `.agents/README.md`, `.agents/run.mjs`, `docs/DIGITAL-OPERATING-V2.md`, `docs/OPERATING-V2-WORK-REPORT.md`, `docs/PROJECT-STATUS.md`, `web/lib/operating-orchestrator.ts`, `web/lib/operating-persistence.ts`, `web/lib/operating-runtime.ts`, `web/tests/operating-v2.test.mjs`, `supabase/migrations/20261021123211_digital_operating_v2_design.sql`.

The original `audit-package-operating-v2-2026-10-21.zip` is the pre-#7 snapshot, not evidence of these subsequent fixes. Review the #7 audit delta/current working tree; no new commit was created.

## Executable vs prepared

| Executable | Prepared / deliberately unavailable |
|---|---|
| Server orchestration with injected adapters; sequential isolated specialists and lifecycle checkpoints | Production provider, credentials and external LLM invocation |
| Replay adapter; local Codex adapter (not invoked during this stage) | Durable RunRepository, leases/recovery, provider cancellation |
| LocalFileTaskRepository with atomic revisions | SupabaseTaskRepository stub; private-schema transactional implementation still required |
| Authenticated manual API safely returns BLOCKED/503; UI explains why | Actual production manual LIVE flow after provider/storage implementation and approval |
| UI status, last-successful metadata, source details, task eligibility | SQL migration application and DB integration tests |

## Migration inventory for release audit

Exact file: `supabase/migrations/20261021123211_digital_operating_v2_design.sql`.
Design only; not applied to any database during this stage.

The migration creates the private schema `operating_private` and these six tables,
with row level security enabled on every table:

- `operating_private.operating_runs`
- `operating_private.operating_run_evidence`
- `operating_private.operating_agent_outputs`
- `operating_private.operating_council_items`
- `operating_private.operating_tasks`
- `operating_private.operating_task_events`

**RLS policies created: none (0 `CREATE POLICY` statements).** This is intentional
default-deny for browser roles, not a claim that named policies exist. Schema,
table, sequence and function privileges are revoked from `PUBLIC`, `anon` and
`authenticated`. `service_role` bypasses RLS and receives server-only schema
usage, SELECT/INSERT on the six tables, UPDATE only on runs/tasks, sequence
usage/SELECT and function EXECUTE. No DELETE grant is added. The schema must
not be exposed through PostgREST. RLS is enabled, not FORCE RLS; deployment
security and role behavior still require staging integration verification.

Functions: `valid_findings`, `guard_run`, `guard_task`, `record_task_event`.
Triggers: `operating_run_guard`, `operating_task_guard`, `operating_task_event`.
These are constraints/transaction guards, not RLS policies.

Explicit object REVOKEs cover all six tables, the identity sequence
`operating_task_events_event_id_seq`, and all four function signatures above.
Grants are also scoped to those named objects. No creator-wide/default privileges
are altered. Future private migrations must repeat these restrictions explicitly.

## Barbara follow-up: two blockers

- Task INSERT now requires source_run_id to equal the latest eligible completed LIVE run visible to the transaction, not merely any completed run within 24h. Selection orders finished_at/started_at/run_id descending, excludes replay/future/stale runs and does not filter by the requested Council item. Thus A at 10:00 is rejected when eligible B at 11:00 exists; B may create a task only with exact Council payload. No recommendation in B means rejection, never fallback to A.
- Creator-wide and schema default privilege changes removed. Explicit REVOKEs and scoped grants enumerate only the private objects created here; future-migration rule documented. No migration applied. Staging SQL/privilege/concurrency execution remains required before activation.
- Exact follow-up delta: migration SQL, `web/tests/operating-v2.test.mjs`, this report, `docs/DIGITAL-OPERATING-V2.md`, `docs/PROJECT-STATUS.md`. Runtime/core/API/adapters unchanged; all disabled gates remain.

## Changed source inventory

- `.agents/run.mjs`, `.agents/run.test.mjs`, `.agents/adapters/codex-cli.mjs`, `.agents/README.md`
- `.gitignore` (Supabase CLI temp artifacts excluded)
- `web/lib/operating-runtime.ts`, `web/lib/operating-orchestrator.ts`, `web/lib/operating-persistence.ts`, `web/lib/operating-manual.ts`
- `web/lib/operating-task-repository.ts`, `web/lib/operating-task-store.ts`, `web/lib/operating-data.ts`
- `web/app/api/operating/runs/route.ts`, `web/app/operating/page.tsx`
- `web/tests/operating-v2.test.mjs`, `scripts/task-api-check.mjs`
- `supabase/migrations/20261021123211_digital_operating_v2_design.sql`
- `docs/PROJECT-STATUS.md`, `docs/OPERATING-ARCHITECTURE.md`, `docs/DIGITAL-OPERATING-V2.md`, this report

Architecture diagram and prerequisites for the first LIVE Council: [DIGITAL-OPERATING-V2.md](DIGITAL-OPERATING-V2.md).

Kostiantyn needs to approve provider/model, aggregate data scope, cost budget, server-only credential setup and a staging migration/security test plan. Engineering must then implement provider cancellation plus durable run/task transactions and recovery. A flag or credentials alone cannot activate this version. Production migration/deploy each require separate approval; scheduler remains a later stage.
