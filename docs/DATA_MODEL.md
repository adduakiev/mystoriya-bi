# Data Model

## Current source audit
Google Sheet: BI - Мясторія - жовтень не повний
Primary tab: `Данние короткі`
Approximate shape: 46k rows × 14 columns.

Observed source fields include:
- Номер Тижня
- Рік
- Месяц
- Рік (duplicate header)
- Місяць
- Обліковий день
- Зі складу
- Бренд
- Власність
- Доставка
- Тип замовлення
- Сума зі знижкою, грн.
- Чеків
- Націнка, грн.

Important: the source contains duplicate `Рік` headers and rows where those two year values differ. Calendar attributes must therefore be derived from `Обліковий день`.

## Canonical star schema

### fact_sales_daily
Grain: one row per date × location × brand × ownership × channel × order_type.

Columns:
- id
- date_id
- location_id
- brand_id
- ownership_id
- channel_id
- order_type_id
- revenue
- checks
- markup
- source_row_hash
- imported_at

### dim_date
- date_id
- date
- year
- quarter
- month
- month_name
- iso_week
- week_start
- month_start
- day_of_week
- is_weekend
- ytd_index

### dim_location
- location_id
- canonical_name
- source_name
- city
- brand_id
- ownership_id
- open_date
- close_date
- lfl_from
- lfl_to
- is_active

### dim_channel
- channel_id
- channel_group
- channel_name
- is_owned
- is_aggregator

Examples:
- Venue / Venue
- Delivery / Courier
- Delivery / Pickup
- Aggregator / Glovo
- Aggregator / Bolt Food

### dim_brand
- brand_id
- brand_name

### dim_ownership
- ownership_id
- ownership_name

### dim_order_type
- order_type_id
- order_type_name
- normalized_group

## LFL logic
A location is comparable for a target period only when both compared periods fall inside its valid comparable range.

Minimum rule:
- period_current inside [lfl_from, lfl_to]
- matching comparison period inside [lfl_from, lfl_to]

This prevents newly opened or closed locations from distorting like-for-like results.

## Import pipeline
1. Read source Sheet.
2. Validate required columns.
3. Parse `Обліковий день`.
4. Recalculate calendar fields.
5. Normalize locations/channels/order types through mapping tables.
6. Validate numeric fields.
7. Deduplicate by canonical grain.
8. Write staging table.
9. Run data-quality checks.
10. Upsert canonical facts.
11. Refresh daily/weekly/monthly aggregates.
12. Record import log.

## Future fact tables
### fact_orders
Order-level data with source channel, timestamps, customer and delivery properties.

### fact_order_items
Dish/category-level data.

### fact_customers
Customer lifecycle / RFM / cohorts.

### fact_delivery
Courier, distance, promised time, actual time, SLA and cost.

## Mapping rule
Never hard-code source renames in UI components. All mappings belong in DB reference tables such as `map_location_source` and `map_order_type_source`.
