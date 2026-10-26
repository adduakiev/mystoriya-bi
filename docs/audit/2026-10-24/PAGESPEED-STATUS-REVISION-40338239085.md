# PageSpeed unknown-status correction — issue #43 / existing PR #44

Scope: the P2 status-label defect authorized by
[review comment 6418265731](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6418265731).
Trusted run: [40338239085](https://github.com/adduakiev/mystoriya-bi/actions/runs/40338239085).

Before implementation, the source tree of existing PR HEAD
`d99649229160466700dc9844a0cd94adc8283e88` was materialized with `git archive`
without changing Git metadata. All 266 tracked file blobs and executable modes
were verified; there were no PR-removed paths. Identical read-only `.agents`
files were preserved after the initial extraction encountered the sandbox's
read-only filesystem. Git HEAD remains the runner's original main checkout;
the trusted workflow owns candidate commit, branch push and publication to the
same PR. No candidate commit SHA is claimed here.

## Reproduced discrepancy and correction

At `/digital`, the PageSpeed Mobile card previously rendered
`Потребує покращення` for both a null snapshot and a score whose CWV category
was `UNKNOWN` because a required field was null. Expected: `Невідомо`.

The shared `coreWebVitalsLabel` helper maps `GOOD` → `Добре`,
`NEEDS_IMPROVEMENT` → `Потребує покращення`, `POOR` → `Погано`, and
unknown/missing categories → `Невідомо`. Overview and `/digital/site` reuse it.
Site keeps its existing behavior of omitting snapshot cards when no snapshot
exists. The HIGH-alert predicate still accepts only the two measured categories
that require attention. Scores, CWV classification, source windows and null/zero
normalization are unchanged.

## Deterministic evidence

`node --experimental-strip-types web/tests/pagespeed-status.test.mjs` passes
12 tests using synthetic snapshots and the actual page SSR. Cases include null
and missing snapshots, each required CWV field independently null with score 85,
all three valid categories, measured zeroes, null score with valid CWV, and zero
score with unknown CWV. They assert card labels, score preservation, alert
presence/absence and no mutation of normalized data. Network fetch is denied.

In a separate disposable copy, replacing only Overview with its original PR
HEAD version makes six regression cases fail (null/missing snapshot, each null
CWV field, and zero score with unknown CWV). The revised implementation passes
all twelve. This is synthetic SSR evidence, not authenticated preview/browser
or upstream-data reconciliation evidence.

`npm ci --prefix web`: PASS (71 packages). Final direct workspace
`npm run check`: 22 test files PASS, three fail because `.agents/runtime` is
read-only (`.agents/run.test.mjs`, `operating-tasks.test.mjs`,
`operating-v2.test.mjs`); TypeScript/build are not reached in that run.
Full `npm run check` in the source-identical copy
`/tmp/issue43-40338239085-check-htghdemz`: PASS, all 25 test files, TypeScript
and optimized Next.js build. The copy includes all PR source paths (including
`.agents`, `.github` and `supabase`) and uses the installed `web/node_modules`;
only disposable runtime/build artifacts are written there. An earlier attempt
failed the two stale generated-evidence checks before regeneration; it is not
PASS evidence. Final `git diff --check` and new-file whitespace checks: PASS.

The generated inventory, visual-block matrix and RPC lineage hash were refreshed
with the existing static generators because their reproducibility checks include
the changed page source. No SQL, source register, currency, scheduler or business
write contract was changed.

Authenticated 66-case browser QA remains unexecuted and session-gated. No merge,
deployment, migration execution, credentials, paid service, external scheduler,
SYRVE mutation, advertising change or durable business write was performed.
