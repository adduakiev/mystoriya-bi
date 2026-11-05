# D262 — isolated authenticated Edge header probe preparation

2026-11-05 UTC. Issue #43 / existing PR #44 / branch
`astra/issue-43-40107435112`. **PREPARE ONLY — NOT RELEASED.**
WORKING was acknowledged in the implementation transcript. GitHub publication,
remote drift checks, final commit/push and PR handoff belong to the trusted outer
runner. No new PR or commit was created inside Codex.

## Baseline and evidence limits

The supplied trusted outer gate is authoritative for PR #44 OPEN / UNMERGED,
remote branch and clean exact baseline. Independent local checks found HEAD
`701c77ea9fefaaac5a894737e8369e1816c5301c`, the required branch and an empty
`git status --porcelain=v1` before edits. Local process inspection found only
this Codex sandbox, with no concurrent local Astra process. No inner remote
network/auth retry was made; local checks do not independently establish remote
concurrency or post-change remote status.

D258 header PASS, D260 secret-name presence and D261 installed v9 inspection
are supplied issue evidence, not live observations repeated in this session.
The existing Node probe cannot establish availability in Edge. This preparation
does not establish availability either: **no credential was read, no live source
was contacted, and no Edge function was deployed or invoked**. Tests use only
ephemeral synthetic keys and fake transports. No actual secret values appear
in the source, fixtures or this document.

## Prepared boundary

- New, otherwise unreferenced entry:
  `supabase/functions/sales-private-header-probe/index.ts`.
- Sole dependency: the existing prepared `google-sheet-reader.mjs`. It is called
  with `probe:true` and a destination/count/deadline-constrained transport.
  The Node-only probe and its WorkerGlobalScope seal are untouched.
- Importing the new entry starts no listener, reads no environment and performs
  no I/O. Only explicit main entry execution registers its handler. No existing
  runtime, UI, API, workflow, deployment config or scheduler references it.
- Only a POST with a server operator's exact existing built-in service-role
  bearer JWT is eligible. Before Google credentials or network, require HS256,
  JWT type, `iss=supabase`, unexpired integer `exp`, explicit `role=service_role`
  and full constant-time equal-length comparison against the server-only
  `SUPABASE_SERVICE_ROLE_KEY`. Claim decoding alone never authenticates. Anon,
  ordinary authenticated users, malformed/forged/expired tokens and missing or
  incompatible built-in keys fail closed. No Auth API, Supabase client, JWT
  signing secret, additional key creation or external verification request.
- The built-in service-role key lookup is solely the local authentication
  dependency; `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` is read only after successful
  authentication and request validation. Browser globals fail closed. Body,
  query, browser origin/cookie, range/authorization forwarding and method
  override inputs cannot configure the probe. No CORS permission is granted.
- After authentication: at most one OAuth POST to
  `https://oauth2.googleapis.com/token` followed by at most one Sheets v4 GET
  for the reader's fixed spreadsheet and `'Данние короткі'!A1:N1`. The reader
  signs the fixed account's RS256 assertion with only
  `https://www.googleapis.com/auth/spreadsheets.readonly`. No other row read,
  retry, redirect, fallback, caller-selected destination or scope is available.
- A shared 30-second deadline covers credential handling, signing, both requests
  and body consumption; the returned promise settles even if a synthetic
  dependency ignores abort. Guards forbid subsequent requests after the deadline.
  OAuth and header response sizes are bounded to 16 KiB and 32 KiB respectively.
  Real upstream responses must be HTTP 200, JSON/UTF-8 and nonredirected.
- Require the exact returned range, ROWS dimension, one row of 14 well-formed
  string cells and NFC/whitespace-normalized equality of the nine source-contract
  labels at positions F:N. A:E have no mandatory names in `source-safety.mjs`;
  tests retain parity with that established contract. Headers never leave the
  server boundary, including successful nonmandatory labels.

Every application response contains only `{code:'PASS'|'FAIL', timestamp}`.
PASS is HTTP 200; authentication rejection is 401; authenticated wrong method is
405; authenticated unsupported request inputs are 400; authorized credential,
upstream, schema or timeout failure is 503. All have no-store/no-cache, JSON,
nosniff, restrictive CSP, frame denial, no-referrer, HSTS and Vary Authorization
headers. Upstream errors, stacks, header values, tokens and keys are never emitted
or logged. Gateway-generated rejections are outside this application's response
contract and must be distinguished during a future authorized canary.

There is no DB, RPC, SQL, storage, persistent cache, telemetry, legacy writer,
finalize, refresh or business-action path. Next POST/GET, UI, existing Edge v9,
SQL and all tracked production paths remain unchanged.

## Future deployment contract — no authorization to execute

Any later isolated Edge canary requires a distinct owner authorization for the
specific deployment and invocation. Keep the gateway's built-in JWT verification
enabled (`verify_jwt=true`, the default); never use `--no-verify-jwt`. No config
change is prepared here. Gateway verification and this explicit service-role-only
guard are both mandatory; gateway acceptance of an ordinary user JWT is not
sufficient. A publishable/anon key or newer opaque key cannot bypass the handler.
If the runtime lacks the built-in legacy service-role JWT, STOP; do not provision
another key or relax authentication.

Before any separately approved live invocation, the trusted reviewer must verify
the exact reviewed bundle, default gateway JWT compatibility, server-only key
availability without exposing it, and main-entry listener semantics in the actual
Edge runtime. Node tests do not certify the Supabase gateway/runtime. Never wire
the probe into legacy imports, register a scheduler, expose service-role material
to a browser, or invoke installed `sync-google-sheet` v9. Even a future header
PASS proves only header access/schema; freshness, history, source acceptance,
backup/restore, independent attestation, SQL/grants, atomic recovery, deployment
and first-import gates remain separate and closed.

## Offline checks and handoff

Focused regression suite: `web/tests/sales-edge-header-probe.test.mjs`, 14 tests.
It covers auth-before-Google-secret/network, ordinary-role/forged/missing-key
denials, hostile requests, missing/invalid Google secret, actual synthetic RS256
signature verification, fixed scope/destinations, schema parity, sanitized
PASS/FAIL/status/security headers, upstream errors and size bounds, all four
noncooperating fetch/stream phases, signing timeout, shared total deadline,
absence of late requests, import side effects and runtime references/writes.

| Command | Local result |
| --- | --- |
| `npm ci --prefix web` | PASS; lockfile unchanged |
| `node --experimental-strip-types --test --test-isolation=none web/tests/sales-edge-header-probe.test.mjs web/tests/google-sheet-reader.test.mjs web/tests/private-sales-header-probe.test.mjs web/tests/data-sync-safety-gate.test.mjs` | 57 PASS / 0 FAIL / 0 SKIP |
| Standalone Edge TypeScript check (below) | PASS |
| `web/node_modules/.bin/tsc --noEmit --project web/tsconfig.json` | PASS |
| `cd web && node node_modules/next/dist/bin/next build` | PASS; optimized build |
| `npm run check` | Local sandbox failure; 48 test files PASS / 10 FAIL / 0 SKIP; stops before TypeScript/build |
| `git diff --check` and no-index whitespace checks of new files | PASS |
| Deployment, invocation, real credentials, source or gateway test | NOT EXECUTED |

Standalone Edge check (the web tsconfig does not include Supabase functions):

```sh
web/node_modules/.bin/tsc --noEmit --strict --allowJs --target ES2022 --lib ESNext,DOM --module ESNext --moduleResolution bundler --skipLibCheck supabase/functions/sales-private-header-probe/index.ts
```

Full-check counts are test **files** under this sandbox's isolated Node runner,
not the trusted outer individual-test count. Three existing runtime test files
cannot create `.agents/runtime` (ENOENT). Seven native Sales PostgreSQL fixture
files also fail in this restricted sandbox. Direct reproduction with
`node --test --test-isolation=none web/tests/sales-atomic-postgres.test.mjs web/tests/operating-v2.test.mjs`
shows `listen EPERM: operation not permitted 127.0.0.1` and the runtime mkdir
ENOENT respectively. No tests, guards or required native checks were removed,
redirected or skipped. These are local failures, not proof of trusted outer
failure, and not waivers of acceptance.

Trusted outer runner must run focused tests, complete `npm run check` (including
native fixtures, TypeScript and optimized Next build), this standalone Edge type
check and whitespace checks, then verify remote drift and publish only to the
same PR #44 if accepted. It must supply the actual final commit SHA and check
receipts. Codex leaves the candidate uncommitted at the baseline HEAD above;
there is no new final commit SHA, live PASS or release evidence to report.
