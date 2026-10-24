# Read-only reviewer evidence — recorded 2026-10-24

Source: [independent review of PR #44](https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6388338141).
This redacted record is derived from the trusted revision trigger. The full
comment could not be fetched in this sandbox: `gh api` exits 4 without GH_TOKEN;
public `curl` exits 6 because api.github.com does not resolve. No credentials were
added or changed. Exact query receipts, preview hostname and detailed numeric
results are unavailable here; they must not be reconstructed from the baseline.

| Evidence boundary | Recorded result | Limit |
|---|---|---|
| Supabase stored coverage, field null and key checks | Verified by reviewer, as reported in trigger | Exact relations/windows/counts and null/key outcomes UNKNOWN until redacted receipts are attached |
| Issue #43 Supabase counts/date spans | Baseline supplied in issue | Remain baseline evidence, not newly executed reviewer SQL |
| Upstream export → warehouse parity | UNKNOWN | Equal raw/curated counts cannot prove source completeness or metric parity |
| Stored → RPC → rendered UI | UNKNOWN | No matching authorized RPC/UI receipts supplied |
| Vercel for exact PR HEAD `a261c82b6f6d7cd1ae2a316a108cadd121972b61` | READY, reported in trusted trigger | Does not apply automatically to the next runner commit |
| Protected preview navigation | HTTP 403, reported in trusted trigger | Browser QA NOT VERIFIED; no screenshots or page-value checks claimed |
| Trusted workflow provenance | WORKING posted, `a261c82` pushed, existing PR #44 recovered | Earlier sandbox GH_TOKEN/index.lock errors were local failures, not final runner outcome |

Machine-readable counterpart: [reviewer-evidence.json](reviewer-evidence.json).
Only aggregate scope/status is retained; no customer data, business keys or secrets.

Reproduction uses the bounded SELECT-only [warehouse diagnostics](read-only-qa.sql)
and [date-filtered RPC diagnostics](rpc-read-only-qa.sql) on an already authorized
read-only session. Fixed UTC windows are 2026-09-24…2026-10-23, 2026-08-25…2026-09-23
and 2025-10-24…2026-10-23. Record execution time, relation, source-account scope,
timezone, row/date coverage, per-field unknown counts, duplicate/unknown key
counts, and matched totals separately. Deployed schema compatibility must be
checked before execution. No migration or refresh is part of these diagnostics.

[sql-validation.json](sql-validation.json) describes earlier synthetic disposable
PostgreSQL evidence. It is not live Supabase evidence and cannot fill coverage.csv
UNKNOWN cells. Current exact reviewer aggregate results also remain UNKNOWN.

Browser continuation (manual steps, no browser automation claimed):

```bash
node scripts/bi-audit-browser-qa.mjs --matrix
BI_AUDIT_BASE_URL=https://exact-authorized-preview.example node scripts/bi-audit-browser-qa.mjs --matrix
```

The second origin is a placeholder, not an observed deployment. Replace it with
the exact authorized preview. The command emits one JSON line per route/viewport
with desktop/mobile dimensions, period URLs where supported, selector checks,
and screenshot/result slots. Open these URLs in an already authorized browser;
record results separately. A 403 stops the exercise with BLOCKED. Do not change
protection, credentials, roles or click mutation controls. Missing/error fixtures
belong only in an isolated preview. No runtime 404/500, performance, mobile,
filter consistency or role-boundary claim follows from matrix generation.
