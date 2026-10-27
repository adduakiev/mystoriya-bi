# Issue #43 / PR #44 — P1 GA4 monetary presentation, 2026-10-26

Bounded preview-code correction only, D23. Requested source:
`9c89d854d9f8b0906e348fc430ecf6451e85c8b0`.
Actions: https://github.com/adduakiev/mystoriya-bi/actions/runs/40279645896
Acceptance reference: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6409667904

## Evidence and reproduction

The trusted trigger relays an independent production SELECT-only catalog result:
**zero currency/property columns** in GA4 raw, curated, channel, device and landing
tables. This runner did not repeat that query. The source register still has null
property ID and UNKNOWN identity verification; no reporting currency or monetary
grain provenance is established. Raw/curated presence or numeric revenue cannot
prove UAH. The linked comment could not be independently retrieved: GitHub CLI
has no GH_TOKEN, and api.github.com DNS resolution fails. Only the acceptance
requirements quoted by the trusted trigger are claimed here.

Local source at the requested commit independently reproduces hardcoded `₴` for
GA4 revenue/AOV on `/digital`, channel revenue on `/digital/channels`, device
revenue on `/digital/audience` and `/digital/site`, landing revenue on
`/digital/site`, and revenue axis/tooltips in `DigitalHistoryChart`. Overview also
computes monetary period deltas without verified comparable source provenance.
A synthetic positive/zero/null revenue fixture demonstrates the defect without
using business/customer data. No production monetary discrepancy is quantified.

## Preview correction and lineage

`ga4Money` delegates to the existing money guard without currency evidence. It
intentionally offers no evidence argument: arbitrary currency/property labels,
locale, another source or a numeric payload cannot reopen GA4 money. A future
verified contract must establish reporting currency, property/account, monetary
grain and comparable periods before a separately reviewed restoration.

Known numeric amounts, including measured zero, display `— · currency UNKNOWN`;
null/invalid/missing amounts remain `—`. All affected pages explain the block.
Revenue/AOV comparisons are unavailable. The revenue history selector remains
usable in monthly and YTD modes and renders the UNKNOWN notice without mounting
any chart, series, axis or tooltip. Other selectors, count/rate charts and
comparisons remain available with null gaps. The history axis now passes the raw
value to its null-aware formatter instead of coercing null through Number(null).

GA4 adapters, source values and monthly/YTD calculations are unchanged: monetary
numbers remain numeric, zero remains zero and null remains null. Google Ads
UNKNOWN-money/ROAS, Meta USD/null, App/Merchant and existing safeguards remain.
No SQL/migration file was changed or executed. No new source, write, scheduler,
provider, credential, ad change, release or deployment was enabled.

Exact per-block bindings: [dated monetary lineage](ga4-monetary-lineage-2026-10-26.json).
The generated source inventory and tab-block matrix describe the new notice and
conditional chart branches; they are static evidence, not production parity.

## Verification and limits

[Check receipt](ga4-currency-verification-2026-10-26.json) records actual results.
The targeted tests exercise real page/component code with synthetic dependencies,
including positive/negative/zero/null money, unverified payload labels, all four
routes, count/rate preservation, monetary-delta suppression, both history modes,
actual switch handlers, chart props/axis/tooltip formatters and input immutability.
These are deterministic SSR/component tests, not real browser tests.

**66 authenticated browser cases remain NOT_EXECUTED.** No screenshots, remote
RPC/upstream parity, live GA4 currency, 30-day or 12-month coverage is newly proven.
The broader #43 audit remains INCOMPLETE; monetary provenance remains UNKNOWN.
Owner action NONE for this code/test preparation. Production release/data-write
and monetary-contract restoration gates remain separate.

## Runner handoff

Initial checkout HEAD remains `4f0cfcec48408428d51ee916cb87a97a256e4807` on
`astra/issue-43-40279645896`. Switching to the requested commit failed because
`.git/index.lock` cannot be created on the read-only Git mount. With a clean
worktree, all 91 files differing from requested `9c89d85` were restored verbatim
using local Git objects before edits. Baseline additions remain untracked relative
to checkout HEAD; the runner must preserve them when preparing the same PR #44.
Git metadata and protected instructions/workflow were not changed.

WORKING with the trusted Actions link was stated first in the transcript and a
GitHub comment was attempted; no GH_TOKEN means the remote acknowledgement is
still **ASSIGNED/NOT ACKNOWLEDGED**. Runner must post WORKING before READY FOR
REVIEW and supply its actual new full candidate SHA, checks and same-PR URL.
Candidate SHA is PENDING TRUSTED RUNNER COMMIT; no Codex commit/push/PR creation.
Do not present the requested baseline SHA as the new candidate.
