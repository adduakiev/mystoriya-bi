# D286 — responsive overflow investigation, issue #43 / PR #44

**NO CHANGE to application code; browser reproduction BLOCKED.** The historical
17 route×width failures remain open. No current overflow measurement, responsible
DOM element, fix, regression failure control, or viewport PASS is claimed.

## Baseline and scope

- Local clean checkout: `astra/issue-43-40107435112`, exact HEAD
  `371607af0027e3197cd07e20f865a7a46bc4819e`.
- The supplied trusted OUTER gate is authoritative for PR #44 OPEN, expected
  branch and remote HEAD. Local HEAD matched; `git status --short` was empty.
  No additional inner GitHub authentication/DNS check was attempted.
- The supplied dispatch reports no other Astra writer. Local process inspection
  showed this Codex process and its command only; no additional writer was
  observed. This is not a substitute for the runner's subsequent drift gate.
- WORKING was recorded in the Codex commentary. No GitHub comment was posted
  inside Codex; the trusted runner must relay this NO CHANGE receipt to issue #43.
- Only D286 was investigated. No approved authenticated Preview session was
  available in this sandbox. No login, protection change, remote probe, source
  read/write, migration, import, scheduler, credential change or deployment ran.

## Source trace: hypothesis, not demonstrated root cause

`web/app/globals.css` sets `.shell` to `230px 1fr`, switching to `74px 1fr`
at 1100px. `.workspace` has `width:100%`, `max-width:1650px` and no explicit
`min-width`. At 720px the shell switches to block layout. These rules are
consistent with the automatic grid minimum hypothesis, but static inspection
does not establish which element expands the rendered page.

The intended table scrollers already exist:

| Route | Outer page structure | Intended inner scroller | Inner minimum width from CSS |
| --- | --- | --- | --- |
| `/` | `.shell > .workspace` | `.management-table-wrap` | `.management-table`: 1050px |
| `/delivery` | `.shell > .workspace` | `.delivery-table-wrap` | `.delivery-table`: 1220px |
| `/locations` | `.shell > .workspace` | `.locations-matrix-wrap` | `.locations-matrix`: 2050px |
| `/digital/local` | `.shell > .workspace` | Page-specific content; no table overflow assertion made | Unmeasured |

All three listed table wrappers use `overflow-x:auto`; `.panel` already uses
`overflow:hidden`. No rule was changed. A wide inner table is not itself proof
that `documentElement.scrollWidth > innerWidth`. No global overflow mask or
speculative `minmax`/`min-width` correction was added. D284 identity code is intact.

## Actual attempted browser evidence

1. Ran existing `node scripts/bi-audit-login-browser.mjs`. Its offline login
   startup checks at requested 360/768/1440 widths all returned
   `BLOCKED_BROWSER_STARTUP`, `SIGABRT`, `EPERM` before assertions. This login
   fixture is a browser availability check, not a BI shell reproduction.
2. Rendered the real `/delivery` page via existing
   `previewHarness().render('/delivery')`, with synthetic RPC responses and
   chart/session boundaries stubbed by that harness. Confirmed the generated
   markup contains `.shell`, `.workspace` and `.delivery-table-wrap`. Combined
   it with the unchanged repository CSS in `/tmp/d286-delivery.html`; CSP denied
   network and form actions. This is offline synthetic SSR, not authenticated
   Preview or live data.
3. Attempted that fixture at 768px with:

   ```sh
   timeout 15s chromium --headless --no-sandbox --disable-gpu \
     --disable-dev-shm-usage --disable-background-networking \
     --disable-breakpad --disable-crash-reporter --no-first-run \
     --user-data-dir=/tmp/d286-delivery-profile --window-size=768,900 \
     --force-device-scale-factor=1 --dump-dom file:///tmp/d286-delivery.html
   ```

   Exit **134**, before any measurement marker was emitted. The exact failure:

   ```text
   ERROR:third_party/crashpad/crashpad/util/linux/socket.cc:45
   setsockopt: Operation not permitted (1)
   FATAL:components/crash/core/app/crashpad_linux.cc:268
   Check failed: client.StartHandler(...)
   ```

4. An installed alternate `/opt/google/chrome/chrome` also failed its
   `about:blank` startup with the same `setsockopt` denial (exit 133). No sandbox
   restriction was weakened or bypassed.

The fixture's measurement script requested `innerWidth`, document scroll width,
workspace bounding width and elements extending past the viewport. It never
executed. Browser files/profiles/stderr stay in `/tmp`; no runtime artifact or
private session is included in this change. No screenshots were produced.

## Verification and remaining gates

| Inner command | Actual result |
| --- | --- |
| `npm ci --prefix web` | PASS, exit 0; 71 packages installed |
| `node --test web/tests/preview-ui-contracts.test.mjs web/tests/gbp-location-labels.test.mjs` | PASS, exit 0; reporter counts 2 file-level tests, 0 failures/skips; SSR/contract evidence only |
| `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` | PASS, exit 0 |
| `npm run check` | FAIL, exit 1; reporter counts 58 file-level tests: 48 pass, 10 fail, 0 skipped. Stops before its TypeScript/build stages |
| `cd web && node node_modules/next/dist/bin/next build` | PASS, exit 0; optimized Next.js 15.5.27 build, type validation and static generation completed separately |
| `git diff --check` | PASS |
| Browser viewport/layout and inner table scrolling | BLOCKED / UNVERIFIED, not PASS |
| Trusted OUTER PG16+PG17 / exact-new-SHA Preview | Not executed by inner Codex; no new application candidate SHA |

The full check's failures are `.agents/run.test.mjs`, `operating-tasks`,
`operating-v2`, and seven `sales-*-postgres` files: `atomic`, `attestor`,
`backup-restore`, `prewrite`, `rehearsal`, `release-v234`, `role-hardening`.
The captured output explicitly reports `ENOENT` while creating the protected
`.agents/runtime/` directory in `operating-tasks`. Other file-level failures
are not diagnosed by that reporter output; no PostgreSQL/RLS/concurrency success
is inferred. These failures were observed before any application-code change
(none was made). No runtime-directory permissions or test gates were changed.
Command output is local in `/tmp/d286-{focused,check,tsc,build}.log`.
Inner checks cannot certify OUTER PostgreSQL 16/17 acceptance or Vercel Preview
readiness. The trigger's accepted D284 receipt is historical baseline evidence,
not acceptance of this documentation change.

To resume D286, a trusted browser environment must measure the unchanged exact
baseline first. Compare document width with viewport width and inspect the shell,
workspace and outlying element bounds; separately measure wrapper client/scroll
width and verify a nonzero `scrollLeft` can reach the final table column. Check
360/768/1440 and representative `/`, `/delivery`, `/locations`, `/digital/local`.
Use offline synthetic markup if an approved Preview session remains unavailable;
label that evidence accordingly. If a common correction is proven, keep it in
shared layout, demonstrate the same regression fails against this starting SHA,
and preserve sidebar bounds, visible controls and intended table scrolling.
If the cause is route-specific, bound implementation to one route family.

No accepted application change exists in this attempt, so no new code SHA,
commit, push or PR was created. Exact-new-SHA OUTER PG16+PG17 checks and Preview
READY remain separate gates for any future candidate. Full PR #44 remains
**NOT RELEASED**; SU-545195 HOLD and all owner gates remain unchanged.
