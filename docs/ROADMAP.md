# BI v2 Delivery Roadmap

## Stage 0 — Source audit
- Canonicalize current Google Sheet columns.
- Resolve duplicate year fields.
- Build location/channel mapping.
- Define comparable location dates.
- Establish data quality rules.

## Stage 1 — Product shell
- Next.js control-center UI.
- Global period + comparison filters.
- Overview with KPI cards.
- Revenue/checks/average-check/markup trends.
- Channel mix.
- Location ranking.
- Drill-down state.

## Stage 2 — Data platform
- Supabase/Postgres schema.
- Google Sheets sync.
- Staging + canonical facts.
- Import audit log.
- Materialized daily/weekly/monthly aggregates.

## Stage 3 — Business analytics
- WoW/MoM/YoY/YTD.
- Partial-period alignment.
- Correct LFL engine.
- Growth contribution.
- Channel/location decomposition.
- Saved views.

## Stage 4 — Agents
- Data Quality Agent.
- Anomaly detection.
- Executive explanations.
- Weekly management brief.

## Stage 5 — Detailed operations
- Orders.
- Customers.
- Categories and dishes.
- Delivery SLA.
- Couriers.
- Contact center.
- App vs web acquisition and conversion.

## Engineering rules
- `main` remains stable until BI v2 is ready.
- BI v2 work is developed on `bi-v2`.
- No hard-coded calendar years.
- No business mappings inside visual components.
- Metrics are defined once in the semantic layer.
- Every data import is idempotent.
