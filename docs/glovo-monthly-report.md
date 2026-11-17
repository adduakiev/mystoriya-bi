# Glovo monthly report — implementation and acceptance

Scope: only /aggregators/glovo and its source adapter. Main aggregator, Dynamics,
delivery, P&L, sidebar and shared styles are unchanged. No database migration,
credential change, paid provider or business write is introduced.

## Approved structure
Brands are rows, January through the latest available source month are columns.
Amount/orders, ownership/site/brand/storefront-type filters, focus month and
secondary MoM/share display all operate on the same selected rows. Selecting a
brand reveals its site/month matrix, monthly bars and focus-month site ranking.
Totals use a common month axis; missing trailing cells remain unknown.

## Source and mapping
The existing private service account reads the raw facts tab and the approved
location and brand mapping tabs. Reads are bounded by verified sheet IDs/titles
and grid metadata. No raw business exports are committed. The derived BI tab is
not used as an automatically growing live feed because it is a fixed snapshot.
Exact source brand/location plus source-row lineage are required for a mapping.
A changed lineage or missing approval leaves classification unknown.
Duplicate/contradictory/malformed mapping fails closed. Source grid resizing
during reads is rejected; cell edits are not transactionally snapshotted by Google.

Ownership spelling is normalized from Франчазі to Франчайзі. A storefront's type
belongs to brand × site; the same brand can have both types. Display labels are
not stable IDs, and Excel row numbers are not business IDs.
Opening dates remain unknown because the source has no approved opening field.
The calculation layer supports confirmed openingMonth; it never infers opening
from first sales and rejects conflicting/positive pre-opening observations.

## Calculation boundaries
Known sums are explicitly marked partial (~); null is never zero. Confirmed
pre-opening cells have a separate state. Zero baseline has no percentage.
MoM uses the exact previous month, identical eligible storefronts and complete
numeric observations, and is labelled as a comparison of loaded data.
The latest source month and current/future Kyiv calendar months are conservatively
incomplete; neither time since read nor matrix completeness proves source closure.
Closure evidence needs an explicit source contract before this guard can be relaxed.
AOV is ratio of sums only with matching known observations; incomplete denominator
or numerator makes it unavailable. Shares require a known denominator and mapping.
UAH is the requested display convention, marked with an asterisk: source says
local currency; no FX conversion or independent currency proof is implied.

## Verification
- npm ci --prefix web: passed.
- Glovo plus audit tests: 86/86 passed after final integration.
- TypeScript and separate optimized Next.js build: passed.
- Refreshed private source snapshot: all 341 records mapped; aggregate outputs
  reconciled independently outside the repository: 836 aggregate comparisons and 7 real-data SSR scenarios passed.
- npm run check was attempted honestly: audit inventory initially stale (regenerated)
  and seven existing native PostgreSQL suites lack required local PostgreSQL16/17.
  Final full run: 781 tests, 770 pass, 7 fail for missing native PostgreSQL, 4 existing skips.
  Audit inventory was regenerated and now passes.
  These gates were not skipped or weakened. Run the full exact-SHA CI before release.
- Browser interactions are not accepted yet. A synthetic-only bundle was prepared;
  the cloud browser cannot reach the executor-local server (connection refused).
  No production session/data was used to evade the earlier private-data browser gate.

## Release / rollback
Local implementation only. Repository AGENTS.md delegates push/PR creation to the
trusted workflow and requires explicit owner approval for merge/production.
The native CI workflow candidate branch allowlist is extended only to this isolated
Glovo branch. Run full CI and authenticated preview before proposing release.
No SQL rollback is needed; reverting the Glovo code commit restores the old screen.
Keep the service-account source access and authentication boundary unchanged.
