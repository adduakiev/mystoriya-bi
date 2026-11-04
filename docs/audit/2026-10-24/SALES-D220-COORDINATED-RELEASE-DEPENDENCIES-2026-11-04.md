# Issue #43 / PR #44 — coordinated Sales release dependencies

**PREPARE ONLY / NOT READY FOR GATE.** This is the single offline dependency
audit requested by the 2026-11-04 trigger. It authorizes no installation, source
request, import, credential operation or release. All SQL drafts remain **NOT
APPLIED**. Edge POST 503, Next POST 503 and the disabled manual button stay intact.

WORKING was acknowledged in the implementation transcript. AGENTS.md was read
first. Local HEAD was exactly `01f902ba5bbe40b845b432af03dc63a0a0c7d25a`, branch
`astra/issue-43-40107435112`, with an empty initial `git status --porcelain`.
The supplied trusted outer gate establishes PR #44 OPEN, branch and remote SHA
equality for this baseline. No inner GitHub/token/DNS check is needed or attempted.
Subsequent remote checks and publication belong to that runner. No commit, push,
new PR or merge occurs here. Only this report changes.

## Evidence boundary

| Evidence reused | What it establishes; what it does not |
| --- | --- |
| [D215 decision record](SALES-D215-DEFAULT-ACL-DECISION-2026-11-04.md), including its supplied [read-only finding](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6621105139) | Reports effective API-role TRUNCATE on Sales facts/raw staging, unsafe creator default ACLs and active Sales cron `15 4 * * *`. It does not establish transport exploitability, cron timezone/in-flight state, remediation or today's installed state. |
| D218/D219/D220 references in the current trusted trigger | Reused as the task's read-only evidence context and explicit no-write restrictions. Their full comment bodies, individual timestamps and independent observation receipts are not retained under these identifiers in this checkout or supplied verbatim. No additional live findings, approvals or passing tests are attributed to them. Exact redacted receipts remain necessary before a release decision. |
| Actual pinned code and local history | `6d1c1ca65c945ddfde0c8768236c35283df01f23` strips the unreachable Edge writer; baseline `01f902b…` replaces the stale Vault/Edge test contract. Current Edge source contains no legacy writer. Neither commit proves a deployed function changed. |
| [Private auth preparation](GOOGLE-SHEETS-AUTH-2026-10-31.md) | Historical 2026-10-31 read-only observation of deployed Edge v8, `verify_jwt=false`, legacy gviz/batch/finalize; Viewer access was owner-reported. Later source guards supersede the report's description of the PR entrypoint, not its dated production observation. No current deployed status or Google access is inferred. |
| [Provenance](SALES-PROVENANCE-CONTRACT-2026-11-03.md), [accepted-source gate](SALES-ACCEPTED-SOURCE-GATE-2026-11-03.md), [cutover review](SALES-CUTOVER-CANDIDATE-2026-11-03.md) | Exact-byte/cent review models and deliberate rejection boundaries. No authentic historical root, production attestor or evidence-bound SQL success implementation. |
| [Restore readiness](SALES-RESTORE-READINESS-2026-11-03.md), [synthetic rehearsal](SALES-REHEARSAL-RETRY-2026-11-03.md), D215 addenda | Historical trusted-outer synthetic results include 574/574 on PG16.15 for the rehearsal and 577/577 for the later role candidate. These are distinct earlier candidates, not current exact-SHA PG16/17 acceptance, production backup or source evidence. |

No real Google/OAuth, business API, Supabase, production SQL or browser request
was made in this audit. Source event times, current counts, ACLs, scheduler state and deployed
versions have not been reobserved. Historical receipts remain dated; the broad
issue #43 data-correctness audit remains incomplete. PROJECT-STATUS.md is left
unchanged: this bounded task supplies no new production proof to rewrite it.

## Cross-boundary contract and precise discrepancies

| Priority / boundary | Actual repository behavior | Required release evidence / disposition |
| --- | --- | --- |
| P0 — Google authority | [Reader](../../../supabase/functions/sync-google-sheet/google-sheet-reader.mjs) pins service account/project, readonly scope, spreadsheet and range; uses PKCS8 RSA OAuth. Runtime wiring and usable existing server credential are unproven. | Approve exact private access/auth mechanism and standalone no-write probe separately. Credential availability does not authorize an import. STOP. |
| P0 — typed capture | [Capture](../../../supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs) retains original decoded response bytes and typed cells before coercion; fixed Values request, 32 MiB cap, 30-second operation budget, no retries/redirects, sanitized errors. Requires exactly 14 cells in every returned row; shortened API rows reject. | Real separately authorized complete capture and independent collectors; establish expected width/completeness. Hashes and HTTP 200 do not prove full source coverage or history. STOP. |
| P0 — historical acceptance | Last legacy success reported in the provenance record is 2026-10-30, 47,051 raw / 46,286 facts, cutoff 2026-10-26; `atomic` and `accepted_source_v1` absent, original retained source/minimum/digest UNKNOWN. | Recover the actual consumed historical artifact with authenticated chain and independent review, or obtain a separately scoped owner recovery design. Current facts/current Sheet cannot reconstruct that root. No metadata backfill or first-run exception. STOP. |
| P0 — before the first write | [Atomic draft](../../sql/issue-43-sales-atomic-NOT-APPLIED.sql) `begin_sales_snapshot_v2(jsonb)` validates shape/totals, then inserts `public.import_runs` and `bi_import_private.sales_runs`. No provenance authentication precedes these inserts. Stage also writes without an attestor. The rejection overlay replaces only commit bodies; role hardening retains service-role begin/stage EXECUTE. | Require DB-enforced authenticated provenance **before all durable writes**, including reservation/import history, staging and evidence receipts. The existing drafts do not meet this requirement even when combined. Do not install them as a recovery bundle. STOP. |
| P0 — SQL authentication | [Attestor draft](../../sql/issue-43-sales-attestor-NOT-APPLIED.sql) uses actual separate LOGIN `session_user`, protected target policy and immutable receipt tables, but only in `sales_attestor_synthetic`. | Production policy, authentic root, custodian identities/independence, retained artifacts, protected target provisioning and a reviewed authenticated channel remain missing. A service-role JWT, caller keys/JSON, digest or JS WeakSet token cannot supply this authority. STOP. |
| P0 — atomic success | Original commit updates facts/MVs/success/generation without `accepted_source_v1`; overlay always raises `55000 / SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE`. Private rehearsal writes `synthetic_rehearsal`, not accepted-source history. | Implement/review a complete evidence-bound transaction and immutable accepted receipt, with exact-wrapper readback and authenticated retry semantics. Synthetic private promotion is not a public success path. STOP. |
| P0 — ACL and active writers | D215 reports effective TRUNCATE despite RLS ON/zero policies, unsafe future defaults and an active cron. Hardening intentionally raises `SALES_ROLE_STOP_DEFAULT_GRANTS` before revokes. | Separately approved security design and writer freeze/drain. Never delete/allowlist the STOP, silently change global defaults or infer protection from RLS. STOP. |
| P1 — baseline read | [Transport](../../../supabase/functions/sync-google-sheet/prepared-sales-transport.mjs) GETs latest successful run and exact-count 1,000-row fact ID/date pages, validates ownership/order/bounds and before/after metadata. `accepted()` is structural only; reads no fact cents/dimension identities or generation. | Consistent generation/receipt and complete canonical fact+cent readback, authenticated against approved prior chain. Stable metadata alone cannot detect all concurrent/direct writes. STOP. |
| P1 — composed review | [Cutover composition](../../../supabase/functions/sync-google-sheet/prepared-sales-cutover.mjs) derives manifest/source/mapping/warehouse digests from one typed capture, returning confidential `BLOCKED`, `priorAuthenticated:false`. `refresh()` and transport `recover()` reject before any I/O. | Keep results private/in process; no browser/log/storage exposure. No real capture is authorized here. Review is not acceptance or a write capability. |
| P1 — warehouse → UI | SQL-first loaders and status/snapshot RPCs do not consume an authenticated receipt/generation contract. Dataset fallback can still read legacy gviz and use JS analytics. Independent caches/read requests can span generations. | Prove source→facts→all caches→RPC→rendered UI under pinned periods/segments/generation with explicit source/fallback/freshness. No end-to-end parity proven. STOP. |

The pre-write gap is a stricter requirement than the older provenance proposal's
unauthenticated “reserve then authenticate” sequence. That proposal is historical
design, not approval for `begin` now. A future design can select a run UUID in
memory and bind it to an authenticated current prior/generation before reservation;
it must atomically recheck that generation and evidence at the first DB write.
No such API/signature is implemented or approved here. If attestor receipts
themselves persist, authority/root/policy and source validation must precede their
insertion too; empty protected tables alone do not establish trust.

## SQL dependency order and exact interfaces — NOT an installation procedure

Every file below is a review artifact outside migrations, ends in ROLLBACK, and
is NOT APPLIED. Do not edit the terminators or run these files on staging or
production. There is **no valid production installation order for the current
set**: the authenticated pre-write and success contracts are missing, and D215's
defaults stop hardening. The following is the exact dependency ordering to
review/test, not a command sequence or permission to install.

1. Inventory existing installed Sales schema and helper definitions/owners first.
   Repository dependencies are `supabase/schema.sql`, warehouse runtime
   `20261008_warehouse_runtime.sql`, flat-cache `20261009_performance_tuning_flat_cache.sql`,
   lifecycle registry and manual-sync definitions. Do not replay historical
   migrations wholesale. Require all six dimensions, facts/imports/raw/quality,
   `map_location_source`, lifecycle, ordinary flat view and all three MVs.
   Existing helper signatures are `public.sync_sales_batch(jsonb,uuid) RETURNS integer`,
   `public.finalize_sales_snapshot(uuid) RETURNS jsonb`,
   `public.refresh_bi_aggregates() RETURNS void`, and
   `public.bi_trigger_sync(text) RETURNS jsonb`. Read-only catalog preflight is
   [issue-43-sales-role-preflight-READ-ONLY.sql](../../sql/issue-43-sales-role-preflight-READ-ONLY.sql);
   it was inspected, not executed remotely. Unknown overloads/owners/dependencies STOP.
2. [Atomic draft](../../sql/issue-43-sales-atomic-NOT-APPLIED.sql) creates
   `bi_import_private.generation`, `sales_runs`, `sales_batches` and:
   `public.begin_sales_snapshot_v2(p_manifest jsonb) RETURNS uuid`,
   `public.stage_sales_batch_v2(p_run_id uuid,p_batch_no integer,p_rows jsonb) RETURNS integer`,
   `public.commit_sales_snapshot_v2(p_run_id uuid) RETURNS jsonb`.
   These are SECURITY DEFINER with explicit search paths. Legacy batch/finalize
   EXECUTE is revoked from PUBLIC/anon/authenticated/service_role in the draft.
   Original commit is an ungated atomic regression fixture: never expose it alone.
3. [Accepted-source overlay](../../sql/issue-43-sales-accepted-source-gate-NOT-APPLIED.sql)
   depends on step 2; replaces `commit_sales_snapshot_v2(uuid) RETURNS jsonb` and
   adds `public.commit_sales_snapshot_with_evidence_v1(p_run_id uuid,p_evidence jsonb) RETURNS jsonb`.
   Both are SECURITY INVOKER, `search_path=pg_catalog`, unconditional exact
   `55000 / SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE`, including retries.
   Only service_role receives draft EXECUTE; PUBLIC/anon/authenticated are revoked.
   A future installation design must make atomic definitions and all closures
   visible together with no executable ungated intermediate window. Sequential
   independent commits are not an acceptable deployment plan. Begin/stage still
   need a separately reviewed pre-write closure/authenticator.
4. [Role hardening](../../sql/issue-43-sales-role-hardening-NOT-APPLIED.sql)
   requires steps 2+3 and the exact rejection bodies; checks overloads, owners,
   schema CREATE, defaults, inherited/table/column/sequence/RPC privileges.
   It revokes targeted Sales writes and legacy refresh/manual-trigger EXECUTE;
   it does not install a new function, change owners/memberships/defaults, or
   authenticate begin/stage. It is not compatible with a future success body
   without another reviewed design. Under supplied D215 defaults: STOP before
   any revoke, not “installed hardening”.
5. [Attestor draft](../../sql/issue-43-sales-attestor-NOT-APPLIED.sql) is a
   separate synthetic-only branch; requires database `sales_attestor_synthetic`,
   preprovisioned safe NOLOGIN owner/API roles and independent LOGIN reviewers,
   no reviewer memberships and no unreviewed creator defaults. It creates empty
   `sales_attestor_private.reviewers`, `targets`, `receipts`, `accepted_reviews`;
   functions `reject_mutation() RETURNS trigger`,
   `review(p_run_id uuid,p_binding jsonb) RETURNS jsonb`, and
   `read_receipt(p_run_id uuid) RETURNS jsonb`. Review/read are owner SECURITY
   DEFINER with `search_path=pg_catalog`; identity is authenticated `session_user`.
   Policy/root/targets are supplied only by the disposable fixture, not caller
   JSON. Nothing here provisions a production role, root or Google authenticator.
6. [Rehearsal draft](../../sql/issue-43-sales-rehearsal-NOT-APPLIED.sql)
   depends on atomic+overlay+attestor and fixed synthetic administrator/caller.
   Creates empty `sales_rehearsal_private.authorities`,
   `compact(p_value jsonb) RETURNS text`, `warehouse_rows() RETURNS jsonb`,
   and `commit(p_run_id uuid) RETURNS jsonb`. Only the fixture's independent
   LOGIN caller gets private commit EXECUTE; no public commit is opened. The
   native harness installs atomic→overlay→attestor→rehearsal; role hardening has
   its own fixture and is not silently assumed part of that rehearsal.
   Synthetic authority/root provisioning is not historical genesis. Rehearsal
   rejects committed replay as stale; it does not implement the proposed
   authenticated public idempotent receipt return.

Release engineering still needs a new reviewed artifact with exact signatures,
transaction/install boundaries, protected root/policy provisioning, pre-write
authentication, success/receipt persistence, inverse and adapter compatibility.
Neither the rejection-only overlay nor the private rehearsal can be relabeled
that artifact. No migration design or SQL bytes change in this task.

## Private Google auth and historical genesis gates

Prefer keyless only if the real Edge runtime supplies a documented attested
workload identity and approved Google trust pins issuer/audience/subject,
environment/project/function and the dedicated service account. The chain would
be runtime identity→STS→service-account impersonation→Sheets readonly. No such
runtime identity/provider is verified here; the implemented reader supports
server-only service-account JSON, not WIF. GitHub OIDC, a Supabase user JWT or
service-role key does not establish Edge workload identity. A static-secret
broker is not keyless. No provider, IAM, API or scheduler changes are proposed.

The server-only fallback needs exact owner/security approval of existing private
Viewer access, Sheets API availability, credential custody and runtime/deployer
access. `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` is a proposed server secret name,
not proof it exists. Key creation/upload/rotation/revelation each requires its
own approval; no secret is requested or inspected. Never put keys/tokens in
browser code, request fields, CLI arguments, Git, logs or evidence. Project
Secrets require review of all trusted project functions/deployers, not a presumed
per-function vault. Keep the Sheet private; no public CSV fallback for recovery.

Non-secret code pins: account
`myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com`, project
`myastoriya-bi`, spreadsheet `1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA`,
full range `'Данние короткі'!A:N`, header range `'Данние короткі'!A1:N1`;
scope `https://www.googleapis.com/auth/spreadsheets.readonly`, token endpoint
`https://oauth2.googleapis.com/token`, RS256 assertion lifetime 300 seconds.
These identifiers are not credential/access evidence. No Drive scope or user
delegation is needed by the prepared reader.

The disconnected [header probe](../../../supabase/functions/sync-google-sheet/private-sales-header-probe.mjs)
can test one fixed readonly OAuth exchange plus header GET only after a separate
owner-approved no-write probe scope. It has no DB dependency; test fixtures use
injected offline transport. Its success would prove access/schema only, never
latest date, full volume, root, warehouse reconciliation or import authorization.
Full retained source capture and each independent custodian's read scope need
separate approval and private retention/access policy. No real probe ran here.

Authentic historical genesis requires the artifact consumed by the exact legacy
run, acquisition/range/header/raw-count/bounds/integrity provenance and an
independent review against the corresponding warehouse generation, plus an
owner-approved immutable trust-root receipt/policy. Retained evidence must allow
reverification of source bytes, literal manifest, aliases, canonical identities
and exact cents. If unavailable, STOP for a distinct owner recovery decision;
do not synthesize a root, change the old run or baptize current data as history.
The DB LOGIN experiment proves a synthetic identity boundary only: it neither
verifies Google content nor establishes real custodian independence. Its JSONB
hash encoding is not interchangeable with canonical JS tuple/signature bytes.

## Protected backup, writer drain and rollback dependencies

These are prerequisites for a future separately approved operator procedure.
No backup, restore, cron inspection/change, protection change or writer call is
performed here. Preserve original private ACLs/owners/RLS/policies and immutable
receipt protections in the backup; never weaken them to obtain a restore PASS.

1. Record an approved maintenance scope/operator/window and redacted installed
   object/role/writer inventory. Include cron/pg_net, manual `bi_trigger_sync`,
   deployed Edge clients, legacy batch/finalize, direct SQL/REST roles, retries,
   external integrations and DDL/ACL writers. Do not publish cron commands or
   secret-bearing settings. Source 503s do not disable installed/external writers.
2. Approve private backup retention/encryption/access and an isolated restore
   destination, RPO/RTO, dependency/role/extension scope and loss-window policy.
   Prove an actual protected consistent backup can be restored there with native
   tools and full parity. A dump alone, synthetic restore or default ROLLBACK
   does not prove production recoverability or a deployment inverse.
3. Separately authorize freezing writer ingress/schedules/retry queues, then
   draining or controlled cancellation of all queued/in-flight requests and
   transactions. Active cron `15 4 * * *` is an unmet gate; a disabled timer or
   stable row count is insufficient. Require operator evidence of no pending
   deliveries/writes and stable facts/imports/generation while DDL/ACL changes
   are controlled. Preserve a final consistent checkpoint under that freeze;
   an earlier rehearsal backup cannot stand in for it.
4. Close reviewed legacy/direct/default/inherited bypasses under the separately
   approved security design. RLS does not govern TRUNCATE. FK rejection of plain
   TRUNCATE (`0A000`) is not permission denial; the synthetic receipt suite also
   requires independent immutable-trigger denial of CASCADE (`42501`). Existing
   object revokes do not remove future defaults, and per-schema REVOKE cannot
   subtract global defaults. Built-in PUBLIC function EXECUTE also needs review.
   Keep D215 STOP until its precise design decision is approved and verified.
5. Only a future approved complete SQL+server adapter release can proceed, with
   no interval exposing original commit/begin/stage or legacy mutators. Keep
   both runtime 503s through version/grant/closure validation. First import and
   any later scheduling are distinct exact-action gates, never automatic.
6. Ambiguous commit/readback, stale generation, evidence/ACL drift or unexpected
   parity closes writers and preserves evidence for authorized read-only review.
   No automatic retry, old batch/finalize, generation reset or evidence repair.
   Code rollback restores guarded handlers only. SQL inverse/data restore needs
   its own compatibility/loss-window approval; never reopen legacy grants.
   Restored pending runs must not auto-promote or resume jobs.

Restore/readback scope includes facts and historical dimension identities,
all six dimensions, aliases/lifecycle, import statuses/details, raw/quality,
private runs/batches/generation, sequences (`last_value`, `is_called`), flat view,
flat/monthly/weekly MVs, receipt/root/policy chain and all dependent objects.
Compare exact rows/cents/bounds/counts/digests plus definitions, owners, ACLs,
memberships, policies and triggers; do not use `--no-owner`/`--no-acl` to hide
missing security. Fixture-specific `--enable-row-security` restore behavior is
not a general production restore recipe. Physical WAL/PITR/platform recovery
and secrets/external storage require a separate platform plan.

## Source → warehouse → RPC → UI acceptance

Source grain is accounting date × raw location × brand × ownership × channel
group × order type. Retain raw count and full typed F:N plus A:E bytes; normalize
business identity separately. Resolve the complete explicit alias snapshot,
aggregate only identical normalized raw keys in integer kopiykas, and reject
canonical collisions. Warehouse identity includes both channel group **and**
channel name and the fact's historical brand/ownership, not current location
attributes. Compare every canonical key and exact amount, historical-key
preservation, source bounds, completed Europe/Kyiv date, rejects and generation;
counts/totals alone are insufficient. Do not convert missing values to zero.

The protected transaction must recheck evidence freshness, prior receipt,
run/base→promoted generation, manifest/staged bytes and locked aliases/lifecycle,
then atomically publish facts/dimensions, stale deletion if authorized, all three
MVs, immutable accepted-source receipt, success and one generation increment.
Cancellation/concurrency/retry and receipt mutation denial need native tests of
that actual success implementation. Original atomic tests and private synthetic
rehearsal are useful evidence for their own contracts only.

Repository Sales consumers are `/`, `/aggregators`, `/delivery`, `/locations`,
`/dynamics`, `/explorer`, `/insights`, through `web/lib/data/` SQL-first loaders
and their `bi_*_payload` RPCs (Aggregators uses `bi_aggregators_payload_v2`).
Their candidate lineage is in [inventory.json](inventory.json) and
[rpc-contract-lineage.json](rpc-contract-lineage.json). Warehouse flat view/MV
joins preserve fact brand; aggregation caches include monthly and weekly data.
The fallback dataset in [source.ts](../../../web/lib/data/source.ts) invokes
`bi_sales_snapshot`, then legacy gviz on failure/no password; it is not the new
private OAuth capture and has separate parsing/mapping/JS analytics semantics.
It must not silently qualify as authenticated recovery parity.

`bi_sync_status` is the sidebar metadata path, separately cached for 60 seconds;
dataset fallback caches for 600 seconds, and route payload caches differ.
`status:success`, latest cutoff and row counts are not source authentication or
proof of one shared generation. Sidebar failure returns unavailable metadata
without downloading source/snapshot. [DataSyncControl](../../../web/components/DataSyncControl.tsx)
is server-rendered, disabled and says updates are paused; initial cutoff is
warehouse context, not independently proven source freshness.

Future authorized desktop/mobile QA must pin deployed SHA/SQL definitions,
authenticated role, effective period/filters, generation/receipt and cache state;
exercise all seven Sales routes, date/brand/ownership/location/channel/order-type
and LFL/lifecycle filters, comparisons, drilldowns, empty/error/unavailable states,
null vs measured zero, refunds/negative markup and cross-tab totals. Require
SQL/RPC/rendered values with exact filter/cutoff/definition parity, safe rounding
at display only, and explicit fallback/source provenance. Snapshot-spanning
HTTP reads require a consistent read contract or evidenced unchanged generation.
Screenshots/test results must cite actual URLs and evidence generation; no browser
or deployed parity is claimed by offline SSR assertions or a successful build.
Glovo fees/margin and lifecycle interpretation need business definitions; markup
alone cannot certify net margin. No unrelated Digital or cosmetic work is added.

## Explicit GO / STOP ledger and execution priority

GO means permission/evidence for that bounded activity only; it never cascades.

| Gate / priority | Evidence required to GO | Current decision |
| --- | --- | --- |
| G0 baseline/scope | Trusted outer PR/branch/SHA gate + clean matching local HEAD; one report only | GO for offline preparation, verified locally; no remote recheck attempted. |
| G1 verification / P0 | New exact-SHA full native checks, sequential PG16 and independent PG17, zero FAIL/SKIP, TS/build/inventory/diff; actual runner URLs/SHA | STOP pending current trusted runner results; local results below are bounded. Historical green receipts do not clear it. |
| G2 ACL design / P0 | D215 exact owner/security choice, complete creator/global/schema/default/inherited/object/column/sequence/function inventory and compatibility/rollback proof | STOP; `SALES_ROLE_STOP_DEFAULT_GRANTS` remains mandatory. No option selected. |
| G3 private auth / P0 | Authorized keyless runtime chain or approved existing server-only credential/access policy; separately approved no-write probe evidence | STOP; no real auth/access request performed or new credential authorized. |
| G4 genesis/attestor / P0 | Authentic historical artifact/root, real independent custodians, immutable retention/policy and DB-authenticated source-bound authority before every durable write | STOP; missing production prerequisites; synthetic fixture does not satisfy them. |
| G5 implementation / P0 | Reviewed exact-signature pre-write authentication + immutable accepted receipt + evidence-bound atomic success/readback/retry and negative/concurrent/cancelled native tests | STOP; current drafts are insufficient. Offline design/review may proceed separately; no production implementation in this task. |
| G6 recovery / P0 | Approved protected backup/isolated restore, complete parity/RPO/RTO, writer inventory/freeze/drain and final consistent checkpoint | STOP; active cron reported, quiescence and real restore unproven. |
| G7 release / P0 | Exact coordinated SQL/grants/Edge/Next artifacts and inverse, all dependencies passed, separate owner installation/merge/deployment decisions | STOP; no production installation order exists for current set. Keep 503s/button disabled. |
| G8 first import / P0 | Separate owner approval, authenticated source/warehouse receipt and all-MV readback, correct first-run policy, ambiguity handling | STOP; neither begin/import_runs nor staging is authorized. |
| G9 UI parity / P1 | Authorized deployed source→warehouse→RPC→desktop/mobile evidence on pinned generation/filter/caches and role boundaries | STOP; offline only, 66 existing browser cases NOT_EXECUTED. |
| G10 resume/scheduling | Separate owner decision after accepted stable parity and full drain/recovery evidence | STOP; no automatic restart, scheduler or business writes. |

Preparation priority is G2/G4/G5 design closure, G3 authorized access proof in
parallel only when independently approved, then G6 protected operational
readiness, G7 coordinated release review, and separately G8/G9 acceptance before
G10. These are dependencies for future work, not additional assigned tasks.

## Checks and handoff

Existing negative tests already cover both handlers, disabled SSR control,
private capture/provenance,
forged metadata/signatures, zero prepared DB POSTs and pre-I/O recovery rejection.
No duplicate regression test is added; no production code or SQL changes.

Actual restricted-inner results on 2026-11-04, Node 24.22.2, native PostgreSQL
16.15 installed locally (no local PG17 installation):

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web` | PASS; 71 packages, lockfile unchanged. Dependency installation only; no source/OAuth request. |
| Eight focused offline files, command below | **106 PASS / 0 FAIL / 0 SKIP**. All HTTP dependencies injected; no real Google/DB request. |
| `npm run check` | **FAIL: 52 file-level results / 44 PASS / 8 FAIL / 0 SKIP**. Three protected-runtime failures and five native socket failures. Its TS/build stages were not reached. These totals are not the outer runner's native subtest totals. |
| Five focused native files, command below | **9 tests / 4 PASS / 5 FAIL / 0 SKIP**. Atomic listener denied `listen EPERM 127.0.0.1`; attestor, backup/restore, rehearsal and hardening PG16.15 cannot bind Unix sockets (`Operation not permitted`), before native server assertions. No concurrency, SCRAM, RLS or restore PASS from this execution. |
| `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS independently of the failed combined check. |
| `node node_modules/next/dist/bin/next build` in `web/` | PASS independently; optimized Next 15.5.27 build. No browser/source parity inferred. |
| Four audit generators with `--check`, below | PASS: 22 pages / 7 API routes / 758 static visual/control templates; 6 static KPI contracts; 35 prepared relation diagnostics, SQL not executed; 66 browser cases all NOT_EXECUTED. |
| `git diff --check`, report link/whitespace checks | PASS; all local report links resolve. Final file scope: this report only; all preexisting tracked files unchanged. |

Focused offline reproduction:

```sh
node --experimental-strip-types --test --test-isolation=none \
  web/tests/data-sync-safety-gate.test.mjs \
  web/tests/scheduled-sync-vault.test.mjs \
  web/tests/google-sheet-reader.test.mjs \
  web/tests/private-sales-header-probe.test.mjs \
  web/tests/prepared-sales-sheet-capture.test.mjs \
  web/tests/prepared-sales-provenance.test.mjs \
  web/tests/prepared-sales-transport.test.mjs \
  web/tests/prepared-sales-cutover.test.mjs
```

Native blocker reproduction:

```sh
node --experimental-strip-types --test --test-isolation=none \
  web/tests/sales-atomic-postgres.test.mjs \
  web/tests/sales-attestor-postgres.test.mjs \
  web/tests/sales-backup-restore-postgres.test.mjs \
  web/tests/sales-rehearsal-postgres.test.mjs \
  web/tests/sales-role-hardening-postgres.test.mjs
```

The other full-check failures are `.agents/run.test.mjs`,
`web/tests/operating-tasks.test.mjs` and `web/tests/operating-v2.test.mjs` in
this workspace's protected `.agents/runtime` path (ENOENT/access failure).
No permissions, tests, skips, environment fallback or workflow are changed to
clear them. No inner failure is interpreted as remote drift or outer failure.

Static artifact checks (no regeneration, HTTP or diagnostic SQL execution):

```sh
node scripts/bi-audit-inventory.mjs --check
node scripts/bi-audit-contracts.mjs --check
node scripts/bi-audit-queries.mjs --check
node scripts/bi-audit-browser-qa.mjs --check
git diff --check
```

Full local verification is **BLOCKED** by the reproduced restrictions; this is
not a green full check. The authorized outer runner must run the unchanged full
suite and sequential exact-SHA PG16/PG17 acceptance, with no failures/skips, before
safe handoff to PR #44. No candidate commit, new SHA or post-push run is claimed
inside Codex. Temporary diagnostic logs remain under `/tmp`, outside the handoff.

The runner alone may attach this report to existing PR #44 after its exact-SHA
checks. **PREPARE ONLY / NOT READY FOR GATE** remains the release disposition
even if repository verification passes. No original issue-wide completeness,
live correctness, independent attestation, production remediation or release
approval is claimed.
