# PR #44 — P1 automatic navigation prefetch revision

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40183474303
Existing PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Trusted finding: https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6396311653

The trusted trigger reports authorized preview QA observed background requests to
unrelated expensive BI pages/RPCs, AbortSignal timeouts and fallback logs following
one navigation. This runner has not independently reproduced that browser trace.
Source inspection confirms the sidebar explicitly enabled Next Link prefetch and
Digital tabs omitted the setting, permitting automatic prefetch.

All DashboardSidebar route links and DigitalTabs links, including Digital overview,
now explicitly set `prefetch={false}`. Clicking a link retains the existing route,
active styling and sidebar LFL query parameter. No RPC, database or authentication
semantics changed in this revision. Navigation may wait for the requested report
instead of using an automatically prefetched response.

`web/tests/navigation-prefetch.test.mjs` renders the actual components and captures
the props passed to Next Link before HTML serialization. Three regression tests
cover all ten sidebar routes with LFL on/off and all twelve Digital tabs, each with
every possible active route. They require boolean false for every link and verify
destinations and active styling; Digital labels are also verified. All three tests
failed before the fix on the intended assertions (true/undefined versus false) and
passed afterward. These are deterministic component tests, not browser/network QA.

The accepted PR source `b526392ef7f37d3025bc6711de4945fdce34c544` was restored
over runner checkout `4f0cfcec48408428d51ee916cb87a97a256e4807` without changing
Git refs or the index. Every file from that source is byte-identical except the two
navigation components and their regenerated inventory/matrix. The new test and this
receipt are additions. App/Merchant/null/currency/status/lineage work is preserved.
Historical verification and browser receipts retain their original provenance.

## Verification in this run

- `npm ci --prefix web`: PASS (71 packages).
- Focused navigation, audit, contract, Merchant and social UI tests: PASS (5 files).
- Navigation tests executed directly: PASS (3 subtests).
- Contract, inventory and read-only query generators with `--check`: PASS.
- Workspace `npm run check`: 13 test files PASS, 3 FAIL because the sandbox denies
  `.agents/runtime` writes. TypeScript/build were not reached by that command.
- Full `npm run check` in source-identical writable copy
  `/tmp/issue43-40183474303-check-h3n028oq`: PASS, exit 0 (16 test files,
  TypeScript and optimized Next.js build). This receipt was added after the source
  copy; executable source/tests and generated inventory are identical.
- `git diff --check` and no-index checks for every untracked file: PASS.

## Handoff and remaining evidence

Current temporary branch: `astra/issue-43-40183474303`.
Intended existing PR branch: `astra/issue-43-40107435112`.
No new commit SHA exists inside this Codex turn: commits/pushes are reserved for the
trusted runner. The checkout SHA and preserved source SHA above are **not** the new
revision SHA. The runner must report its exact full pushed SHA for Barbara's
force-with-lease recovery of existing PR #44. Do not create a duplicate PR.

GitHub CLI access to the linked comment and issue comments failed with exit 4
because GH_TOKEN is absent. No remote WORKING or READY post is claimed here.
The workflow contains a WORKING step before Codex; its publication was not remotely
verified. Publish READY FOR REVIEW with the final SHA and check evidence after the
runner handoff. The existing workflow's generic PR-creation step conflicts with the
explicit no-duplicate instruction; it was left untouched under AGENTS.md.

Barbara must rerun the authorized desktop/mobile preview QA against the final SHA,
checking that one navigation no longer prefetches unrelated sidebar/Digital reports
and reviewing request counts, timeouts and fallback logs. No latency improvement,
live correctness or complete end-to-end audit is claimed by these component tests.
No migration, deployment, credentials, provider/scheduler activation, external or
business writes, SYRVE or advertising changes were performed.
