# Issue #43 / existing PR #44 — coordinated Sales recovery release checklist

**BLOCKED FOR RELEASE. Reviewable code and operational design; no production
execution authorized by this document.**

D230 recovery clarification: trusted Astra outer job [41866955709](https://github.com/adduakiev/mystoriya-bi/actions/runs/41866955709) ran 590/590 native PG16 tests PASS and Next/TypeScript PASS on a candidate, but its push was **REJECTED** because GitHub App lacks workflow-update permission. The workflow change and workflow-dependent regression have been EXCLUDED from the recovered candidate. No workflow/trigger/schedule was changed. Those 590 tests are NOT final immutable-SHA acceptance; independent PG16+PG17 must run for the actually published SHA. This checklist supersedes earlier
requirements to recover an authenticated historical source *as the only possible
recovery route*. The alternative below requires a distinct signed owner decision;
it does not turn the old warehouse into an authenticated Sheets source.

WORKING was acknowledged first. AGENTS.md was read first; local HEAD and clean
worktree matched the trusted outer baseline
`355e668497a4549109061d7d5b5e322112d8cba5`, branch
`astra/issue-43-40107435112`. No inner GitHub/DNS check was attempted. The runner
owns subsequent remote checks, publication and comments on PR #44. No commit,
push, new PR, production request, migration or secret inspection occurred here.

## Immediate decision and shortest critical path

The owner can approve retaining the original October-26-cutoff warehouse as a
**legacy unverified baseline**, with a signed transition at a newly measured,
backed-up checkpoint. Historical source bytes, source digest, original source
minimum and authenticated prior receipt remain **UNKNOWN**. Do not backfill
`accepted_source_v1`, set `atomic:true`, rewrite the legacy success, invent a
historical source hash, or feed a transition into the existing
`atomic-accepted/v1` verifier. Current Sheet bytes cannot prove what was imported.

The historical observation retained in the
[transport report](SALES-TRANSPORT-PREPARATION-2026-11-03.md) is a legacy success
on October 30, source cutoff October 26, 47,051 raw / 46,286 fact rows. Those
numbers identify a **dated observation**, not today's checkpoint or an expected
hardcoded volume. The original issue's October-22 baseline is older still.

Shortest path: exact-SHA native evidence → approve limited-trust transition and
attestor custody → real private read/backup/isolated restore and writer freeze →
implement and independently accept one evidence-bound SQL/server bundle →
separately authorize install and one manual import → verify all readback/UI →
decide scheduling separately. Native tests and credential presence do not waive
any operational prerequisite. Unrelated Digital work is outside this release.

## Contract audit: what can actually be combined

All SQL below is in `docs/sql`, NOT APPLIED, and defaults to ROLLBACK. These are
**alternative test/design artifacts, not a deployment sequence**.

| Artifact / exact interface | Actual behavior and integration disposition |
| --- | --- |
| `issue-43-sales-atomic-NOT-APPLIED.sql`: `public.begin_sales_snapshot_v2(jsonb) RETURNS uuid`, `stage_sales_batch_v2(uuid,integer,jsonb) RETURNS integer`, `commit_sales_snapshot_v2(uuid) RETURNS jsonb` | Begin writes import history/private reservation; stage writes batches. Original commit promotes facts, refreshes three MVs and increments generation, without authenticated source evidence. Useful atomic regression engine only; exposing it would violate the first-write gate. |
| `issue-43-sales-accepted-source-gate-NOT-APPLIED.sql`: replaces commit; adds `commit_sales_snapshot_with_evidence_v1(uuid,jsonb) RETURNS jsonb` | Both commits always raise `55000 / SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE`. Begin/stage still write. Not a successful recovery interface. |
| `issue-43-sales-prewrite-gate-NOT-APPLIED.sql`: replaces all four public interfaces | All always raise `55000 / SALES_PREWRITE_INDEPENDENT_SOURCE_ROOT_AND_IDENTITY_POLICY_UNAVAILABLE` before writes. Correct closure, no success implementation. |
| `issue-43-sales-role-hardening-NOT-APPLIED.sql` | Requires the **exact accepted-source rejection bodies**. Applying prewrite first changes those bodies and fails `SALES_ROLE_STOP_REJECTION_OVERLAY_REQUIRED`; applying hardening first does not authenticate begin/stage. Reported unsafe defaults separately cause `SALES_ROLE_STOP_DEFAULT_GRANTS`. Do not concatenate these drafts, remove checks, or describe them as a deployable bundle. |
| `issue-43-sales-attestor-NOT-APPLIED.sql`: `sales_attestor_private.review(uuid,jsonb)`, `read_receipt(uuid)` → jsonb | Restricted to disposable `sales_attestor_synthetic`. Actual LOGIN identity, protected fixture target, immutable receipts. Does not verify Google signatures/source or establish production custodians/root. |
| `issue-43-sales-preflight-proof-NOT-APPLIED.sql`: `sales_attestor_private.preflight(uuid,jsonb) RETURNS jsonb` | Synthetic root/target/generation read-and-lock decision; creates no per-call receipts/reservation/staging. Revokes the older receipt-producing review entrypoint. Positive result is not a later write capability. |
| `issue-43-sales-rehearsal-NOT-APPLIED.sql`: `sales_rehearsal_private.commit(uuid) RETURNS jsonb` | Separate disposable-only authority and commit. Requires the accepted-source rejection bodies and the earlier attestor review path. Not composable with the prewrite/preflight overlays as a successful production path; not authenticated idempotent public commit. |
| `prepared-sales-recovery.mjs`: `prepareSalesRecovery(matrix,{previous,now})` | Exact-cent aggregation, raw-count/date/header/cutoff/batch guards. Supplied `previous` bounds are a preparation constraint, not historical authenticity. SQL independently needs canonical-key/mapping guards. |
| `prepared-sales-sheet-capture.mjs`: `capturePreparedPrivateSalesSheet(secret,options)` | Fixed private typed capture, response-byte/source hashes, bounded read. No signature, independent collector or approval. |
| `prepared-sales-provenance.mjs`: `deriveSalesProvenance`, `verifyPreparedSalesProvenance`, `verifyPreparedSalesReadback` | Existing signature model requires an already authenticated `atomic-accepted/v1` prior. It cannot bootstrap legacy. JS tuple hashing is not interchangeable with PostgreSQL JSONB text hashing. WeakSet result is not DB authority. |
| `prepared-sales-transport.mjs`: `readBaseline`, `prepare`, `recover` | GET-only preparation demands `details.accepted_source_v1` which the reported legacy run lacks; no full cents/identity/generation-consistent read. `recover` always rejects before I/O. Do not bypass `accepted()` to make bootstrap work. |
| `prepared-sales-cutover.mjs`: `review`, `refresh` | `review` composes capture/GET preparation, still depends on that unavailable prior, returns BLOCKED and confidential bytes; `refresh` always rejects. No existing end-to-end success adapter. |
| Next `/api/data-sync` POST, Edge `sync-google-sheet`, `DataSyncControl` | Both POST guards return 503 and the manual button is disabled. Leave these bytes closed until the coordinated accepted bundle. Repository source is not deployed-state proof. |

## Minimal baseline transition — distinct trust type, not historical genesis

This is the proposed approval/encoding contract, **not implemented or installed**.
It deliberately requires no fabricated historical source root. Before signing,
the owner and an independent security reviewer must approve the measured values,
custodians, exact encoding and acceptable historical correction/loss policy.

1. Freeze/drain all actual writers under separately authorized maintenance.
   Obtain a consistent protected checkpoint and prove its isolated restore.
   Capture *all* fact identities with historical fact brand and exact cents,
   all six dimensions, aliases/lifecycle, import/raw/quality state, generation,
   sequences, ordinary flat view and all three MVs plus portable definitions,
   owners/ACLs/defaults/RLS/roles. Do not infer a nonexistent generation as zero;
   record its absence and approve one explicit initial version in the new design.
2. Retain encrypted checkpoint and restore-parity artifacts in the owner's private
   evidence store. Bind their content digests and immutable private object/version
   identifiers in the transition. Publish only redacted PASS/FAIL and artifact
   references. A signed warehouse hash authenticates this checkpoint observation,
   not the unknown historical source or financial accuracy.
3. Sign a fixed UTF-8 JSON tuple (no BOM/newline; dates ISO UTC, counts/generation
   decimal strings, null is explicit UNKNOWN; no JSON monetary numbers):

   ```text
   ["sales-legacy-warehouse-transition/v1", transitionId, projectRef,
    legacyRunId, "2026-10-26", "legacy-unverified",
    null, null, null,
    observedAt, expiresAt, checkpointWarehouseSha256, checkpointCatalogSha256,
    checkpointRows, measuredGenerationOrNull, approvedInitialGeneration,
    backupArtifactSha256, backupPrivateVersion, restoreParitySha256,
    aliasMappingSha256, policySha256, releaseCandidateSha, ownerDecisionId]
   ```

   The three nulls mean historical source hash, raw count and source minimum are
   unknown; dated legacy import metadata remains separately attributed. The
   October-26 cutoff is accepted only if the frozen checkpoint measurement agrees;
   a different cutoff requires an amended owner decision, never silent coercion.
   `projectRef` is `rxewpevxqtfmksybykvo`; UUIDs, exact hash encodings and version
   bounds must be validated by the future verifier. Owner and independent reviewer
   Ed25519 signatures cover these **same bytes**; key fingerprints and independence
   policy are pinned out of band by the approved provisioning operator, never
   supplied by a request, JWT, current Sheet or service-role-writable table.
4. In a separately authorized **policy-provisioning** transaction, verify both
   signatures against pinned keys, current checkpoint/backup/policy/candidate,
   unexpired window and project identity before installing the immutable transition
   anchor. This is itself a durable owner-gated DB write. No per-run target,
   receipt, reservation, sequence allocation or staging may precede verification.
   No root setter is exposed to API roles. Record any existing-version absence
   explicitly; do not silently initialize or reset a live generation.
5. Future live receipts reference `legacy-transition:<transitionSha256>` as a
   separately tagged predecessor on the first run; subsequent receipts reference
   the accepted live receipt. Preserve `historicalTrust:"legacy-unverified"`
   downstream. A new signed observation authenticates only the observed source
   and accepted transition; it cannot retroactively verify the old source.

## Live private Sheets → independently authenticated DB attestor

Proposed minimal chain: pinned owner/reviewer transition → two pinned independent
collectors' signed current captures → independently authenticated DB attestor
LOGINs → protected quorum/binding → first-write transaction → atomic promotion →
immutable receipt and canonical readback. **This chain is not implemented by the
synthetic SQL or the existing JS verifier.** No integration is enabled here.

Each collector independently reads the fixed private Sheet via the existing
readonly OAuth reader, retains its exact response bytes privately, derives typed
source/manifest/alias/proposed-warehouse digests, and verifies no historical key
loss against the frozen checkpoint. Collectors must agree on typed-source and
canonical result; raw HTTP byte hashes may differ from harmless JSON formatting
and must each be retained/signed, not falsely required to be equal. Changes in
Sheet content between reads require a new pair of observations, not a retry write.

Each signature binds a domain-separated, versioned fixed tuple containing project,
spreadsheet ID, requested and returned ranges, render modes, observer identity,
capture time/expiry, exact response hash, canonical typed-source hash, raw count,
date bounds, exact manifest bytes/hash, alias hash, proposed canonical warehouse
hash, transition/prior receipt hash, base/next generation, in-memory chosen run
UUID, policy hash and release SHA. Google OAuth/TLS authenticates access; the
Values API response is **not a Google-signed business record**. The signature
establishes the accountable collector's observation under the approved policy.

Use distinct independently controlled collector signing keys and direct private
TLS DB LOGIN attestors with pinned principal/independence groups. Each attestor
verifies **both** signatures and private artifacts against its own pinned policy
before submitting any durable approval. The DB trusts only those explicitly
approved authenticated `session_user` principals, not `current_user`, SET ROLE,
JWT claims, a service_role key, caller key IDs or a JS verification result.
Attestor custody/runtime/network access, DB auth and key provisioning require
specific owner authorization; no credentials are created or requested here.

The future SQL must restrict the first approval insertion to approved attestors,
recheck pinned prior/checkpoint/generation/expiry under locks before that first
write, and require two independent matching approvals before reservation/staging.
One fixed lock order is generation → active prior/transition → run/binding.
Reauthenticate and recheck inside **every** write transaction; preflight results
are not bearer tokens. API roles receive no direct table/column/sequence/TRUNCATE,
schema CREATE, owner membership or proof/root provisioning capability. Stale,
expired, changed mapping, mismatched bytes, replay and missing quorum reject before
business writes. Neither a service-role request nor timeout can mint approval.

The coordinated implementation still required is one private, versioned SQL API
for authenticated approval, bound reservation/staging, promotion and receipt
readback, plus a matching server adapter. Design the exact signatures together;
do not invent working calls to the rejection-only public v2 interfaces. Promotion
must compare exact staged manifest/canonical identities/cents to approved digests,
replace facts and all three MVs, persist the immutable source receipt/success and
increment generation in one transaction. Retry returns the exact prior receipt
only for an authenticated identical binding; ambiguous timeouts permit a readback,
never legacy finalize/reimport. No executable ungated helper may survive cutover.

## Automated no-write private access probe

[One-shot adapter](../../../scripts/sales-private-header-probe.mjs) wraps the
existing strict [header probe](../../../supabase/functions/sync-google-sheet/private-sales-header-probe.mjs).
It is disconnected from Edge/Next, has no DB dependency, and reads only the fixed
secret name after explicit `--read-only`. Importing it does nothing. Missing or
invalid credentials fail; no secret lookup fallback, source export, retry or
business write is available. Only `{code:"PASS"|"FAIL",timestamp:ISO_UTC}` exits;
exit code is 0/1. OAuth POST is token exchange; the only data request is GET of
`'Данние короткі'!A1:N1`, readonly scope, with one shared 30-second deadline.

Owner-run command in an already approved private Node ≥22.13 runtime with its
existing secret-manager injection, **not executed with a real secret here**:

```sh
node scripts/sales-private-header-probe.mjs --read-only
```

Do not paste the credential into arguments, terminal, logs, Git or this report.
The owner reports the custom Supabase secret exists; that is not evidence it is
available to this Node process. The script cannot fetch Supabase secret values.
Do not export a project secret or deploy/invoke Edge to make the probe run under
this authorization. If no approved runtime already has it, the exact blocker is
an owner-provisioned execution context, not a request to reveal the value. PASS
proves access/header only, not current rows/cutoff, root, reconciliation or release.

## Owner/operator checklist and acceptance sequence

Each unchecked item is a release STOP. “Approve recovery in principle” does not
grant the concrete actions below. Keep production 503s/button closed throughout
steps 1–7. Nothing in this run changes schedules, ACLs, source sharing or data.

- [ ] **1 — Runner:** verify latest PR #44 OPEN/head/branch; run sequential native
  PG16 then PG17 on the exact immutable final SHA, full check, zero fail/skip, and
  attach run/job URLs plus SHA. Prior Actions 41854056716 is not independent dual
  major evidence. Proposed `workflow_dispatch` changes were NOT published:
  GitHub rejected them because the runner token cannot update workflows.
  Use the ALREADY APPROVED independent native workflow and verify BOTH PG jobs
  logged the exact final PR HEAD; do not assume a GITHUB_TOKEN push triggers CI.
  No new workflow, privilege changes, tokens, PRs, or dispatch claims are allowed.
  Recheck the resulting job's logged candidate SHA, not just the event SHA;
  remote drift remains the trusted runner's responsibility.
- [ ] **2 — Owner + security reviewer:** sign the limited-trust transition policy,
  checkpoint scope, permitted historical corrections, key/principal fingerprints,
  independence/custody, capture retention and expiry. These policy choices are
  missing, not substitutes for missing historical evidence.
- [ ] **3 — Owner/operator:** approve the existing-secret readonly probe context
  and private full independent captures; record actual results. Secret existence
  is owner-reported only. No sharing/IAM/key changes implied.
- [ ] **4 — Owner/operator:** authorize protected real backup plus isolated restore,
  retention/access, RPO/RTO/loss policy; demonstrate complete parity. Inventory and
  separately authorize freeze/drain of cron, pg_net, manual, Edge, direct SQL/REST,
  external writers and DDL/ACL writers. Recheckpoint after drain. Reported cron
  `15 4 * * *` and API TRUNCATE/default ACL findings need fresh redacted measurement.
- [ ] **5 — Engineer + independent reviewer:** implement the single production
  trust/binding/success API and matching private adapter described above. Native
  PG16/17 acceptance must cover the actual wrappers and ACL/default handling,
  first-write witnesses (including sequence calls), missing/forged/expired/replayed
  proofs, cross-project data, lock waits/expiry, concurrent runs, cancellation at
  promotion, exact-cents/key parity and authenticated lost-response readback.
  Existing synthetic PASS would not satisfy this missing-code gate.
- [ ] **6 — Owner/security:** approve exact default-ACL resolution and scoped writer
  denials, protected anchor provisioning, production SQL/grant bundle and reviewed
  inverse. No global-default weakening or copied synthetic fixture roles. Unknown
  installed overloads/owners/inherited grants STOP. Test installation/inverse on
  the approved isolated restore, with no intermediate executable ungated RPC.
- [ ] **7 — Owner/release operator:** separately authorize merge/install/deploy of
  exact SQL, Edge and Next versions as a coordinated release. Verify deployed
  hashes/contracts and denial of every legacy/direct bypass while HTTP guards
  remain closed. Real backup/restore and steps 1–6 must already pass.
- [ ] **8 — Owner:** separately authorize one manual import against the pinned
  captures/transition. Recheck source/checkpoint/expiry under locks before first
  write. Open only the accepted manual path, with server auth/role, CSRF/request
  origin, no request-selected secrets/source/policy, no overlapping refresh and
  sanitized status. Button enablement alone supplies no authorization. No scheduler.
- [ ] **9 — Independent acceptance:** full canonical receipt/fact/dimension/cents,
  all three MV and generation readback; compare SQL/RPC/rendered Sales periods,
  filters, LFL/nulls/refunds and desktop/mobile source/freshness. Consistent reads
  and caches must pin generation. Preserve historical-unverified disclosure.
  Any discrepancy closes the manual path. Broader BI audit is still incomplete.
- [ ] **10 — Owner:** separately decide resumption/schedule after accepted stable
  parity and rollback readiness. No automatic resume or duplicate source task.

## Short rollback procedure to accept before release

1. Close the manual entrypoints/button; keep legacy mutators denied and all writer
   ingress frozen. Record candidate/binding/run/generation, never credential/data
   payloads. Do not retry an ambiguous import until authenticated receipt readback.
2. If promotion failed/cancelled before commit, disconnect/rollback and compare
   facts/dimensions/MVs/imports/receipt/generation to the checkpoint. Private prior
   staging may exist only if separately authenticated/authorized; sequence gaps
   are not transactional evidence of changed business facts. Native atomic tests
   exercise this boundary; no production rollback is claimed.
3. If a bad promotion committed, obtain the separately approved data-loss decision;
   restore the protected checkpoint into the approved isolated destination first,
   compare complete schema/data/ACL/RLS/sequence/three-MV parity, then execute the
   approved production restore/cutover. Reconcile all post-checkpoint activity.
   Receipt history must be preserved/audited under the approved restore policy;
   never edit a signed receipt to conceal a restore.
4. Apply only the reviewed schema/application inverse that retains rejection
   guards and writer denials. Verify denial and complete checkpoint parity before
   any owner decision to reopen. Never restore the unsafe old batch/finalize path.

The repository's disposable backup/restore test rehearses native dump/restore,
ownership/ACL parity, failed and cancelled mutations; atomic/rehearsal tests cover
promotion failure/concurrency. **The actual coordinated installation inverse and
production restore are untested and unimplemented.** This sequence must be tested
on the approved restore before step 7; it is not labeled a tested release rollback.

## This run: verification and handoff

No live Google, Supabase, upstream,
browser or production data proof is supplied by these local checks. No final
candidate SHA exists until the trusted runner publishes the working-tree changes.
The runner must post precise results and this checklist on existing PR #44;
Codex does not post to GitHub or claim READY FOR REVIEW with a green release gate.

Observed on Node 24.22.1, local native PostgreSQL 16.15:

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web` | PASS, 71 packages; lockfile unchanged. |
| Focused probe/closed-runtime suites in the unpublished Astra workspace | Passed with injected synthetic RSA/OAuth/Sheets. The workflow regression was tested there but **NOT published** because its workflow change was rejected; it must not be counted as a test in this recovered candidate. |
| Seven prepared source/capture/provenance/transport/cutover files | **96 PASS / 0 FAIL / 0 SKIP**; offline fixtures. Does not establish production source authenticity. |
| Six focused native PG16 files | **10 tests / 5 PASS / 5 FAIL / 0 SKIP**. The real single-user 47k exact-cent promotion/reconciliation/rollback case passed; four static boundary checks passed. Atomic TCP listener failed `listen EPERM 127.0.0.1`; attestor, backup/restore, prewrite and rehearsal servers failed Unix socket binding `Operation not permitted`. Concurrency/SCRAM/restore assertions were not reached. |
| `npm run check` | FAIL; file-level report **46 PASS / 9 FAIL / 0 SKIP**. Six native server files fail in the socket-restricted environment; `.agents/run.test.mjs`, `operating-tasks.test.mjs`, `operating-v2.test.mjs` cannot create protected `.agents/runtime`. Combined check stops before TS/build. No skip, permission change or environment fallback added. |
| Separate `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS. |
| Separate `node node_modules/next/dist/bin/next build` from `web/` | PASS, optimized Next 15.5.27 build with type validation. |
| Native PG17 / independent immutable-SHA dual-major jobs | NOT EXECUTED; PG17 absent locally, no GitHub token/dispatch in Codex. Trusted runner must supply both results for the exact published SHA. Inner restrictions are not remote drift. |
| `git diff --check`; checklist local links | PASS. |

Reproduction of focused checks:

```sh
node --test --test-isolation=none \
  web/tests/sales-private-probe-cli.test.mjs \
  web/tests/private-sales-header-probe.test.mjs \
  web/tests/data-sync-safety-gate.test.mjs
node --test --test-isolation=none \
  web/tests/google-sheet-reader.test.mjs \
  web/tests/prepared-sales-recovery.test.mjs \
  web/tests/prepared-sales-sheet-capture.test.mjs \
  web/tests/prepared-sales-provenance.test.mjs \
  web/tests/prepared-sales-transport.test.mjs \
  web/tests/prepared-sales-cutover.test.mjs \
  web/tests/source-preflight.test.mjs
SALES_TEST_PG_BIN=/usr/lib/postgresql/16/bin node --test --test-isolation=none \
  web/tests/sales-atomic-postgres.test.mjs \
  web/tests/sales-attestor-postgres.test.mjs \
  web/tests/sales-backup-restore-postgres.test.mjs \
  web/tests/sales-rehearsal-postgres.test.mjs \
  web/tests/sales-prewrite-postgres.test.mjs \
  web/tests/prepared-sales-recovery-postgres.test.mjs
```

The limited-trust transition, independent collectors/DB trust chain, production
success API and deployment inverse above are **designs awaiting implementation
and acceptance**, not completed recovery capabilities. There is no real probe,
production backup/restore, writer freeze, anchor/ACL/SQL installation, import,
deployment, credential/scheduler/provider/SYRVE/ad change or live browser proof.
The immediate actionable decisions are the signed transition/custodian policy
and an approved private execution/backup/restore context, followed by acceptance
of the single missing coordinated API bundle. Do not respond to missing approvals
by adding another synthetic root or opening a rejection boundary.
