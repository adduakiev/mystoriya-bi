# Issue #43 / existing PR #44 — trusted runner handoff

Run: https://github.com/adduakiev/mystoriya-bi/actions/runs/40129297280
PR: https://github.com/adduakiev/mystoriya-bi/pull/44
Intended PR branch: `astra/issue-43-40107435112`.
This run checkout: `astra/issue-43-40129297280`.
Preserved base: `58d98421e28653675803383f34d138e16cbaa86f`.
Evidence/follow-up reference: `17dec08bfce48c2dc4853ae0da422276c70af460`.

Codex prepares working-tree changes only. It does not commit, push or create a PR.
The trusted runner must record the actual full revision SHA after its deterministic
checks and push. If using the temporary branch, report that SHA for Barbara to
recover **existing PR #44**. Do not create a duplicate PR. PR creation permission
errors are not an owner blocker. The revision SHA is pending runner handoff; the
base SHA above must never be reported as this revision's verified commit.

The WORKING CLI attempt from this sandbox failed (exit 4, GH_TOKEN unavailable).
The workflow has an independent Mark task WORKING step; its remote outcome cannot
be verified here. Historical trusted pushes/PR recovery are separately recorded
in revision-provenance.json. No credentials or GitHub settings changed.

After trusted verification and push, publish READY FOR REVIEW on issue #43 with:

- Existing PR #44 URL, full actual pushed SHA, branch and Actions run URL.
- `verification.json` results, including the workspace runtime restriction and
  successful same-source writable-copy check when complete.
- Preserved Merchant nullable metrics/tests and NOT-APPLIED App identity/currency/
  attribution proposal; bounded Barbara GA4/GSC/Meta receipts now recorded.
- Current30 GA4 30/30 and GSC 28/28 through 10-21, key metric null rows 0;
  Meta raw/curated each 138/25 and stored spend 1311.75, currency UNKNOWN.
  Distinguish Gate D rolling 145/26 scope; never claim upstream/RPC/UI parity.
- Protected preview 403; desktop/mobile/runtime QA NOT VERIFIED. Prior30 and
  12-month actual coverage UNKNOWN. Full query/time/key receipts still needed.
- D04–D11 OPEN with proposed owners, gates and acceptance in follow-up-plan.json.
  All SQL designs NOT APPLIED; no source, migration or business-system writes.

READY FOR REVIEW means preview revision review, not full production audit
acceptance or release approval. Owner action now NONE. No merge, deployment,
migrations, credentials, providers, scheduler, durable writes, SYRVE or Ads changes.
Do not duplicate Meta Gate D or Windsor destinations.
