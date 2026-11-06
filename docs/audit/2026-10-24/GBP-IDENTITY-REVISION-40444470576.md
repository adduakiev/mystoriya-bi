# D26 GBP profile identity — issue #43 / existing PR #44

Bounded preview-only change following the trusted trigger for
[review comment 6433027975](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6433027975).
Trusted [Actions run 40444470576](https://github.com/adduakiev/mystoriya-bi/actions/runs/40444470576).
The broader audit remains INCOMPLETE; all 66 authenticated browser cases remain
NOT_EXECUTED. Synthetic SSR is not authenticated browser or production evidence.

## Provenance and acknowledgement

WORKING with the trusted Actions URL was acknowledged in the Codex transcript.
This is not proof of a GitHub comment. Linked review retrieval via GitHub CLI
failed because GH_TOKEN is unavailable; the linked receipt was not independently
retrieved. Remote acknowledgement/publication remains the trusted runner's
responsibility. No credentials were accessed or changed.

Initial checkout HEAD is `4f0cfcec48408428d51ee916cb87a97a256e4807`, branch
`astra/issue-43-40444470576`. A fast-forward to the explicitly requested existing
PR HEAD `7fd3233ab5d83885de38eef7316097b59d0370d0` failed because `.git` is
read-only (`ORIG_HEAD.lock`). Its complete snapshot was restored with
`git archive ... | tar -x`. Extraction reported read-only `.agents` paths;
all tracked file blobs were subsequently compared with `git hash-object` and
matched the requested commit before edits. Git HEAD/refs remain unchanged.
The restored PR overlay, including untracked PR-added files, must be preserved
by the runner. No commit/push/PR creation was performed by Codex.

The trusted trigger reports independent SELECT-only, installed-SQL, code and
preview evidence: four distinct GBP IDs have effectively identical М’ясторія
titles, with no verified ID-to-address crosswalk. That production observation
is relayed evidence, not a new SELECT or installed-RPC verification here.
No SQL/migration changes or execution were needed.

## Reproduction and bounded fix

Before the fix, `/digital/local` rendered the raw title as each profile's main
label and an unqualified last-six-character ID underneath. The top-intent card
showed only the ID suffix. Equivalent names using mixed apostrophes, whitespace
and case could not clearly distinguish four profiles; suffix collisions were
not handled and complete IDs were unavailable to assistive technology.

`web/lib/gbp-location-labels.ts` compares titles after Unicode normalization,
apostrophe normalization, whitespace normalization and Ukrainian lowercasing.
It preserves genuine unique names. Duplicated or absent names receive a
human-readable name/profile label with an explicit ID suffix. Colliding
suffixes expand to complete raw IDs, including their account/path prefixes.
If a genuine unique name resembles a generated label, the generated label
expands; any remaining collision is explicitly marked ambiguous.

Missing IDs receive an explicit missing/unverified identity notice; repeated IDs
remain repeated and explicitly ambiguous. No row numbers, invented addresses,
synthetic identity keys or claims of uniqueness fill these gaps. Labels are
deterministic under input/ranking reordering; suffix expansion can change when
the input set introduces a collision. Raw IDs remain the React keys. No profile
merging, aggregation, metric normalization or sorting behavior changed.

Both the location table and top-intent card use the helper's same label. The
table exposes complete IDs as text; the card includes the complete identity
note in its accessible label. All summary/profile KPIs, nulls, measured zeroes,
rates, ranking, source windows and existing freshness/completeness notices are
preserved. There is no currency calculation or upstream source change.

## Verification

- `npm ci --prefix web`: PASS, 71 packages installed.
- `node --experimental-strip-types web/tests/gbp-location-labels.test.mjs`:
  PASS, 20 deterministic helper/actual-page synthetic SSR tests. Cases cover
  four duplicated profiles, unique names, mixed apostrophes/case/whitespace,
  suffix/account-path collisions, missing titles/IDs, repeated IDs, collisions
  with genuine unique titles, empty lists, accessible full IDs, raw keys,
  unchanged ranking/metrics/null/zero and unchanged input objects. Fetch is
  forbidden in the synthetic SSR cases.
- Full workspace check: 25 test files PASS; three runtime-writing test files
  FAIL because the sandbox cannot create `.agents/runtime`. TypeScript/build
  are not reached by that command. No safety gate was weakened.
- Full `npm run check` in `/tmp/issue43-d26-check-buaikcxv`: PASS, all 28 test
  files, standalone TypeScript `--noEmit` and optimized Next.js production build.
  All 273 requested-commit files plus the three new helper/test/report files
  were byte-verified before testing; dependencies reused from `npm ci`.
  Runtime/build artifacts stayed in the disposable copy. Final evidence/report
  text was completed afterward; executable source remained byte-identical.
- Original-code regression: rendered the exact original PR page from `git show`
  in a disposable file with the same synthetic four-profile RPC fixture.
  All nine targeted table-label/full-ID/top-card assertions FAIL against the
  original; all nine PASS against the revised actual page. No network or
  warehouse invoked. The first attempt to extract the original via Node child
  process reported sandbox EPERM; shell extraction succeeded for this comparison.
- Generated inventory, KPI contract and 66-case QA-plan reproducibility checks:
  PASS. Inventory/matrix refreshed for the new helper dependency and line shifts.
- `git diff --check`: PASS; final checks include the PR-added/new files that are
  untracked against the initial main checkout.
- See [machine-readable receipt](gbp-identity-verification-40444470576.json).

## Residual risk and handoff

The verified ID-to-address/store crosswalk is still UNKNOWN. An ID label does
not establish store lifecycle, address, ownership, coverage or completeness.
Missing/repeated IDs cannot be reliably distinguished until upstream identity
is repaired. Existing raw-ID keys are intentionally preserved; duplicate or
missing upstream IDs therefore retain their existing React key limitation.

Owner action NONE for this code-only change. No migrations, credentials,
providers, schedulers, external/business writes, SYRVE or advertising changes.
No production merge/deploy. The runner must publish only to existing PR #44,
post WORKING remotely if needed, then the actual new SHA/checks/evidence and
READY FOR REVIEW after its required checks pass. Candidate SHA is PENDING
TRUSTED RUNNER COMMIT/PUSH; no SHA is invented. If runner publication is denied,
report the actual branch/SHA for safe same-PR force-with-lease recovery.
