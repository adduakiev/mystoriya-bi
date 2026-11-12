# Issue #43 / existing PR #44 — private typed source capture preparation

**PREPARED ONLY — NOT READY FOR GATE.** Starting branch
`astra/issue-43-40107435112`, clean starting HEAD
`c0dcc6b98d5f33074d76c090074480c46adf007b`, independently verified locally.
WORKING was acknowledged in the Codex transcript; no remote GitHub comment,
commit, push or PR creation is asserted. Only the trusted workflow may publish
this candidate to existing PR #44 after its own checks. No automatic next task.

The dispatch supplies [trusted Actions 41562042936](https://github.com/adduakiev/mystoriya-bi/actions/runs/41562042936):
494/494 native tests, zero skips, PostgreSQL 16.15 concurrency/cancellation/47k,
TypeScript and optimized Next build, followed by the exact base HEAD above.
That receipt verifies the base, not this uncommitted candidate. Earlier inner
sandbox failures do not negate that external receipt.

## Prepared interface and boundary

`supabase/functions/sync-google-sheet/prepared-sales-sheet-capture.mjs` exports
`capturePreparedPrivateSalesSheet(secret, { fetchImpl, signal?, timeoutMs? })`.
It is an explicit server-only dependency with no default fetch, environment
lookup, CLI, logging, persistence, import-time I/O or production references.
The supplied fetch and secret are trusted server dependencies, never HTTP input.
Other option keys, including caller URLs, ranges, headers and tokens, fail before
network. The existing reader changes only by exporting its existing token helper;
its validation, reader behavior and stringification remain unchanged.

The adapter reuses that helper's fixed private service-account identity and
cryptographically signed JWT exchange at `https://oauth2.googleapis.com/token`,
with **only** `https://www.googleapis.com/auth/spreadsheets.readonly`. No token
injection bypass, anonymous gviz fallback, retry or public-source path exists.
All tests use mocked HTTP/token responses and ephemeral synthetic RSA material;
no actual Google credential was created, obtained, supplied, changed or retained.

Each invocation obtains a fresh token and makes one Values API GET against the
existing fixed spreadsheet ID exported by the reader. Server-pinned parameters:

| Parameter | Fixed value |
| --- | --- |
| requestedRange | `'Данние короткі'!A:N` |
| majorDimension | `ROWS` |
| valueRenderOption | `UNFORMATTED_VALUE` |
| dateTimeRenderOption | `SERIAL_NUMBER` |

The GET omits cookies, disables cache and refuses redirects. It requires status
200, the fixed final URL if supplied by fetch, JSON/UTF-8 content type and a
bounded JSON body (32 MiB even without Content-Length). A supplied uncompressed
Content-Length must equal bytes consumed; compressed length is retained but is
not compared to the decoded byte count. No response body or upstream error text
is included in errors. Errors expose only fixed `SALES_CAPTURE_*` codes, without
causes, source values, credentials or response headers.

## Returned evidence — confidential and in memory only

JSDoc and runtime validation define `SalesCapture`, `CaptureResponseMetadata`
and `PreparedSalesObservation`. The frozen result contains:

- `capture`: exactly the seven fields consumed by `canonicalSalesSourceBytes`.
  Request fields come only from fixed constants; range/dimension/values come
  from validated Google JSON. Rows/cells retain original string/number/null
  types, order, blank representation, Unicode and whitespace. All arrays and
  objects are frozen. No String coercion occurs in this projection.
- `responseMetadata`: immutable fixed request URL, original status, redirect
  flag, Content-Type, Content-Length, Content-Encoding, Date and decoded body
  byte count. Only these validated headers are retained. Arbitrary headers,
  cookies and Authorization are excluded. HTTP Date is upstream metadata,
  **not** an independently authenticated observation timestamp.
- `responseBodySha256` and `copyResponseBodyBytes()`: SHA-256 of the exact JSON
  bytes consumed from `Response.body`, plus defensive copies of those bytes.
  Original JSON whitespace and numeric lexemes survive. With transparent fetch
  decompression these are the decoded API body bytes, not compressed wire/TLS
  bytes. Nothing is serialized, written, uploaded or logged by the adapter.
- `sourceSha256`: SHA-256 of the existing canonical typed serialization of
  `capture`, computed through the unchanged provenance contract. This differs
  intentionally from the original-body fingerprint.

The entire result, including its capture and byte-copy function, must remain
private. It is not suitable for an HTTP response, log or PR attachment. The code
provides no evidence retention store, encryption/signing service or permission
to persist evidence. Future retention needs its own existing approved private
location and owner authorization. A public hash is not source authenticity.

Validation rejects malformed/partial ranges, missing/extra fields, more than
200,001 rows including header, row widths other than 14, invalid required
headers/cells, booleans/objects, lone Unicode surrogates, invalid UTF-8 and JSON.
The unchanged canonical validator also rejects unsafe monetary numbers. The
adapter additionally compares numeric JSON lexemes with their parsed decimal
representation before projection, rejecting unsafe integers, negative zero,
overflow/underflow or lost decimal digits. Exact large monetary strings remain
strings. Missing values never become zero. Unused null cells remain null.

A response range may end after the final value row because the Values API omits
trailing empty rows. The fixed A1:N range must include every returned row; this
is a structural check, **not proof of source completeness or historical closure**.
The existing baseline/preparer and provenance gates remain separately required.

## Separate observations, timeout and limitations

One explicit invocation returns one observation. A future approved server/reviewer
may invoke it independently for a first and a second observation and pass each
`.capture` to the existing verifier. This module neither schedules nor bundles
those calls, signs them, supplies observer identities, attests independence nor
creates an authenticated prior receipt. Separate custodians/read authorizations,
trusted clocks, signatures and a valid prior chain remain external closed gates.
No live invocation was performed, including header probes.

The outer deadline defaults to 30 seconds (explicit test/server override 1–30,000
ms) and covers OAuth, Values headers/body and hashing. External abort is forwarded
to both requests. Each awaited operation races cancellation, so even a mocked
fetch/body that ignores AbortSignal cannot hold the adapter caller open. Late
OAuth success cannot start a Values request after the adapter has stopped.
Stream cleanup is best-effort and cannot hold the caller open. The existing
OAuth helper retains its own 30-second deadline; an injected dependency that
ignores abort can remain pending internally until its own settlement/deadline.
There is no retry, observation reuse or production observation timestamp claim.

Synthetic tests compare retained HTTP bytes/fingerprint, immutable typed capture
and existing canonical digest; preserve distinct typed versus text values; and
reconcile exact-cent sale preparation through the existing provenance function.
The fixture includes a header, repeated raw identities, serial/ISO/MDY/DMY dates,
large exact monetary strings, refunds and zero/unknown distinctions. Auth,
server-only isolation, response failures, precision loss, Unicode, byte limits,
abort, ignored cancellation, late token settlement and no runtime wiring are
covered without contacting Google or a business system.

## Verification and single next gate

Actual local outcomes and file fingerprints are in
[sales-sheet-capture-verification-2026-11-03.json](sales-sheet-capture-verification-2026-11-03.json).
The required single next gate is **trusted outer-runner verification of its exact
new candidate SHA**, with all native tests, zero skips, real PostgreSQL server
concurrency/cancellation/47k, TypeScript, optimized Next build, inventory check
and diff check, followed by handoff on existing PR #44 only. An inner sandbox
socket restriction is not a waiver or a green candidate receipt.

Both unconditional Next/Edge `SALES_IMPORT_SAFETY_GATE` 503 handlers, legacy
mutators and the draft SQL remain byte-identical. SQL is NOT APPLIED and still
ends with its review-safe ROLLBACK. No migrations, SQL/Edge wiring, import,
button/cron/trigger, grant, production request, business write or release occurred.
No authentic source hash is attributed to the legacy 2026-10-30 run and no
`accepted_source_v1` metadata or bootstrap/trust root is created.

Owner-only credential/read-access, evidence-retention, backup/restore, reviewed
SQL/grants and writer quiescence, coordinated release, first import and later
scheduling decisions remain held. No owner action or new task dispatch is
requested by this patch. Broader issue #43 source/warehouse/RPC/UI and browser
proofs remain incomplete. This preparation does not authorize the next gate.

## Local verification receipt

| Check | Actual result |
| --- | --- |
| `npm ci --prefix web` | PASS; lockfile unchanged |
| Final focused reader/capture/provenance/preparation/transport/preflight/503 suite | 94 PASS, 0 FAIL, 0 SKIP; includes all 22 new capture tests |
| `npm run check` in original workspace | 42 passing test files, 4 failing files, 0 SKIP; three `.agents/runtime` write restrictions and PostgreSQL loopback failure; pipeline stops before TS/build |
| Final `npm run check` in writable `/tmp` archive with byte-verified final code/test | 45 passing test files, 1 failing file, 0 SKIP; only server fixture startup fails; pipeline stops before TS/build |
| Expanded native suite in the same writable copy | 500 PASS, 1 FAIL, 0 SKIP; sole failure is server startup EPERM; nested server fixtures never execute |
| Real PostgreSQL single-user preparation fixture | PASS in both full runs; synthetic 47k/precision/rollback coverage; does not substitute for server concurrency/cancellation |
| TypeScript, independently in original workspace | PASS: `node web/node_modules/typescript/bin/tsc --noEmit --project web/tsconfig.json` |
| Optimized Next build, independently in `web` | PASS: `node node_modules/next/dist/bin/next build` |
| `node scripts/bi-audit-inventory.mjs --check` | PASS: 22 pages, 7 API routes, 758 templates; live parity UNKNOWN |
| `git diff --check` | PASS |
| Original handlers, legacy source, SQL and owner-control files | Byte comparisons to HEAD PASS; reader differs only by token-helper export/comment |
| Live Google/source/Supabase calls or authenticated browser QA | NOT EXECUTED |

Reproduce the remaining server failure with
`node --test --test-isolation=none web/tests/sales-atomic-postgres.test.mjs`:
`Error: listen EPERM: operation not permitted 127.0.0.1`, before the server/nested
concurrency/cancellation/47k fixtures can execute. PostgreSQL binaries are present;
no skips, permission workarounds or weaker assertions were introduced. The three
runtime test files pass in the writable archive. These are inner Codex sandbox
results; trusted outer-runner acceptance of the **new** candidate is still required.

Local HEAD remains `c0dcc6b98d5f33074d76c090074480c46adf007b` with uncommitted
changes. A new candidate commit SHA and runner URL cannot be supplied by Codex;
file fingerprints are retained in the JSON receipt. **NOT READY FOR GATE.**
