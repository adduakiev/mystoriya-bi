# D226 — pre-first-write PREPARE-only acceptance / exact-SHA CI handoff (2026-11-04)

**Scope:** issue #43, existing open/unmerged PR #44. No production action and no release authorization.
Previous verified PR HEAD: `9e3d88080c5b5e3d3c2ef7c0b77b4f2a0670cb17`. This acceptance note is intentionally the sole non-executable change after that head; its resulting commit is a **NEW SHA** and must be independently tested as a whole. Only the trusted exact-SHA CI, not the Astra/Codex inner sandbox, can close the dual-major native gate.

## Verified inputs

- Astra external GitHub Actions run [41831989165](https://github.com/adduakiev/mystoriya-bi/actions/runs/41831989165): outer runner **completed success**; full native `npm run check` on disposable PostgreSQL 16 reported **583/583 pass, 0 fail, 0 skipped**; TypeScript/Next build and `git diff --check` passed. Inner Codex network/socket constraints were not treated as CI acceptance failures.
- Commit `9e3d88080c5b5e3d3c2ef7c0b77b4f2a0670cb17` added **only** `docs/sql/issue-43-sales-prewrite-gate-NOT-APPLIED.sql` (explicit `rollback;` default and four unconditional 55000 rejection bodies) and `web/tests/sales-prewrite-postgres.test.mjs` (real isolated PostgreSQL, nontransactional sequence witness, exact ACL/schema/table rollback parity, negative controls). Neither artifact is installed in Production or connected to Edge/Next.
- The previous independent push-triggered native dual-major run [41815148271](https://github.com/adduakiev/mystoriya-bi/actions/runs/41815148271) passed on **prior** SHA `14eee456893bbefb882b5cb910aabde199684fc1`. It is **not acceptance of current code**.
- **Important CI trigger limitation:** the Astra runner pushes its changes via GitHub Actions `GITHUB_TOKEN`, and GitHub does not trigger subsequent `push` workflows from such token actions. Therefore the new code SHA has **no independent push-triggered PostgreSQL 16/17 evidence yet**. This non-executable handoff is committed by the GitHub App to the **same existing PR branch** so the existing `.github/workflows/sales-pr44-native.yml` can run normally, without a new PR, workflow edit, credential, schedule, or provider change.

## Required exact-commit STOP/PASS

1. On the SHA containing this note: independently confirm PR #44 OPEN, unmerged, correct head branch, and no drift.
2. Obtain native `exact-sha-native` PostgreSQL 16 and sequenced `exact-sha-pg17-parity` PostgreSQL 17 checks from **that identical GITHUB_SHA**. Demand full pass counts, no skips, and successful build / `git diff --check`. If the CI trigger does not fire, **STOP**, never infer parity from old runs.
3. Treat the rejection-only SQL as a **simulation of the missing authority**, not an authorized importer. No real independent authenticated historical source trust root, service-role authorization policy, production protected backup+isolated restore, competing-writer shutdown, correct ACL cutover, compatible atomic SQL/Edge installation or source→warehouse→RPC→authenticated desktop/mobile UI parity has been established by these tests.
4. Edge/Next production endpoints must remain fail-closed; manual `Оновити` is an import control, not a view refresh. Do not activate a real import from private Sheets or use legacy `sync_sales_batch`/`finalize_sales_snapshot` even if OAuth begins working.
5. **NOT READY FOR GATE / NOT RELEASED** until every independent production acceptance gate is evidenced. No migration/deploy/trigger/import, keys, advertising, schedules, unrelated business writes, or new PR.

Next sequential task after exact-SHA dual-PG pass: prepare the **real independent pre-first-write authority/root + identity policy** as a separate offline design/test, not activate or replace the above rejection-only gate without acceptance.