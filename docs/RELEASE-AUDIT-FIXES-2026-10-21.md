# Release audit fixes — PASS

Architecture unchanged. No commit, push, PR or deployment performed.

| Change | Files |
|---|---|
| Business status is independent of WARN; DATA ISSUE only for BLOCK. Quality and confidence are separate visible fields. | `web/lib/operating-core.ts`, `web/app/operating/page.tsx` |
| Generated Council items and task drafts use UNASSESSED. Confidence does not assign or sort business priority. Existing explicit P1/P2/P3 remain supported; no automatic assignment added. | `web/lib/operating-core.ts`, `web/lib/operating-tasks.ts` |
| `runIssues` accumulates replay, stale and changed-data reasons; any reason disables task creation. | `web/lib/operating-data.ts`, core, page |
| Technical row counters moved to Data Quality / Sources and excluded from KPI, direction and changes. | core, page |
| Regression tests and Operations-only browser assertions. | `web/tests/operating-core.test.mjs`, `web/tests/operating-tasks.test.mjs`, `scripts/live-check.mjs` |

Verification on 2026-10-21:

- `node scripts/check.mjs`: exit 0; **18/18 tests**, TypeScript and optimized Next.js production build PASS.
- `/operating` local production browser smoke: **HTTP 200**, zero runtime errors; desktop 1440px/mobile 390px, no mobile document overflow.
- All four audit assertions PASS. Replay and changed-data warnings are simultaneously visible (2); combined replay/stale/changed-data case is covered by regression test.
- Visible text contrast: 218 samples, minimum 8.178:1, zero failures in scoped check.
- Task GET 200 and foreign-origin POST 403 retained.
- `git diff --check`: PASS. Existing Node module-type warnings remain non-fatal.

The earlier `audit-package-2026-10-21.zip` predates these fixes; this report and current working tree supersede it for these four changes. Production persistence, DB and advertising settings remain unchanged.
