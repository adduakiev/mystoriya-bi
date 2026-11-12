# D265 — isolated canary 401 diagnosis blocked on real runtime evidence

2026-11-06 UTC. Issue #43 / existing open PR #44 / branch
`astra/issue-43-40107435112`. **BLOCKED — no proven repair; release gates closed.**
WORKING was acknowledged in the implementation transcript. This report is the
sanitized handoff for the trusted outer runner to publish to the existing issue
and PR; no GitHub comment, commit, push or new PR was made inside Codex.

## Baseline and scope

The supplied trusted outer gate establishes PR #44 OPEN/UNMERGED and the remote
baseline. Local `git rev-parse HEAD` matched exactly
`170643243491f52bce03399d6d8e8f7aacfb33e4`; `git status --short` was empty and
`git branch --show-current` matched the expected branch before work. Local
`git worktree list` showed only this checkout, and process inspection showed
only this Codex sandbox, with no concurrent local implementation process.
These local observations do not establish subsequent remote concurrency.
No inner GitHub authentication, DNS/drift check or credential access was attempted.
Subsequent remote drift checks and publication remain outer-runner responsibilities.

The D265 trigger supersedes the broad Digital/cosmetic audit for this turn.
Inspected the exact isolated handler, its reader dependency, focused regression
tests, D262/D263 preparation receipt, verification scripts and existing native
acceptance workflow. Handler, tests, existing `sync-google-sheet` v9, SQL,
imports, Production BI, credentials and schedules are unchanged. Only this
report is prepared. There is no auth relaxation or speculative runtime patch.

## Supplied live evidence — not repeated here

The owner-authorized Codespaces operator reportedly deployed only
`sales-private-header-probe`, ACTIVE v2 with `verify_jwt=true`, bundle SHA256
`5e71cc58d293de8a473623a68e197c369e05626259eb646c12fefebbb9bf7d0d`.
The single authorized server-to-Edge POST returned HTTP **401**:

```json
{"code":"FAIL","timestamp":"2026-11-06T11:18:38.601Z"}
```

This is **not PASS**. Its application-shaped response is consistent with handler
execution, but does not prove the particular branch or the deployed runtime's
globals. The supplied offline client-token assertions all passed (three
segments, HS256/JWT, service_role, supabase issuer, unexpired integer expiry,
43-character signature). They do not prove equality to the built-in key inside
Edge or even that this server key is present there. Neither the deployed bundle
nor its runtime was independently retrieved or inspected in this session.
No live invocation, deployment or secret lookup was performed.

## Code findings and supplemental synthetic observations

In `supabase/functions/sales-private-header-probe/index.ts`, the first branch of
`handleRequest` returns 401 when either `window` or `document` is defined. It
runs before `authorized()` and before any environment read. Thus a genuine
server runtime exposing either global would be rejected regardless of its key.
Whether the deployed Supabase runtime does so is **unproven**. Node's globals
cannot establish the answer, and a runtime/version difference matters.

Separately, `authorized()` validates the bearer shape/claims and then reads
`SUPABASE_SERVICE_ROLE_KEY`. Missing, empty or unequal values reject with 401;
exceptions before authentication also become 401. The full equal-length
constant-time token comparison remains essential. Valid-looking claims alone
cannot authenticate a caller. A Google credential error after authentication
instead produces 503, so Google header/schema investigation is premature.

A one-off Node 24.22.2 supplemental experiment imported the exact handler with
explicit fake environment/transport dependencies and an entirely synthetic JWT.
Both global and injected fetch implementations threw if called. Each case
asserted status, environment-read order and the sanitized response keys; global
descriptors were restored after each case. No real environment or key was read.

| Synthetic case | HTTP | Environment reads | Network calls |
| --- | --- | --- | --- |
| `window = globalThis`, matching synthetic server key | 401 | 0 | 0 |
| Defined `document`, matching synthetic server key | 401 | 0 | 0 |
| Neither global, absent synthetic server key | 401 | Built-in key only | 0 |
| Neither global, same-length key with final character changed | 401 | Built-in key only | 0 |
| Neither global, exact synthetic key, absent Google credential | 503 | Built-in key, then Google credential | 0 |

All five assertions passed. This reproduces the code paths and their ambiguous
401 outcome **only under synthetic Node conditions**; it is not real-Deno
regression coverage or proof of the live root cause. Existing focused tests also
cover forged/ordinary/expired auth and missing/incompatible built-in keys.

## Reproducible blocker and next offline work

`command -v deno` found no executable. A filename search of the local tool/cache
locations found no Deno runtime. One attempt to discover a downloadable runtime,
`npm view @deno/linux-x64-glibc versions --json --fetch-retries=0 --fetch-timeout=15000`,
failed with **EAI_AGAIN** resolving `registry.npmjs.org`. No retry, installation,
permission change or alternate network route followed. This is a tooling
limitation, **not remote branch drift**. Cached web dependency installation did
succeed independently. Native Deno execution and runtime verification cannot be
honestly reported from this sandbox.

Per D265's instruction, "If no reproducible safe fix, document precise blocker,
no speculative edits," no handler change is proposed. The trusted environment
needs to provide a real Deno/Supabase-compatible runtime and identify its version
without reading credentials or invoking any deployed function. The next offline
diagnosis should:

1. Record only runtime version and boolean presence/identity of `window`,
   `document`, `Deno.env.get` and `Deno.serve`. Never dump globals/environment.
   Use the deployed runtime version if available; generic Deno evidence alone
   does not certify Supabase Edge behavior.
2. Import the handler without starting a listener, inject synthetic dependencies,
   and reproduce authentication with the runtime's real, unmodified globals.
   Assert an exact synthetic server key advances to the Google credential phase
   only if the server runtime boundary permits it; deny network permissions and
   make the injected transport throw. Reproduce before editing.
3. If a runtime-global defect is proven, design the smallest positive trusted
   server runtime check. Do not simply remove the guard or trust a caller input
   or browser-spoofable `Deno` marker. Preserve exact JWT/constant-time key
   validation and all request/transport restrictions. Add regressions for the
   real runtime, DOM/browser (including spoofed runtime markers), absent server
   key, same-length mismatched key, ordinary/forged/expired auth, and zero Google
   credential reads/network on rejection. Keep import side effects absent.
4. If the guard is not reproduced in that runtime, keep the handler unchanged
   and retain missing/mismatched built-in key as an unresolved alternate cause.
   This turn does not authorize inspecting production secret values or making
   any additional live request. Do not move Codespaces secrets into this runner.

These are pending offline steps, not completed tests or a deployment procedure.
The failed live request is not converted to success by synthetic evidence.

## Verification performed in this sandbox

| Check | Result |
| --- | --- |
| `npm ci --prefix web` | PASS; lockfile unchanged |
| Focused command below | 57 PASS / 0 FAIL / 0 SKIP |
| Supplemental synthetic Node diagnostic above | Five cases PASS; not Deno proof |
| Standalone Edge TypeScript command below | PASS |
| `web/node_modules/.bin/tsc --noEmit --project web/tsconfig.json` | PASS |
| `cd web && node node_modules/next/dist/bin/next build` | PASS; optimized production build, no deployment |
| `npm run check` | FAIL: 58 test files, 48 PASS / 10 FAIL / 0 SKIP; stops before TypeScript/build |
| `git diff --check` and `git diff --no-index --check /dev/null docs/audit/2026-10-24/SALES-D265-CANARY-401-DIAGNOSIS-2026-11-06.md` | PASS; tracked diff empty, new report checked explicitly |
| Real Deno execution | BLOCKED: executable unavailable; registry DNS EAI_AGAIN |
| Trusted OUTER exact-SHA PostgreSQL 16 + 17 acceptance | Not available in Codex; not claimed |

Focused command:

```sh
node --experimental-strip-types --test --test-isolation=none web/tests/sales-edge-header-probe.test.mjs web/tests/google-sheet-reader.test.mjs web/tests/private-sales-header-probe.test.mjs web/tests/data-sync-safety-gate.test.mjs
```

Standalone Edge TypeScript command:

```sh
web/node_modules/.bin/tsc --noEmit --strict --allowJs --target ES2022 --lib ESNext,DOM --module ESNext --moduleResolution bundler --skipLibCheck supabase/functions/sales-private-header-probe/index.ts
```

The full-check counts are isolated test-file results, not trusted outer
individual-test counts. Three runtime files fail creating protected
`.agents/runtime` (`.agents/run.test.mjs`, `operating-tasks.test.mjs`,
`operating-v2.test.mjs`); seven native Sales files fail in the restricted sandbox
(`sales-atomic`, `sales-attestor`, `sales-backup-restore`, `sales-prewrite`,
`sales-rehearsal`, `sales-release-v234`, `sales-role-hardening`, all
`-postgres.test.mjs`). Direct diagnostic command:

```sh
node --experimental-strip-types --test --test-isolation=none web/tests/sales-atomic-postgres.test.mjs web/tests/sales-attestor-postgres.test.mjs web/tests/operating-v2.test.mjs
```

It reproduces `listen EPERM: operation not permitted 127.0.0.1`, PostgreSQL Unix
socket creation `Operation not permitted`, and runtime mkdir `ENOENT`.
PostgreSQL 16.15 binaries exist locally; PG17 is absent. No test skips, socket
fallbacks or safety-gate changes were introduced. These failures are not proof
of outer-runner failure and cannot waive exact-SHA dual-major acceptance.

## Handoff and closed gates

**BLOCKED on real-runtime reproduction; root cause unproven and repair not
implemented.** The report is left uncommitted on the baseline SHA for the trusted
outer runner. There is no new commit SHA or fresh remote receipt to report.
Outer runner publication must stay within existing issue #43 / PR #44 and its
branch, with remote drift/concurrency checks and acceptance before publication.
The existing native workflow must provide independent final immutable-SHA
PG16 then PG17 results; candidate checks and historical receipts do not replace
them.

No further live request is authorized in this task. Deployment, invocation,
source acceptance, import, SQL/migrations, business writes, credentials,
schedulers, production promotion and merge remain closed. Fixed read-only
`A1:N1`, zero body/query/cookies, JWT plus exact server-key validation, sanitized
output and absence of logging remain intact. The D262/D263 receipt remains
historical preparation/outer evidence; D265's supplied 401 establishes neither
header access nor safe atomic Sales recovery.
