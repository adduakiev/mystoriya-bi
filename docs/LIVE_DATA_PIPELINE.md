# Live Data Pipeline — Phase 1

## Current implementation
The Next.js server reads the Google Sheet through the public gviz CSV endpoint and revalidates every 10 minutes.

This is deliberately an intermediate production path:
- live source data;
- canonical field positions;
- duplicate-header safe;
- calendar derived from accounting date;
- aligned YTD previous-year comparison;
- no database dependency yet.

## Why this stage exists
It validates business logic and the UI against real data before we introduce database synchronization complexity.

## Source mapping
Column positions in `Данние короткі`:
- F: accounting date
- G: location
- H: brand
- I: ownership
- J: channel group
- K: order type
- L: revenue after discount
- M: checks
- N: markup UAH

The duplicated source `Рік` columns are ignored for calculations.

## Current comparisons
Overview defaults to:
- Current YTD: Jan 1 → latest date present in source
- Previous YTD: Jan 1 previous year → same month/day cutoff

This prevents an incomplete current period from being compared with a complete prior period.

## Next migration
Once business calculations are validated:
1. Google Sheet sync writes to staging.
2. Validation/quarantine runs.
3. Canonical rows are upserted into Postgres.
4. Materialized aggregates serve UI.
5. Current loader remains available as emergency fallback.
