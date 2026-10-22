# Digital selected-period summary contract — issue #12 review closure

This revision implements the remaining Ads/GBP empty-period blocker from the
latest `/astra run` comment. It does not certify completion of every item in the
original phase-1 audit or change source dates, freshness or snapshot selection.

## EXECUTABLE

`web/lib/digital-period-sources.ts` contains the pure normalizers used by the
existing Ads and Local RPC loaders. Summary fields are nullable.

- `meta.rows === 0` **or** `meta.observedDates === 0` makes every summary metric
  unknown (`null`). Either empty count wins even if the other count is positive,
  Ads `available` is true, report dates exist, or GBP locations are populated.
- A zero summary value survives only with a positive selected-period row or
  observation count and no explicit empty count. Availability, dates, calendar
  duration, profile counts and `locations.length` do not prove measurement.
- Missing, invalid and non-finite summary values remain null. Ads with
  `available !== true` has unknown summary metrics. Legacy nonzero metrics remain
  usable unless explicit empty-period metadata contradicts them.
- Ads ratios use the normalized inputs. Missing inputs and zero denominators
  produce null; a measured zero numerator with a positive denominator yields 0.
- Ads/overview UI renders unknown summary values as `—`. Derived GBP action totals
  remain unknown if any component is unknown. GBP report/status availability is
  based on known summary measurements, not the presence of profiles.
- The aggregate collector applies the same selected-period rule to Ads spend;
  completeness remains `UNKNOWN`.
- PageSpeed normalization is independent: an existing `captured_on` snapshot
  survives an empty GBP period with its own date and values unchanged.
- Cache keys were advanced so older normalized summary objects are not reused.

Regression coverage: `web/tests/digital-period-sources.test.mjs` exercises both
empty indicators separately, conflicting counts, populated profiles, positive
counts with true zeroes, missing evidence, Ads ratios, derived GBP totals,
collector spend and independent PageSpeed snapshots.

## PREPARED

No new SQL, migration or provider configuration is prepared by this revision.
No SQL was applied or executed.

## NOT IMPLEMENTED / backend limitations

The checked-in legacy Ads/GBP RPC definitions do not return selected-period
`rows` or `observedDates` and use `COALESCE` in summaries. Without backend counts,
a legacy zero cannot be distinguished from an empty aggregate; it is therefore
returned as null. This revision consumes counts when supplied, but cannot create
missing source evidence or certify period completeness. A future backend change
must count actual selected-period observations and retain per-field nulls.

Source-level nulls already collapsed by SQL inside a nonempty period cannot be
reconstructed by the frontend. Positive row counts alone do not establish that
every individual source field was measured. Warehouse completeness, row limits,
exact GA4 period-unique users and snapshot guarantees require their own source
contracts; this blocker fix adds none of those guarantees.

No production deployment, SQL execution, credentials, providers, schedulers,
advertising changes or business-system writes are part of this revision.
