# М'ЯСТОРІЯ BI v2 — Product Specification

## Product vision
М'ЯСТОРІЯ BI v2 is a browser-based operational control center for digital sales, delivery, pickup and aggregators. It is not a static reporting dashboard. It must answer: what changed, where, through which channel, why, and what needs attention.

## Primary users
- CDO / Head of Online Sales
- Finance / management
- Operations
- Marketing
- Delivery and contact-center managers

## Core business scope
Internal market = Venue sales + Own Delivery + Pickup + Aggregators.

Phase 1 uses aggregated daily sales data.
Phase 2 adds orders, order items, customers, categories, dishes, delivery time, courier performance and SLA.

## Core dimensions
- Date
- Brand
- Ownership
- Location
- Channel
- Order type
- Aggregator

## Core KPIs
- Revenue
- Checks / Orders
- Average check
- Markup UAH
- Markup %
- Channel share
- Growth UAH
- Growth %
- WoW
- MoM
- YoY
- YTD vs LY YTD
- LFL

## Main product areas
1. Overview
2. Delivery
3. Aggregators
4. Locations
5. Dynamics
6. Market Structure
7. Data Explorer
8. Insights / Anomalies
9. Data Quality

## Interaction principles
- Every KPI card is clickable.
- Every chart supports drill-down.
- Global filters persist across pages.
- Users can switch time grain: Day / Week / Month / Quarter / YTD.
- Users can switch comparison: Previous period / LY / LFL / Custom.
- Clicking a channel, location or period updates the rest of the page.
- Raw rows are never the primary UX.

## Data principles
- Accounting date is the source of truth for calendar attributes.
- Year/month/week are calculated from date, not trusted from source helper columns.
- Business mappings live in reference tables, not hard-coded UI code.
- Every import is auditable.
- Unknown values go to a quarantine/data-quality workflow.

## AI/agent roles
### Data Quality Agent
Detects unknown locations, channels, types, duplicates, missing dates and schema drift.

### Anomaly Agent
Detects statistically and operationally significant changes versus relevant baselines.

### Executive Analyst
Explains changes by decomposing Revenue = Checks × Average Check and by contribution of locations/channels.

### Weekly Brief Agent
Produces a concise management summary after a completed week.

## Non-goals for v1
- Full ERP replacement
- Order editing
- Accounting postings
- Courier dispatching

## Definition of v1 done
A user can open the browser and, without editing code:
- see current business performance;
- filter by period/brand/ownership/location/channel/order type;
- compare with previous period and previous year;
- inspect LFL separately;
- drill from total business to channel and location;
- identify top positive and negative contributors;
- trust that metrics are calculated from one canonical model.
