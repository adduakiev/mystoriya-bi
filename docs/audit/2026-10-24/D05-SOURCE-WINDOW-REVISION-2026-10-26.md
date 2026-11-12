# D05 selected-period/source-window correction — 2026-10-26

Bounded preview-code continuation of issue #43 / existing PR #44. Source restored
from exact PR HEAD `6055ab54746be16a99c75d1bd4989d033894a4e5` before edits;
every tracked blob matched. Archive writes to read-only `.agents` were rejected,
but the existing `.agents` blobs matched the requested source. No Git metadata
was changed. Checkout commit remains main `4f0cfcec48408428d51ee916cb87a97a256e4807`;
it is **not** the candidate revision SHA. Outer workflow owns WORKING/status,
commit/push and same-PR recovery. Candidate SHA is pending the trusted runner.

Acceptance and recovery references supplied in the trusted trigger:
- https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6411929684
- https://github.com/adduakiev/mystoriya-bi/pull/44#issuecomment-6412526876

Direct read attempts with `gh api` returned exit 4 (GH_TOKEN unavailable).
No GitHub comments were posted from Codex. Outer WORKING acknowledgement is not
independently verified here; this report does not assert remote READY.

## Reproduction and resulting behavior

P1 D05 before: `/digital?from=2025-06-01&to=2025-06-30&compare=previous`
sends June 2025 to GA4/GSC but no date arguments to Ads or Local. The overview's
shared period header lacked the independent Ads/Local source boundaries. An Ads
zero-conversion attention signal only said "available window". Live discrepancy
amount, production coverage and source freshness remain UNKNOWN.

After: GA4/GSC selection, prior-period/YoY requests, counts/rates and daily chart
remain unchanged. Controls explicitly say GA4/GSC. Ads and Local independently
show `meta.from → meta.to` in source disclosures and each associated KPI card.
Missing/invalid boundaries show UNKNOWN; a match requires **both** valid ordered
boundaries to equal the selected range. A match still does not prove upstream
coverage. All disclosures state independent selection, completeness UNKNOWN and
source freshness UNKNOWN; selected-period Ads/Local comparisons are unavailable.

The attention signal requires positive spend and numeric measured-zero
conversions, excludes null/unknown conversions and identifies the Ads source
period independently of GA4/GSC. Campaign-snapshot boundaries are not separately
proven; the signal and disclosure state this limitation. PageSpeed remains a
separate snapshot with measurement date UNKNOWN. No account, coverage, source
freshness, currency or attribution proof is inferred from boundaries.

| Layer | Period contract / result | Evidence |
| --- | --- | --- |
| GA4/GSC current/prior | Selected dates still reach existing `bi_digital_payload` calls | `web/tests/source-window.test.mjs`; existing preview contracts |
| Google Ads overview KPIs | `bi_digital_ads_payload` unchanged, no date args; independent returned window | `web/app/digital/page.tsx`; SSR fixture 2026-10-12 → 2026-10-23 |
| Local / GBP overview KPIs | `bi_digital_local_payload` unchanged, no date args; independent returned window | Same page; SSR fixture 2026-10-10 → 2026-10-21 |
| Ads campaign signal | Positive spend + conversions exactly zero; Ads window named; snapshot-period limitation explicit | SSR zero/null/unknown cases |
| Source-window matching | Both valid boundaries required; unknown and same-end/different-start tested | `web/lib/source-evidence.ts`; helper and actual SSR tests |
| Money / ROAS | D22 Ads money/ROAS UNKNOWN, D23 GA4 currency UNKNOWN, Meta USD/null contracts preserved | Existing currency/Meta/source/SQL regression suites |

## Verification and remaining gates

All test inputs above are synthetic. No authenticated browser or viewport tests
were executed and no screenshots were taken. The existing 66-case browser plan
remains NOT_EXECUTED. No source totals, coverage counts, SQL data, upstream
reconciliation or production claims are updated by this code revision. Historical
coverage receipts remain dated evidence. D05 remains OPEN in the overall audit
until authenticated preview and release review; this bounded UI correction is
prepared for code review only.

See [verification receipt](d05-source-window-verification-2026-10-26.json) for
actual final checks, source hashes, candidate-branch reference and limitations.
Generated inventory/matrix and RPC lineage are refreshed from the modified page;
they remain static candidate lineage, not runtime proof.

No SQL, migrations, RPC signatures, credentials, protection settings, providers,
schedulers, advertising settings, external/business writes or owner gates changed.
Owner action NONE for this code/tests revision. Authenticated preview verification
and release remain separate gates; the wider issue #43 audit is INCOMPLETE.
