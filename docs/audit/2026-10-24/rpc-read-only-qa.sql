-- Issue #43 revision, 2026-10-24. PREPARED; PRODUCTION NOT EXECUTED.
-- Only the date-filtered analytics RPC is allowlisted here. No refresh/sync/task functions.
-- An authorized operator may provide the existing BI password in the session setting
-- bi.audit_password via their protected client. Do not echo it, put it in shell history,
-- store it in this file or change any credential. Missing setting returns BLOCKED.
-- RPCs that lack from/to parameters (Ads/App/GBP) are deliberately excluded from
-- dated parity: their latest/default or all-history windows cannot prove these dates.
-- Save only aggregate output. Equality here establishes stored-value parity, never
-- upstream completeness, account/property scope, RLS correctness or rendered UI parity.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL TIME ZONE 'UTC';
WITH windows(period,lo,hi) AS (
 VALUES ('current30',DATE '2026-09-24',DATE '2026-10-23'),
        ('prior30',DATE '2026-08-25',DATE '2026-09-23'),
        ('trailing12months',DATE '2025-10-24',DATE '2026-10-23')
), payloads AS MATERIALIZED (
 SELECT w.*,CASE WHEN nullif(current_setting('bi.audit_password',true),'') IS NOT NULL
   THEN public.bi_digital_payload(current_setting('bi.audit_password',true),w.lo,w.hi)
   END AS payload FROM windows w
), warehouse AS (
 SELECT p.period,count(g.date_id) AS rows,count(g.sessions) AS known_sessions,
   count(g.purchases) AS known_purchases,count(g.purchase_revenue) AS known_revenue,
   sum(g.sessions) AS sessions,sum(g.purchases) AS purchases,sum(g.purchase_revenue) AS revenue
 FROM payloads p LEFT JOIN public.digital_ga4_daily g ON g.date_id BETWEEN p.lo AND p.hi
 GROUP BY p.period
)
SELECT p.period,p.lo,p.hi,
 CASE WHEN p.payload IS NULL THEN 'BLOCKED_MISSING_EXISTING_SESSION_AUTH'
      WHEN p.payload#>>'{meta,from}' IS DISTINCT FROM p.lo::text
        OR p.payload#>>'{meta,to}' IS DISTINCT FROM p.hi::text THEN 'FAIL_RPC_PERIOD'
      WHEN w.rows=0 OR w.known_sessions<>w.rows OR w.known_purchases<>w.rows
        OR w.known_revenue<>w.rows THEN 'UNKNOWN_MISSING_STORED_VALUES'
      WHEN (p.payload#>>'{current,sessions}')::numeric IS DISTINCT FROM w.sessions
        OR (p.payload#>>'{current,purchases}')::numeric IS DISTINCT FROM w.purchases
        OR (p.payload#>>'{current,purchaseRevenue}')::numeric IS DISTINCT FROM w.revenue
        THEN 'FAIL_STORED_RPC_PARITY'
      ELSE 'PASS_STORED_RPC_ONLY' END AS result,
 w.rows,w.known_sessions,w.known_purchases,w.known_revenue,
 w.sessions,w.purchases,w.revenue,
 p.payload#>'{current}' AS rpc_current,
 p.payload#>'{meta}' AS rpc_metadata,
 'UNKNOWN' AS upstream_parity,'UNKNOWN' AS rendered_ui_parity
FROM payloads p JOIN warehouse w USING(period) ORDER BY p.lo;
ROLLBACK;
