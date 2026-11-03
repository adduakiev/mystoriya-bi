# Issue #43 / PR #44 — standalone private header probe preparation

PREPARE ONLY. No live probe, OAuth, Google request, credential lookup, database
operation, import, migration, deployment or schedule change was performed.
WORKING was acknowledged in the implementation transcript. GitHub status
publication belongs to the trusted runner. Full acceptance is BLOCKED by the
local socket restrictions and unavailable independent remote verification below.

## Base and isolation

The original workspace is on `astra/issue-43-40107435112`, starting clean at the
exact dispatched HEAD `8a9c82aed2cbc6dca5e8a728be9772ede978a836`. Work used an
isolated local clone detached at that same SHA: the sandbox denies creation of
`.git/worktrees`. Final changed files are copied back byte-for-byte, uncommitted.
No commit, push, new PR, merge or GitHub setting change is authorized here.

`git ls-remote origin refs/heads/astra/issue-43-40107435112` fails with
`Could not resolve host: github.com`. Thus actual remote PR HEAD, D197/D198,
post-change Actions and Vercel status cannot be independently read here. The
trigger's essential contract and existing cutover candidate document were read.
The trigger reports exact-base Actions
[41607019385](https://github.com/adduakiev/mystoriya-bi/actions/runs/41607019385)
as PostgreSQL 16.15, 530 PASS / 0 FAIL / 0 SKIP, and same-SHA Vercel READY.
Those are supplied historical receipts, not new independently verified results
and not evidence for these uncommitted files. No new SHA/run/preview is invented.

## Prepared boundary

Implementation: `supabase/functions/sync-google-sheet/private-sales-header-probe.mjs`.
The only export is `probePrivateSalesHeader(secret, {fetchImpl, signal?})`.
A future separately authorized **server** caller supplies an existing credential
from its approved secret manager and a trusted transport. There is no default
fetch, CLI, request handler, UI, environment lookup, dependency import, logger,
persistence or import-time I/O. Browser/window/document/worker contexts fail.
Unknown options fail, including endpoint/range/scope/deadline overrides. Nothing
imports this module from deployed runtimes or the combined cutover preview.

A valid invocation permits exactly:

1. One RS256 OAuth POST to `https://oauth2.googleapis.com/token`, fixed issuer
   `myastoriya-bi-sheets-reader@myastoriya-bi.iam.gserviceaccount.com`, same fixed
   audience, five-minute assertion and sole scope
   `https://www.googleapis.com/auth/spreadsheets.readonly`.
2. One authenticated Sheets v4 GET for spreadsheet
   `1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA`, range
   `'Данние короткі'!A1:N1`, `ROWS`, `UNFORMATTED_VALUE`, `SERIAL_NUMBER`.

Both requests use `redirect: error`, `credentials: omit`, `cache: no-store` and
one abort signal. There is no retry, redirect follow, alternate destination or
additional read. A shared 30-second race covers signing, OAuth, GET and all body
reads; guards prevent late continuations from starting a further request after
abort/deadline. Cancellation promises are never awaited. An uncooperative
injected dependency may continue internally; it cannot hold the returned promise
open or authorize any later request. The injected transport is a trusted server
dependency, not a caller-controlled proxy or an authorization boundary itself.

Require HTTP **200**, JSON/UTF-8, at most **32 KiB per response**, exact returned
range and dimension, exactly one row of exactly 14 string cells, valid Unicode,
and normalized NFC/whitespace equality of the nine labels at zero-based positions
5–13. Tests check parity with `source-safety.mjs`. Duplicate JSON keys, escaped
duplicate aliases, excessive nesting, unsafe tokens/scopes, missing/extra
metadata, invalid headers/width and HTTP/network/signature failures all fail.
Bounded streaming rejects empty/invalid chunks as well as excess total bytes.
No full-sheet read or permissive padding/conversion is available.

The sole public result is a frozen `{code: "PASS" | "FAIL", timestamp: ISO_UTC}`
with the invocation start time. No stage diagnostics, source cells, headers,
response text, assertions, keys, tokens, options or error causes are exposed.
`PASS` means only header access/shape validation for that invocation. It proves
no freshness, row coverage, source acceptance, historical provenance or write
permission. No existing reader or production path was modified.

## Offline verification

Synthetic ephemeral signing keys and synthetic fetch/stream fakes only. The
focused suite covers actual signature verification, exact requests/options,
expired/revoked credential denials, wrong account/scope/key, broken signatures,
401/403/429/5xx, redirects, malformed/oversized bodies and metadata, all nine
labels, normalization, leak canaries, fixed output keys, zero forbidden calls,
no retries, deadlines/aborts in every phase, late completion, blocked runtime
references/imports and byte-identical deployed guards. Mock timers advance the
fixed real contract; no shorter production deadline or skip is introduced.

| Check | Actual local result |
| --- | --- |
| `npm ci --prefix web` | PASS; lockfile unchanged |
| `node --test --test-isolation=none web/tests/private-sales-header-probe.test.mjs` | 25 PASS / 0 FAIL / 0 SKIP |
| Full `npm run check` | FAIL: 47 test files PASS / 3 FAIL / 0 SKIP; stops before TypeScript/build |
| TypeScript `--noEmit` (independently) | PASS |
| Optimized Next production build (independently) | PASS |
| Inventory `node scripts/bi-audit-inventory.mjs --check` | PASS: 22 pages, 7 APIs, 758 visual/control templates; no inventory changes |
| `git diff --check`, including no-index checks for new files | PASS |
| Real Google/Supabase/browser/production/remote PR verification | NOT EXECUTED |

The full-check counts above are **test files** as reported by this sandbox's
isolated Node runner, not the outer workflow's individual-test count. No native
PostgreSQL test was removed, weakened or skipped. PostgreSQL binaries are 16.15.
Reproduce the native blockers with:

```bash
node --test --test-isolation=none web/tests/sales-atomic-postgres.test.mjs web/tests/sales-backup-restore-postgres.test.mjs web/tests/sales-role-hardening-postgres.test.mjs
```

Atomic fixture: `listen EPERM` on `127.0.0.1`. Backup/restore and role-hardening
fixtures: PostgreSQL cannot bind their disposable Unix-domain sockets,
`Operation not permitted`, then `pg_ctl` fails. These are failures, not waivers.
The trusted **outer** runner must run the complete native suite on the final
published SHA with zero FAIL and zero SKIP; this environment cannot certify it.

## Handoff and unchanged STOP gates

Only this probe, its offline regression suite and review documentation are in
scope. The Next Preview POST and Edge entrypoint retain their unconditional
503s; tests pin both complete file hashes and scan runtime references. Legacy
batch/finalize, staging, promotion, scheduler and combined preview remain
unreachable from this module. SQL is unchanged and NOT APPLIED. Wider Digital,
UX, Data Gap and tab audits are intentionally not continued in this task.

The trusted workflow must verify actual PR #44 HEAD has not drifted from the
dispatched SHA before handing off these files, then run full native acceptance,
attach its real resulting SHA/Actions URL, and independently verify same-SHA
Vercel Preview where available. Retain the same existing branch and PR. Codex
leaves changes uncommitted; no post-commit receipt exists in this session.

Separate STOP gates remain: authorization for any future live header check and
existing credential/access use; an approved historical `accepted_source_v1`
trust root; independently authenticated DB promotion and receipt persistence;
a real protected backup with proven restore; and coordinated SQL/grant/cutover,
merge/deployment/first-import approvals. An access PASS or green offline/native
suite opens none of those gates. No credential or owner approval is requested
for this completed offline preparation.
