# Glovo v1 private read — issue #48

The Glovo report now reads the approved private Google Sheet on each page request using the existing server-only service account. The OAuth scope is `spreadsheets.readonly`. It neither changes the Sheet nor stores business rows, credentials, tokens, or schedules.

The reader checks the spreadsheet and tab identity, reads A:I from the header at row 5 through the current grid boundary, and checks metadata again. Responses are bounded to 1 MiB and five seconds per request; authentication responses have a smaller bound. Redirects, invalid headers/rows, changed grid dimensions and incomplete responses fail closed with a sanitized unavailable state. Google does not provide a transactional snapshot across these calls: concurrent cell edits remain a limitation.

## Report behavior

- Default period: January–October 2026. Later source months require explicit selection.
- Filters: month, original brand, approved group, source location and mapping state; sorting by month, brand, orders, purchase amount or original Excel row.
- Brand links open brand/location detail. Each row retains its source labels, original Excel row and aggregate identity.
- Missing measures remain missing. Totals containing missing measures are unavailable. The average ticket requires known purchase amount and a positive order count.
- Every runtime month is PARTIAL until original-export completeness is independently established. Same-workbook reconciliation and a successful API read do not establish completeness. Period comparisons require complete coverage on both sides.
- Only approved Meat Bar aliases normalize to МітБар. Physical location, ownership and real/virtual classification remain UNKNOWN; a shared address does not establish identity. Currency identity and original-export freshness are unverified.

## Deployment and handoff

The runtime uses the existing `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` server variable. No client-side or public variable is used. Missing configuration or inaccessible Sheet shows SOURCE UNAVAILABLE. Preview verification must use the approved branch-scoped configuration and the exact reviewed commit. Production must have the corresponding server configuration before release.

Review the authenticated report, default period, explicit November selection, one brand/location drilldown, null rendering and unchanged Sales navigation. Compare aggregate row counts and known numeric measures against the private source audit; never commit that audit's business rows. Record real access and deployment results separately from mocked transport tests.

Remaining business work for #48: approved crosswalk for physical sites / ownership / real-versus-virtual brands; original-export coverage and currency confirmation. This delivery does not close those questions.
