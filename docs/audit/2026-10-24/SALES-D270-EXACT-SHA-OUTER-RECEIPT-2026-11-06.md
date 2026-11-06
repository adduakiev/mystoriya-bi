# D270 — independent trusted OUTER reconciliation; exact-SHA native gate required (2026-11-06 UTC)

**PREPARE ONLY — NOT RELEASED.** Existing issue #43 / same OPEN, UNMERGED PR #44. This is an evidence-only receipt for the isolated read-only canary guard correction, not a production acceptance.

## Immutable input and scope

- D270 Astra Actions: https://github.com/adduakiev/mystoriya-bi/actions/runs/42274145109 (trusted OUTER job 128086002318: SUCCESS).
- Previous offline-accepted head: `16187ae750cff579ac0a14e8d16223c1cdbe6071`.
- D270 pushed head: `9309a702f7d9891bece4c95e67aba2fa95d2b9c5`, branch `astra/issue-43-40107435112`.
- Independently inspected GitHub commit compare: exactly **1 commit / 3 modified paths**:
  `supabase/functions/sales-private-header-probe/index.ts`,
  `web/tests/sales-edge-header-probe.test.mjs`,
  `scripts/deno/sales-header-runtime.test.ts`.
  No migration, importer, deployed function, production secret, schedule or unrelated files changed.
- Handler change removes `window` as a browser detector, because the exact Supabase Edge v1.77.9 user bootstrap defines `window === globalThis`; it still rejects `document`, missing `Deno`, missing `Deno.env.get`, and missing `Deno.serve` **before** service-role authentication. The pre-existing JWT validation, constant-time built-in service-key equality, request restrictions and read-only helper remain unchanged.
- New synthetic tests cover this source-matched getter, absent/wrong/forged/expired credentials, DOM browser and missing server capabilities, and no external transport.

## Actual independent OUTER acceptance, not the Codex inner sandbox

The trusted OUTER D270 Astra job built its workspace and ran actual **native PostgreSQL 16.15 `npm run check`: 639/639 PASS, 0 fail, 0 skipped**, TypeScript and optimized Next.js build PASS; then committed and pushed `9309a702...` to the existing PR branch. The inner handoff's statements of “no push” and PostgreSQL sandbox/socket failures are **not** the trusted outer result. OUTER PG16 ran **before the commit**: it is meaningful verification of the worktree, but is **not** an independent GitHub native execution against the final immutable SHA. It also did not establish real Deno or PG17 parity at the new SHA.

Independent Vercel Preview for `9309a702...` was READY with `target=null`, deployment `dpl_6U6zKXeSDZNf7sE7BzbsETSKJYR6`; this is not Production.

## SINGLE NEXT GATE

At this checkpoint, GitHub's latest native push workflow for PR #44 remains the **prior SHA** `16187ae...`, run #42257478592. The D270 Astra's GitHub Actions push produced no independently observable current-SHA native run. Therefore, this **documentation-only PR-branch follow-up** intentionally requests the **already-configured, existing** `sales-pr44-native.yml` push gate from an authorized repository owner identity. Accept it **only** after independently inspecting full actual GitHub logs for both sequential PostgreSQL 16 + 17 jobs, pinned real Deno 2.1.4 synthetic test and exact `GITHUB_SHA == git rev-parse HEAD` on the new final doc-commit SHA, zero fail/skips, and same-SHA Vercel Preview READY. Do not use earlier acceptance or a mere green status as a substitute.

The D264 authorized **one** live read-only canary invocation was consumed and returned **HTTP 401**. D270 is **NOT DEPLOYED** and not live-tested. Live server key match, private Sheets header acceptance and freshness, backup/restore, SQL/atomic cutover, source→warehouse→RPC→UI, attestor and authenticated QA remain separate gates. Any further live canary deployment/invocation requires **separate explicit owner authorization**. Never invoke legacy `sync-google-sheet` v9; no import, SQL, database production change, secret copy/rotation, merge or schedule change is permitted by this receipt.
