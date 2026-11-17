# Delivery P&L September source verification — 2026-11-17

Local candidate only. No source edits, database writes, production deployment or FIN-BI reconciliation.

Source: [owner-supplied Google Sheet](https://docs.google.com/spreadsheets/d/1EAyGhz9BkWdrBYiNKSu8KGp4KJd45ZIyaF1wBLSxwxI/edit#gid=1602293506), exact tab `Доставка 2026`, gid `1602293506`. Metadata read first. Bounded cell reads: A1:BH4, A85:D96, AS85:AX96, B4:B91, R4:Z91, AG4:AX91, including effective values and formulas. No workbook export or raw cell dump is included in this change.

Owner confirmed AW = September plan and AX = September fact despite the previously duplicated August heading. At this read AW2/AX2 say Plan/Fact and both row-3 headers already say `вер.26`. All 34 imported September metric rows were checked, together with intervening subtotal formulas. There are no formula errors in AW:AX within the relevant block. Values remain unscaled monetary amounts in the existing UAH report convention; no FX conversion or thousands multiplier is applied. The workbook's inherited numeric format includes a legacy `р.` suffix; it is not used to infer a new currency.

## September controls

| Measure | Plan AW | Fact AX |
| --- | ---: | ---: |
| Revenue, row 4 = row 5 + row 7 | 7,291,197.34 | 7,673,452.32 |
| Merchandise COGS, rows 11 + 13 | 2,558,036.09 | 2,684,914.14 |
| Aggregator commission, row 16 | 730,730.15 | 1,027,081.25 |
| Source COGS, row 10 = 11 + 13 + 16 | 3,288,766.24 | 3,711,995.39 |
| Source expenses, row 87 = 85 + 55, excludes commission | 1,587,600.00 | 1,648,437.81 |
| Report OPEX, atomic lines including commission once | 2,318,330.15 | 2,675,519.06 |
| Source row 89 and calculated operating result | 2,414,831.10 | 2,313,019.12 |

The report continues its existing classification: merchandise COGS excludes commission; OPEX includes it once. September source row 87 already excludes commission. No second subtraction is made. Plan/fact profit ties to source within one cent. Aggregator fact commission equals the sum of Glovo/Bolt/Loco rows 17–19. Source blank optional lines remain `null` in the bundle, with the existing line-sum convention unchanged.

Owner decision: all report totals, differences and shares are calculated in BI from monthly line amounts; workbook annual/variance/percentage formulas are not inputs. Revenue now explicitly sums the two channel lines. This exposes two inherited 2025 subtotal rounding discrepancies: February and March channel sums each exceed the stored source revenue subtotal by 1. January–August computed LY revenue is therefore 52,062,625 versus the source subtotal sum 52,062,623. No raw historical value is rewritten, and there is no material 2026 revenue difference.

AY:BA future months and BB annual totals contain external-link `#REF!` errors; they are excluded. BG is excluded because September uses plan minus fact while earlier periods use fact minus plan. Neither BB nor BG supplies report controls.

## Historical comparison and availability

Compared all 816 existing metric cells (34 metrics × 3 series × 8 months), using 0.005 tolerance only for source floating-point/legacy precision: 781 unchanged, 35 changed, zero formula errors in those imported cells.

- June, July and August 2026 marketing payroll, row 68: 70,000 in the bundled snapshot versus 78,000 in the live source each month; total difference +24,000.
- Row 87 plan/fact for January–August: 16 changes. The live source excludes commission; the old bundled source totals included it. June–August actual also includes the payroll increase.
- Row 89 plan/fact for January–August: 16 reciprocal changes from the changed expense totals. These are source reporting changes, not new cash/revenue.
- All January–August bundled values remain exactly unchanged. Their original capture date stays 2026-10-14; September capture date is 2026-11-17. Source expense semantics are explicit by period in metadata. Applying historical restatements remains a separate owner decision.

September 2025 (Z) has no raw revenue/expense baseline; formula-generated zeros and divide-by-zero ratios do not establish actual data. All appended September LY values are `null`. Selected periods including September have no aggregate LY or YoY; the report shows an explanatory note and em dashes. January–August comparisons remain available for equally covered periods. Charts keep their existing January–August LY values and a September gap.

Tests cover all historical values via a fixed pre-change digest, September arithmetic and commission counted once, missing LY for September and Jan–Sep, and rendered labels/notes/table/chart gaps. Full FIN-BI amount reconciliation, historical payroll restatement, and missing September 2025 remain outside this delivery snapshot update.
