# Issue #43 / same PR #44 — first-run provenance and repeatable atomic evidence

PREPARED ONLY / review model. Starting branch `astra/issue-43-40107435112`,
HEAD `2d64ce8232e4b762e7e09fbbf1b1226a3182dbea`, clean checkout verified locally.
This is the single D188 follow-up embedded in the issue trigger. It supersedes
no historical verification receipt and grants no production permission.

The trigger reports trusted [Actions 41551698285](https://github.com/adduakiev/mystoriya-bi/actions/runs/41551698285)
verified that exact base with 477 native tests, zero skips, actual disposable
PostgreSQL 16 concurrency/cancellation/47k, TypeScript and Next build. That is
**base evidence supplied by the trigger**, not a new local candidate result.
D188 retrieval is unnecessary; no production or GitHub request was made here.
WORKING was acknowledged in the Codex transcript; remote GitHub acknowledgement
and candidate publication belong to the trusted runner, and are not asserted here.

## Closed historical first-run attestation

The independently reported production read-only observation in D188 is:

| Item | Trigger-supplied evidence, not reread here |
| --- | --- |
| Last successful legacy run | `45cdf465-f316-4816-aee3-5ef3173bc5a5`, 2026-10-30 |
| Rows | 47,051 raw → 46,286 facts; zero rejects |
| Source cutoff / current fact cutoff | Through 2026-10-26 |
| Stored revenue / checks / markup | 550,196,474.56 UAH / 804,400 / 325,257,260.45 UAH; reported live warehouse reconciliation |
| Historical source minimum, canonical raw digest, retained original source, origin | UNKNOWN / NOT ESTABLISHED |
| `atomic` and `accepted_source_v1` | Absent on the historical run |

The row count, maximum date and amounts do not prove historical source minimum,
source identity, aliases, duplicates or original byte content. A current private
Sheet read cannot attest what the legacy run consumed. Warehouse reconstruction
cannot supply that source digest. Never set a synthetic `accepted_source_v1`,
mark a legacy run atomic, overwrite details, initialize generation from these
numbers, or treat a successful metadata/hash-format check as authentication.

A **future, separately approved historical attestation review** would require:

1. An independently retained original response/export actually consumed by that
   exact run, with authenticated acquisition time, private source identity,
   complete range/headers, raw row count, source bounds and integrity chain.
   If its capture format differs from the v1 encoding below, define and review
   that historical format separately; never pretend this version existed then.
2. A second independent custodian's read-only inspection of that same retained
   artifact and original run record, plus complete source→warehouse identity and
   cents reconciliation for the corresponding generation. Two current reads of
   today's Sheet are not these historical observations. Current facts also do
   not reconstruct an overwritten historical warehouse snapshot.
3. Explicit owner approval of the exact retained evidence, retention/access
   policy, independently authenticated trust-root receipt, and any future
   schema/cutover action. A historical receipt must remain labeled legacy
   attestation; it must not mutate the old run or masquerade as an atomic commit.

No such artifact, chain, or approval is established here. **Legacy bootstrap is
CLOSED**. The executable review model rejects all legacy/missing priors and has
no root creation API, initial-load branch or bypass. If evidence cannot be
recovered, the owner must decide a different, explicitly scoped recovery process;
this patch provides no alternative import path.

## Exact canonical source bytes v1

The new unreferenced module is
`supabase/functions/sync-google-sheet/prepared-sales-provenance.mjs`. It has no
network, signing, credentials, storage, SQL, CLI or environment dependency. Its
input capture is the typed Values API projection **before** the existing reader
coerces cells to strings. The existing reader is unchanged and does not yet emit
this capture. Fingerprinting its string matrix cannot recover original types.
A future capture adapter requires separate review; none is activated here.

Request contract: fixed private spreadsheet
`1g8NbVYEunt55lB-0E1OLQmNkeEQbF9y73n9kH3d3xbA`, range
`'Данние короткі'!A:N`, `majorDimension=ROWS`,
`valueRenderOption=UNFORMATTED_VALUE`, `dateTimeRenderOption=SERIAL_NUMBER`.
Full successful response only, not header probes, CSV/public exports, partial
ranges, cached clients or caller-selected URLs. Returned range must literally be
`'Данние короткі'!A1:N<positive integer>` with end row at least returned row count;
it may describe the grid beyond the final populated row. Capture and bind that
returned range exactly. Shape cannot establish completeness: authenticated
collectors must also attest the original request/response and absence of truncation.

Serialize exactly this nested array, in this order:

```text
["sales-source-bytes/v1", spreadsheetId, requestedRange, returnedRange,
 "ROWS", "UNFORMATTED_VALUE", "SERIAL_NUMBER", 14, [taggedRow0, taggedRow1, ...]]
```

Use ECMAScript `JSON.stringify` compact JSON, then UTF-8 `TextEncoder`, no BOM,
whitespace or final newline. SHA-256 is `crypto.subtle.digest('SHA-256', bytes)`,
rendered as 64 lowercase hexadecimal digits. No key sorting is needed: tuples
have fixed positions. Preserve row order, duplicates, all fourteen columns,
headers including A:E, and raw string code points, whitespace and line endings.
Do not NFC-normalize source evidence. JSON quotes/backslashes/control characters
use `JSON.stringify` escaping; other valid Unicode stays literal UTF-8. Reject
unpaired surrogates, booleans, objects, nonfinite numbers and negative zero.

Each row is right-padded to 14 cells; widths above 14 reject. A missing/hole/null
cell is `["blank"]`; an explicit empty string is `["string",""]`. A string is
`["string", originalString]`. A finite number is `["number", String(number)]`,
using ECMAScript's shortest round-trip decimal/exponent representation. Thus
number `1` and string `"1"` differ. JSON wire spellings `1.0` and `1` do not:
retain the original HTTP response privately if that difference matters. Numeric
money in L/N at absolute value ≥ 2^45 rejects before coercion, matching the
reader's conservative cents boundary; large amounts require exact source text.
Input requires header plus 1–200,000 data rows. Internal blank data rows are
included in the digest but business preflight rejects them. Source cells are not
timestamps for evidence purposes. Observation timestamps are separately signed
UTC `YYYY-MM-DDTHH:mm:ss.sssZ`, exact round-trip calendar validation; business
dates in F use the existing strict completed Europe/Kyiv date preflight, never
suffix/time truncation. Required F:N header labels use existing normalized
validation while their original bytes still participate in the source digest.

The golden synthetic vector in `web/tests/prepared-sales-provenance.test.mjs`
asserts literal bytes and digest
`f8816ba8773412c01e4935048e41f6793e75ab089bf98045b1585d6d7238bfe5`.
Changing order, Unicode composition, headers, cell types, range or ignored A:E
content changes the digest even when business totals remain equal.

## Source → canonical warehouse reconciliation

`deriveSalesProvenance` first runs the existing exact-decimal preparation. It
requires an accepted previous raw count and bounds, no row/date regression, and
latest completed Kyiv day. It hashes the **literal existing manifest JSON UTF-8**;
never JSON.parse/restringify monetary manifest or batch bodies.

For business identity only, apply the existing NFC/whitespace normalization and
strict date/decimal parsing. Aggregate identical normalized **raw** keys in BigInt
kopiykas, keeping original raw count separately. Resolve every location through
an explicit retained alias-resolution snapshot; include identity mappings for
SQL's unmapped `coalesce` case. No extra/missing/duplicate mappings. Distinct raw
keys resolving to one canonical key reject, matching the SQL collision gate.

Canonical fact row tuple:

```text
[date, canonicalLocation, brand, ownership, channelGroup, channelName, orderType,
 revenueCentsString, checksIntegerString, markupCentsString]
```

For source candidates channelName equals channelGroup, matching the prepared SQL
and legacy writer. Historical warehouse evidence must preserve both fields from
the actual channel dimension. Do not collapse them. Integer strings have no plus,
leading zeroes or negative zero; checks are nonnegative. Never convert through
IEEE JSON monetary numbers. Source parsing rejects subcent values, fractional
checks, unknown dimensions, incomplete dates and SQL row numeric overflow.

Sort tuples lexicographically by unsigned bytes of their compact JSON UTF-8
encoding (no locale collation). Warehouse SHA-256 covers compact UTF-8 JSON
`["sales-warehouse-cents/v1", sortedRows]`. Mapping SHA-256 covers
`["sales-alias-resolution/v1", sortedPairs]` using the same sort. All canonical
keys must be unique and every accepted historical key must exist in the new
candidate. Compare full key+amount digests, row count, bounds and exact totals,
not just totals/counts. Historical key preservation does not forbid justified
source corrections to amounts; those still need independent full-snapshot
reconciliation and owner review. Mapping/lifecycle changes need their own review.
Lifecycle/LFL semantics and RPC/UI parity are not established by this model.

## Repeatable new atomic binding — executable review contract

Prerequisite: a previously verified atomic chain to an independently authorized
trust root. `trustedContext` is pinned server/reviewer configuration, never HTTP
payload: authenticated prior receipt and all prior canonical rows, actual reserved
run identity/base generation, and two pinned observer public keys with independent
custodian domains. The prior receipt digest is SHA-256 of compact UTF-8 JSON:

```text
["sales-prior-receipt/v1", priorRunId, priorGeneration, priorSourceSha256,
 priorRawRows, priorMinDate, priorMaxDate, priorWarehouseSha256]
```

The pin must have been verified against the complete prior signed commit chain
and retained source, not supplied alongside untrusted evidence. Verifier checks
its digest, counts/bounds and full prior rows. That is an integrity link, not a
new authentication root. The module deliberately does not fetch/establish the
pin or prove that a caller deserves to supply trustedContext.

Snapshot caller inputs and clock before asynchronous work; derive business rows
from the canonical captured bytes so caller mutation cannot separate the hash
from the manifest. Recompute the two captures independently. Both must produce identical derived
source bytes, manifest, warehouse reconciliation and mapping hashes. Binding core:

```text
["sales-provenance-binding/v1", newRunId, priorRunId, priorReceiptSha256,
 baseGeneration, promotedGeneration, sourceSha256, rawRows, minDate, maxDate,
 manifestSha256, warehouseSha256, mappingSha256]
```

UUIDs are canonical lowercase. Generations are canonical decimal strings within
signed bigint bounds; base must equal prior and promoted must equal base+1.
New run differs from prior. Two observations are signed separately as exact bytes:

```text
UTF8(JSON.stringify(["sales-source-observation/v1", observerId, observedAt, core]))
```

Algorithm: Ed25519; signature encoding: 128 lowercase hex digits. Each signature
must verify against its pinned public key, with different observer IDs, different
SPKI public-key hashes and different pinned administrative independence groups.
Groups/keys cannot be claimed inside the evidence. Timestamps must strictly
increase, neither may be future, and both must be within 15 minutes of verification.
Collectors must obtain separate authenticated read-only observations of the fixed
source, source/run bounds, full counts, retained bytes and mapping/warehouse
context; copying another collector's matrix and signing it is not independent.

Canonical evidence JSON has field order `core`, `observations`; each observation
has `observerId`, `observedAt`, `signatureHex` in that order. No extra fields.
Evidence SHA-256 covers these exact UTF-8 JSON bytes. The module verifies real
signatures and recomputed content, not hash shape alone. It cannot establish
whether an authorized signer actually performed an honest read or whether an
externally supplied prior pin is authentic. Trusted collection, key custody and
independence are required external proofs. Ephemeral synthetic test keys prove
cryptographic rejection behavior, not production authenticity.

## Proposed transactional persistence and read-after-write (NOT IMPLEMENTED)

No SQL file or migration changed. Existing NOT APPLIED SQL still lacks evidence
persistence; the existing unreferenced transport's metadata check is insufficient
for this proposal. Neither may be presented as the completed contract below.

A future coordinated Edge+SQL revision must be reviewed and tested in disposable
PostgreSQL before any separately approved installation:

1. Begin reserves the actual run UUID and captures locked base generation. It
   cannot promote or infer a root. Bind the complete retained source fingerprint,
   literal manifest digest, alias resolution, prior receipt and reserved run to
   both server-side observations. Captures/re-observation and signature verification
   finish before the stage/commit authorization boundary; there is no signing
   credential in SQL or request-controlled approval flag.
2. Persist a verified binding in private staging for that run, not in a standalone
   success record. A vetted server-side attestor must be the only future allowed
   producer, with explicit grants/writer-quiescence review. A service-role caller
   posting a plausible JSON object is not attestation. DB-side verification or an
   independently reviewed authenticated attestation channel must enforce the
   pinned signer policy, not trust a client `verified=true` parameter. This channel
   and schema are intentionally not implemented/approved here.
3. Commit locks generation, run, mappings/lifecycle, dimensions and facts, retaining
   current historical-key and cancellation/concurrency safeguards. Recheck binding
   run/base generation, expiry, manifest/batches and canonical keys+exact amounts
   under those locks; compare promoted facts to signed warehouse hash and totals.
   Any changed mapping/generation, missing binding or mismatch aborts all effects.
4. In the **same transaction** as facts/dimensions, stale deletion, MV refreshes,
   success and generation increment, persist immutable `details.accepted_source_v1`:
   existing fields `run_id`, `spreadsheet_id`, `range`, `raw_rows`, `min_date`,
   `max_date`, `observed_at` (second observation), `sha256` (canonical source hash),
   plus `binding_v1` (complete signed evidence) and `binding_sha256`. Record base/
   promoted generations and private artifact references in a versioned receipt.
   Check duplicated fields against the signed core; never construct them from
   warehouse minima or current source after the fact. Committed receipt and private
   run reference the same binding hash. No metadata backfill, separate post-commit
   write, partial success, automatic new-run retry or legacy fallback.
5. After commit, independently read the success record, retained binding, generation
   before+after, and **all** joined warehouse identities/amounts under a consistent
   snapshot or equivalent no-change proof. Enforce exact pagination/counts, zero
   rejects, all facts owned by the run, bounds, totals and key+amount digest. Verify
   signatures/retained source again. `verifyPreparedSalesReadback` models the signed
   binding JSON, run/status/raw count/rejects, complete canonical facts and unchanged
   promoted generation; its `acceptedSourceJson` is the canonical JSON of
   `details.accepted_source_v1.binding_v1`, not the entire details wrapper. Only
   objects verified by this module in memory can enter that helper. It performs
   no actual read/write, does not check transport pagination or fact ownership,
   and is not a SQL transactional/concurrency test.

A lost acknowledgement or failed readback means UNKNOWN outcome, not rollback.
Stop and use separately authorized read-only investigation; never import again,
repair metadata, reset generation or reopen legacy writers automatically.

## Retention, ownership and authorization

Proposed evidence custodian: owner-designated Sales/data steward, with a separate
review custodian. The owner must name both people/domains and approve retention
before capture or credential provisioning. Proposed minimum is 365 days after
acceptance, extended through any audit/dispute, subject to owner-approved privacy
policy. Do not silently delete evidence needed to validate an accepted chain;
expiry requires a reviewed chain-preserving policy or closes later verification.

Privately retain encrypted original response body, exact canonical source bytes,
request parameters/response range, authenticated observation timestamps, canonical
rows/mapping resolution, literal manifest digest, run/generation/prior receipts,
and both signatures with signer policy version. Use an existing approved private
store with restricted read-only reviewer access and integrity/version retention;
no new paid provider, durable store or scheduler is activated by this proposal.
Never retain OAuth tokens, Authorization headers or key material with evidence.
Repository/PR gets only redacted receipt references, policy/status and synthetic
fixtures. Public hashes do not grant source access; confidential raw rows, private
exports and credentials never enter logs, Git, browser responses or screenshots.
Read-only source/Supabase access, evidence storage authorization, signing/key
provisioning and any business-data writes are distinct owner gates.

## Verification and remaining gates

Synthetic coverage: fixed-byte golden digest; Unicode/order/type/header/range
changes; absent/mismatched/forged/partial/stale evidence; independent keys/domains;
real Ed25519 signature rejection; exact large decimals and raw dedup; alias
collisions; historical channel-name key regression; generation mismatch;
re-observation; and canonical retained evidence/cent-level readback mismatches.
No signing keys or production evidence fixtures are persisted.

Local results are recorded in [the candidate receipt](sales-provenance-verification-2026-11-03.json).
A green trusted runner result must identify its **new candidate SHA**, independently
run required checks and attach evidence only to existing PR #44. Codex does not
commit, push, create a PR or post GitHub comments. No READY FOR GATE or RELEASED
claim is made. Legacy source closure, authenticated trust root, credential access,
backup+restore rehearsal, grants/writer quiescence, transactional evidence SQL,
coordinated Edge+SQL release, first import and authenticated RPC→desktop/mobile
UI QA remain CLOSED. The original broad #43 audit remains INCOMPLETE.
