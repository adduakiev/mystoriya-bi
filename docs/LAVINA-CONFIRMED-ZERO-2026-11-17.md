# Confirmed zero sales: Lavina, 4 and 30 September 2026

Kostiantyn explicitly confirmed on 17 November 2026 that Lavina mall was closed on these two dates and approved treating them as zero-sales days. No other missing dates are confirmed.

The Dynamics comparison RPC keeps this bounded, versioned calendar evidence separate from warehouse rows: two exact dates, location Лавина, brand МитБАР, ownership Власні. It adds zero-valued daily coverage only when the actual selected slice exists on both sides within seven days, the date is not beyond the source cutoff, and no actual row for that location/day exists. Actual rows (including invalid metrics) always take precedence. LFL registry exclusions remain in effect. No source, fact-table, materialized-view or scheduling writes are needed.

Revenue/check/markup sums are unchanged; average check and markup rate continue to use summed numerators/denominators. Confirmed days restore coverage, not extra sales. The comparison detail discloses confirmed zero point-days separately. All other gaps remain unknown. This small dated allowlist is deliberate: it does not introduce a general closure-calendar editing surface or implicit zero policy.

Expected affected comparisons: September/August and October/September; W36/W35, W37/W36, W40/W39, W41/W40. November, other locations, source cutoff and historical year boundaries must remain unchanged. In LFL, previously omitted Lavina joins the complete pair, so comparison amounts may change to the now-complete cohort even though report totals do not.

Validation: native PostgreSQL fixtures cover all four metrics, LFL, filtered slice, both weekly sides, unrelated missing dates/locations, real-row precedence, NULL conflicts, missing channel/ownership, no cutoff extension and TypeScript serialization. RPC draft remains fixture-guarded. Production installation/merge require the exact repository owner gate; the closure business confirmation is recorded but not claimed as a migration already performed.
