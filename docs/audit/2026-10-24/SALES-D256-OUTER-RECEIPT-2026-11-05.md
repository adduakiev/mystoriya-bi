# D256 — trusted D255 OUTER acceptance; mandatory exact-SHA dual-PG gate

Recorded 2026-11-05 UTC. PREPARE ONLY — NOT READY FOR GATE / NOT RELEASED.

## Verified origin and scope

- Same issue #43 and existing OPEN / UNMERGED PR #44, branch `astra/issue-43-40107435112`, D255 published revision `609e217bacbd4c2e8f655cedea586a05117a38eb`.
- Latest substantive Astra [Actions #42028826255](https://github.com/adduakiev/mystoriya-bi/actions/runs/42028826255), job [127249731045](https://github.com/adduakiev/mystoriya-bi/actions/runs/42028826255/job/127249731045), COMPLETED SUCCESS. Independently inspected the **trusted outer job log**, not its Codex inner sandbox: native **PostgreSQL 16.15**, full `npm run check` **623 tests / 623 PASS / 0 FAIL / 0 SKIP**. TypeScript, optimized Next.js build and `git diff --check` PASS. Its separate Codex sandbox encountered `.agents/runtime` ENOENT and localhost EPERM; those do not override the trusted outer PASS.
- Outer runner actually committed and pushed `609e217bacbd4c2e8f655cedea586a05117a38eb`. Compared with prior accepted `69fa480bacb587598ffb2cebb4d363f1ad55dce0`: exactly ONE commit, TWO modified files, `web/app/api/data-sync/status/route.ts` and `web/tests/data-sync-safety-gate.test.mjs`, no active POST/Edge/UI/SQL/migration changes.
- Independently read both exact-SHA changed blobs: status GET is unconditional HTTP **503**, `Cache-Control: no-store`, `ok:false`, `done:false`, `SALES_IMPORT_SAFETY_GATE` and truthful Ukrainian pause text. No RPC, historical success, revalidation, I/O, credentials or query-driven unlock. Hermetic test covers malicious parameters and absence of side effects.
- Vercel Preview deployment [dpl_8jCxrvMXpAiTwVnCsCP6PoVaUV5z](https://vercel.com/adduakiev-9572s-projects/mystoriya-bi/8jCxrvMXpAiTwVnCsCP6PoVaUV5z): **READY** for exactly `609e217bacbd4c2e8f655cedea586a05117a38eb`, branch `astra/issue-43-40107435112`, target Preview (NOT Production).
- GitHub repository Actions GET at adjudication time contained **NO exact-SHA push acceptance run** for `609e217bacbd4c2e8f655cedea586a05117a38eb` (the Astra runner used issue_comment event on main); the GitHub commit-specific workflow query was also empty. Therefore **PG17 and immutable-SHA dual-PG acceptance are NOT YET established** for D255.

## Required next safety gate

This **documentation-only** CAS-protected commit is made solely to trigger the existing push-based **Sales PR #44 exact-SHA native acceptance** workflow. Require independent full native **PG16+PG17** job logs and counters on this final SHA, successful TypeScript/Next build, successful exact-SHA Vercel Preview and unchanged PR head before accepting. Do not issue another Astra task while these checks remain unadjudicated. If accepted, queue exactly ONE subsequent reversible Sales Recovery item; actual private-Google-authorization, production source capture, independent signer/LOGIN authority, verified real backup/restore, compatible v9-to-safe-Edge cutover and authenticated source→warehouse→RPC→UI parity remain closed production gates.

Do not deploy, import, trigger refresh, merge, provision credentials, change production database, schedules, SYRVE, ad providers or sharing. Installed production Edge v9 remains unsafe; never invoke its legacy batch/finalize paths. Data Gap Workshop and Digital UX/UI v2 stay queued read-only.
