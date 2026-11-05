# D253 / issue 43 / existing PR 44 — offline installed-v9 cutover contract

**PREPARE ONLY — NOT READY FOR GATE / NOT RELEASED. No production change.**

Starting local HEAD: `52125cb25db6f54b3b64b147f1b95176465c0c52`, clean worktree. The supplied trusted outer PR-open/branch/remote-HEAD gate is authoritative; no inner network/auth retry was required or attempted. Same branch `astra/issue-43-40107435112`, same open/unmerged PR 44; no commit, push or PR creation inside Codex.

## Evidence and bounded audit

The trusted D253 dispatch reports the **installed ACTIVE production Edge v9**, with unauthenticated `docs.google.com/spreadsheets/.../gviz`, `BATCH_SIZE=2000`, and post-auth calls to `sync_sales_batch` and `finalize_sales_snapshot`. It also reports 46,286 warehouse rows, max date 2026-10-26 and no running imports on 2026-11-05. These are **supplied read-only observations**, not new measurements by this candidate. No production endpoint, SQL, private Sheet, credentials or scheduler was accessed. The earlier D252 PG16/PG17 615/615 and Preview READY receipt describes the starting SHA, not this candidate.

Independent repository inspection at that SHA found:

| Boundary | Current code evidence | Compatibility consequence |
| --- | --- | --- |
| `supabase/functions/sync-google-sheet/index.ts` | POST unconditionally returns `SALES_IMPORT_SAFETY_GATE`, 503/no-store; other methods 405; no imports, network, env or writer | Repository candidate is sealed; it is **not installed v9**. Publishing repository code alone is not evidence of a deployed replacement. |
| `google-sheet-reader.mjs` and `prepared-sales-sheet-capture.mjs` | Fixed private Sheets API, server-only prepared capture, readonly OAuth scope; no public gviz fallback | Preserve fixed origin/range/scope and credential isolation; do not wire a private reader into v9 batch/finalize. No real auth/access proof obtained here. |
| `prepared-sales-transport.mjs` | Fixed warehouse GETs, exact-count pagination, repeat-baseline checks; imported successful-run metadata remains unauthenticated evidence; `recover()` always rejects | A service-role-readable row or accepted-source JSON cannot bootstrap real authority. |
| `prepared-sales-cutover.mjs` | Readonly review composes private capture, exact-cent preparation and provenance; returns BLOCKED with unauthenticated prior; `refresh()` always rejects | Prepared review can contain confidential cells/bytes/bodies. Never expose, log or artifact its result. |
| `prepared-sales-release-v234.mjs` | Pinned prior and two observers checked; two private observations verified; preparation remains BLOCKED and `release()` always rejects | Caller-selected pins/keys or valid synthetic signatures are not owner-approved production genesis. |
| `prepared-sales-attestor-handoff.mjs`, `prepared-sales-attestor-verify.mjs` | Existing independent Ed25519/fingerprint verifier and synthetic-only LOGIN model | Reuse existing crypto review. No new signature implementation or production attestor provisioning in D253. Actual authenticated connection identity must come from outside packet/JWT metadata. |
| `docs/sql/issue-43-sales-release-v234-NOT-APPLIED.sql` | Disposable database/session-user guard, protected root and distinct reviewer LOGIN receipts, generation and all-or-nothing transaction design, rollback default | Fixture is not a production migration or bridge. Static inspection cannot prove PostgreSQL/RLS/concurrency/restore behavior. SQL unchanged and NOT APPLIED by this task. |
| `web/app/api/data-sync/route.ts`, `web/components/DataSyncControl.tsx` | Next POST always 503/no-store; disabled button and visible paused status, no click handler or view refresh | Severed action remains honest, including direct POST; no successful-import claim. |
| `web/app/api/data-sync/status/route.ts` | Existing GET reads `bi_sync_progress`; it can return historical `success` with HTTP 200 and revalidate caches | This GET is **not** a 503 seal or import proof. The disabled control does not call it. It remains untouched under D253's runtime constraint; future compatibility review must not equate historical status/cache refresh with a new authorized import. |

## Three-path deliverable

1. `supabase/functions/sync-google-sheet/prepared-sales-edge-preflight.mjs`: dependency-free, unreferenced offline metadata verifier. Exact contract distinguishes installed v9 from sealed repository, private readonly OAuth from gviz, and required v234 atomic compatibility from partial batches/deletion. Every modeled outcome (including success, auth failure, timeout, retry, abort, partial read and unknown source) stays 503. Rollback must remain sealed and must never reactivate v9. No callable importer, HTTP handler, secret lookup, SQL executor, deployment flag or scheduler exists.
2. `web/tests/prepared-sales-edge-preflight.test.mjs`: hermetic missing/forged-gate, version/contract drift, every-outcome legacy fallback, confidentiality, browser/no-I/O and import-edge tests. Pins exact starting Edge/Next/UI bytes; changes to these seals must receive explicit review. Existing cryptographic and native SQL tests are reused unchanged.
3. This handoff. Historical audit/status documents are unchanged because this task produced no new live data proofs.

Only non-sensitive metadata belongs in the verifier: `{ contract: structuredClone(SALES_EDGE_OFFLINE_CONTRACT), evidence: Object.fromEntries(SALES_EDGE_GATES.map(id => [id, 'MISSING'])) }`. A reviewer may mark an evidence declaration `DECLARED_UNVERIFIED`; **neither value opens a gate**. Unknown keys, signatures, credential values, booleans claiming approval and packet/cell objects are rejected without echoing input or exception details. Output contains fixed vocabulary only. Even a valid contract with every declaration present is BLOCKED, with every gate HARD_CLOSED and refresh/release false. This tool cannot independently authenticate real evidence, inspect installed code, or enforce a future deployment; runtime wiring and authority remain separate reviewed work. Do not use `contractValid` as authorization.

## Owner-only provisioning and evidence checklist — no actions authorized

Each row requires separate real evidence and explicit approval where applicable. Keep contents in the approved private control channel; record only redacted receipt identifiers/results in public handoff. Do not put tokens, source cells, keys or signed private packets in logs, artifacts, API payloads or this verifier.

| Hard-closed gate | Evidence required before a separately reviewed implementation may proceed |
| --- | --- |
| Server-only readonly credential presence | Authorized operator confirms configured server-only credential **presence, not contents**, fixed reader identity/property access and readonly OAuth scope; no client/env/API exposure. Provision/change only with exact owner approval. |
| Historical genesis/root | Completed, owner-approved authentic historical source reconciliation and protected immutable root/accepted receipt. Never infer this from warehouse min/max, service-role JSON, fixture roots or caller signatures. |
| Independent observer → SQL LOGIN | Owner-approved pinned Ed25519 observer fingerprints, independence/project/source policy and protected mapping to real distinct authenticated SQL LOGINs. Verify actual `session_user`/`current_user` from authenticated connections, expiry and binding; JWT/SET ROLE/packet metadata is insufficient. Existing synthetic verifier does not provision this. |
| PG16 and PG17 atomic SQL | Full trusted outer PG16 zero-failure/skip verification, then independent **same exact published SHA** PG16+PG17 native LOGIN/RLS/concurrency/rollback/restore results. Validate all-or-nothing facts/dimensions/MVs/receipts/generation/sequence behavior; fixture proofs do not authorize production SQL. |
| Protected Production backup/restore | Approved protected complete backup, owners/ACL/RLS/sequences/receipts retained, tested restore and stop/recovery ownership. Disposable synthetic dump/restore is insufficient. No backup/restore was performed on production here. |
| Compatible Edge swap and rollback | Reviewed exact installed-v9 inventory, authenticated caller compatibility, replacement SHA/dependencies, private OAuth restrictions, atomic bridge and explicit deployment gate. Inventory every manual/scheduled invocation under separate authorization; never invoke v9 for diagnosis. Prove failure/retry cannot dispatch legacy endpoints or partial writes. Rollback plan must use a reviewed **503-sealed** version, never v9. |
| Private source → warehouse → RPC → UI parity | Approved confidential reconciliation for complete historical and latest completed Kyiv periods, exact cents, counts, filters, freshness and no double counting; record only redacted aggregate outcomes. No source read/import was made here. |
| Real authenticated desktop QA | Authenticated deployed candidate, actual Sales periods/segments, blocked/missing/error states, roles and honest refresh status; redacted URL/result evidence. No live-browser claim from hermetic tests. |
| Real authenticated mobile QA | Same authenticated source/candidate and cross-tab parity on mobile, with redacted evidence. |
| Owner release | Explicit exact migration/Edge deployment/first-import approvals, all individual evidence gates satisfied and independently reviewed. No approval is inferred or requested by this offline deliverable. |

Future cutover order is evidence review → exact-SHA compatibility/acceptance → separately authorized protected backup and execution plan → separately authorized sealed Edge replacement verification → separately authorized activation/import → private reconciliation and authenticated QA. Until then, no manual refresh/release. A future failure must stop before writes or roll back the whole authorized transaction, preserve the last verified warehouse, and keep Edge/Next/UI sealed; never retry via v9, stale deletion or partial batches. A code rollback is not a data restore. Any real restore needs its own approved procedure.

## Candidate verification and trusted handoff

Observed inner results on 2026-11-05:

| Check | Result |
| --- | --- |
| `npm ci --prefix web` | PASS, 71 packages; lockfile unchanged. |
| `node --test --test-isolation=none web/tests/prepared-sales-edge-preflight.test.mjs web/tests/prepared-sales-cutover.test.mjs web/tests/prepared-sales-release-v234.test.mjs` | PASS: 19 tests, 0 fail/skip, including 7 new offline tests and existing prepared-boundary tests. |
| `npm run check` | FAIL: 57 test files, 47 pass / 10 fail / 0 skip. Seven native Sales files and three existing agent/Operating files fail in the restricted sandbox; this command stops before TypeScript/build. No tests filtered or weakened. |
| Native failure reproduction: `node --test --test-isolation=none web/tests/sales-release-v234-postgres.test.mjs` | 4 pass / 1 fail / 0 skip. PostgreSQL 16.15 starts, then `could not bind Unix address .../.s.PGSQL.5432: Operation not permitted`; no native database subtests execute. |
| Runtime failure reproduction: `node --experimental-strip-types --test --test-isolation=none web/tests/operating-tasks.test.mjs` | FAIL before tests: `ENOENT` creating sandbox-readonly `.agents/runtime/`. No permission workaround attempted. |
| Independent TypeScript: `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS. |
| Independent optimized build: `node node_modules/next/dist/bin/next build` in `web` | PASS. This is build evidence, not deployed or authenticated browser QA. |
| `git diff --check` and whitespace inspection of all three new paths | PASS. |
| Path/import boundary | Exactly the three new paths listed above; no tracked file changed. Hermetic scanner finds no imports from active/prepared source or scripts; original Edge/Next/UI hashes match. |

**Acceptance blocker:** this inner sandbox cannot provide the required trusted outer full native PG16 acceptance (socket and runtime-directory restrictions reproduced above). The offline implementation is prepared; acceptance is not claimed. The trusted outer runner alone handles remote drift, full native acceptance, commit/push to the same branch and existing PR. Subsequent independent exact-published-SHA PG16+PG17 and Vercel gates remain mandatory. No inner result substitutes for those gates.

No production migration, Edge deployment, import/trigger, legacy batch/finalize, real Sheet fetch, credential creation/change, public sharing, provider, ads/SYRVE/business write, scheduler change or unrelated Digital/UI work is included.
