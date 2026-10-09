# KPI Dictionary

## Revenue
Formula: SUM(revenue)

Source equivalent: `Сума зі знижкою, грн.`

## Checks
Formula: SUM(checks)

Source equivalent: `Чеків`

## Average Check
Formula: Revenue / Checks

Null when Checks = 0.

## Markup UAH
Formula: SUM(markup)

Source equivalent: `Націнка, грн.`

## Markup %
Formula: Markup UAH / Revenue × 100

This is not gross margin unless finance explicitly confirms the accounting definition.

## Channel Share %
Formula: Channel Revenue / Revenue under the same active filter context × 100.

## Growth UAH
Formula: Current Revenue - Comparison Revenue.

## Growth %
Formula: (Current Revenue / Comparison Revenue - 1) × 100.

Return null when comparison denominator = 0.

## WoW
Compare completed/current selected week with previous matching week.
For incomplete current week use same weekday cutoff in the previous week.

## MoM
Compare selected/current month with previous month.
For incomplete current month use same day-of-month cutoff in the previous month unless user explicitly selects full-month comparison.

## YoY
Compare with the matching calendar period one year earlier.
For incomplete periods use matching date cutoff.

## YTD
From Jan 1 through selected/current cutoff date.

## LY YTD
Same calendar cutoff one year earlier.

## LFL Revenue
Revenue filtered to locations that are comparable in both periods according to `dim_location.lfl_from/lfl_to`.

## Contribution to Growth
For dimension member i:
(Current Revenue_i - Comparison Revenue_i) / Total Revenue Growth.

Used to explain which locations/channels caused change.

## Revenue decomposition
Revenue = Checks × Average Check.

Change analysis should distinguish volume effect (checks) and ticket effect (average check).

## Completion status
A period must carry a status:
- complete
- partial
- future

Comparisons of partial periods must use aligned cutoffs.
