# Issue #34 — Meta Ads Windsor ingestion candidate

Status: design/code/test for Barbara review. Nothing applied or scheduled. The
[SQL candidate](sql/issue-34-meta-windsor-NOT-APPLIED.sql) is outside
`supabase/migrations`, opens a transaction and ends with `ROLLBACK`. It requires
the existing Meta table and password configuration, but does **not** depend on
applying issue #26's combined Meta/Social candidate. It supersedes that candidate's
Meta RPC only; its Social changes remain independent. Do not later overwrite the
v3 Meta RPC with issue #26's v2 definition.

## Source and mapping

Use only the `facebook` fields already validated in issue #34 through Windsor
`get_fields`. No additional connector fields are introduced; `imported_at` is
server metadata. No Windsor tool is available in this runner, so no new live
field validation or source sampling is claimed. `actions_link_click` is the
validated link-action field; `link_clicks` is not substituted or requested.

| Windsor field / raw column | Curated `staging_meta_ads_daily` column |
| --- | --- |
| `date`, `account_id`, `account_name` | same |
| `account_currency` | new nullable `account_currency` column (required in raw) |
| `campaign_id` | same |
| `campaign` | `campaign_name` |
| `objective`, `spend`, `impressions`, `reach`, `clicks` | same |
| `actions_link_click` | `link_clicks` |
| `actions_offsite_conversion_fb_pixel_purchase` | `purchases` |
| `action_values_offsite_conversion_fb_pixel_purchase` | `purchase_value` |

`conversions` stays NULL: purchases are not a generic conversion definition.
Purchase count/value remain NULL when absent; measured zero survives. No defaults
replace missing performance metrics. Counts use numeric storage to avoid inventing
rounding rules. Campaign-day exports populate empty `adset_id`/`ad_id` identity
sentinels, not fabricated ad/adset IDs. Reach is retained at campaign-day grain;
period reach/frequency stays unavailable. CTR/CPC/CPM are computed from known
operands, with positive denominators, in the existing application normalizer.

Raw target is **only** `public.staging_meta_ads_windsor`; primary/upsert key is
`(date, account_id, campaign_id)`. Account IDs and campaign IDs are nonblank text,
not numbers. Currency is a required uppercase three-letter source code. Export
one account/date/campaign row, without placement, device, action-type, adset or ad
breakdowns. Duplicate keys or missing currency must fail, not be aggregated away.

## Controlled refresh and evidence

`meta_windsor_evidence(account, from, to)` is a service-only inspection function.
It reports rows, observed dates, currency set, NULL/known purchase counts,
measurement freshness and server receipt bounds, plus a deterministic fingerprint
of all raw fields. Date freshness uses two UTC calendar days; receipt time never
replaces measurement dates or proves export completion. Coverage stays UNKNOWN;
the UI can flag observed calendar gaps as PARTIAL. Missing dates can be legitimate
inactive dates and do not independently prove a failed export.

`refresh_digital_meta_models(account, from, to, expected_rows, expected_fingerprint)`
has no default arguments or automatic execution. After independently reconciling
a **completed** Windsor export, a future authorized operator supplies the reviewed
scope and evidence. Empty imports, future/reversed windows, changed fingerprints,
wrong row counts, inconsistent/changed account currencies, or overlap with another
source/grain are rejected. Do not read evidence and blindly echo it as approval:
these parameters detect snapshot changes, not completeness or authorization.

The function locks raw staging against writes and serializes curated refreshes,
then atomically replaces only Windsor-owned rows in the explicit account/date
window. Other accounts, dates and sources remain isolated. Repeating a refresh
is idempotent; source corrections replace rather than accumulate values. A trigger
sets receipt time on insert **and update** even if Windsor omits metadata.
Curated `imported_at` retains this receipt; `modeled_at` records processing time.
Running the model again cannot make source evidence look newly imported.

Raw and curated tables have RLS and no direct PUBLIC/anon/authenticated privileges.
Evidence/refresh are service-only with fixed search paths. The existing read RPC
retains its password hash gate and grants, returns contract v3 evidence for
Windsor campaign-day rows only, and limits campaigns to 50. Legacy/foreign rows
cannot establish Windsor readiness. Money totals require exactly one known
currency; campaigns retain account and currency identity. Any unknown component
makes an aggregate metric unknown, rather than summing only its known subset.
Google data and refresh functions are untouched. Purchase ROAS stays unknown while
`attributionVerified=false`, even if values appear in a later export. Attribution
verification is a separate review, not inferred from field availability.

## Destination and schedule plan — disabled

Do **not** create a destination task or ask for activation in this issue. After
Barbara review and a separate exact owner approval for database application and
recurring ingestion:

1. Verify the SQL in a disposable Supabase-compatible database, including actual
   service-role permissions, RLS, concurrent exports/refreshes and query plans.
   Prepare a separately approved application migration; preserve rollback by
   default in this artifact. Record backups and the old Meta RPC definition.
2. In Windsor's destination UI, select the existing Supabase credential without
   exposing/changing it, connector `facebook`, exact fields above, campaign-day
   grain, raw target and composite matching key. Verify the UI's replacement mode
   in a test destination. It must preserve the table, constraints, trigger and RLS;
   DROP/CREATE/TRUNCATE behavior is incompatible. No direct curated-table export.
3. Run a separately authorized initial bounded export, then reconcile raw and
   source by account, currency, dates and keys. Check sums and NULL counts, not just
   row counts. The issue's 2026-10-01..23 reference is 110 rows, 19 observed dates
   (October 5..23), USD 896.92 spend, 1,249,264 impressions, 8,623 clicks, 5,869
   link clicks, all purchase count/value NULL. These are historical comparison
   evidence, not hardcoded import success criteria or production test fixtures.
   Attribution restatements may legitimately change them.
4. Inspect evidence, record the completed-export reconciliation and call the
   bounded refresh with its reviewed row count and fingerprint. Compare source,
   raw, curated and RPC evidence; verify empty/missing purchases remain dashes.
5. Proposed cadence: hourly Windsor export at `:00`; model attempt nominally at
   `:30`, **only after confirmed successful completion and reconciliation** of
   that export. Use the same account scope and rolling attribution/backfill window
   (initial proposal 30 inclusive days; confirm Meta attribution settings first).
   A fixed time offset alone is insufficient. A future reviewed completion/manifest
   adapter must supply the exact scope, expected count and snapshot fingerprint.
   No no-argument cron refresh, job registration, manifest writer or scheduler is
   enabled here. If export completion cannot be verified, skip refresh and alert;
   retain last model and report its actual source freshness.

Upsert replaces matching keys but does not remove disappeared campaigns. Before
recurrence, prove Windsor's scoped replacement semantics or separately approve
scoped raw cleanup/reconciliation for withdrawn keys. No DELETE/TRUNCATE grant is
added for the exporter. Never treat accumulated raw keys as proof of a complete
replacement. An all-empty replacement is deliberately blocked and needs separate
review; it must not silently erase a previously valid model. Full raw batch
provenance/completion automation remains a prerequisite for unattended operation.

Rollback after any future authorized activation starts by disabling that destination
and refresh job. Restore the prior reviewed RPC definition and retain raw data for
investigation; do not blindly drop tables or currency/provenance columns. Source
campaigns/ad state, credentials and Google schedules are outside this change.

## Verification and limits

Focused fixtures cover USD/NULL purchase evidence, measured zero, partial metric
missingness, mixed currencies, attribution gating and rendered currency labels.
The disposable PostgreSQL fixture initializes its own temporary cluster, never
reads a database URL, uses synthetic records, and rolls back the candidate. It
checks compilation, bounded/idempotent corrections, source timestamps, privileges,
RLS flags, evidence mismatches, account/grain isolation and currency rejection.
When PostgreSQL binaries are absent the database fixture explicitly skips; static
assertions do not prove database behavior. Local tests cannot prove hosted Supabase
configuration, Windsor UI behavior, batch completeness, concurrent sessions or
production performance. Those remain review/application gates.

Required repository checks: `npm ci --prefix web`, `npm run check`, `git diff --check`.
No migration, provider task, production query, ad write, credential change, commit,
push, PR creation or deployment is part of this handoff; the trusted workflow owns
PR creation for Barbara.

Local handoff results:

- `npm ci --prefix web`: PASS.
- Focused contract/UI and disposable PostgreSQL 16 tests: PASS (database test ran,
  not skipped). PostgreSQL uses socket-free single-user mode; multi-session
  concurrency and hosted Supabase behavior remain unverified.
- `npm run check`: PASS in `/tmp/issue34-verify-u0bby4hz` using a writable copy of
  the implementation and the installed dependency tree. All ten test files,
  TypeScript and optimized Next.js build passed. The original checkout attempt
  stopped on the existing tests' `.agents/runtime` writes because `.agents` is
  sandbox-mounted read-only; no test or safety gate was removed.
- `git diff --check`: PASS.
