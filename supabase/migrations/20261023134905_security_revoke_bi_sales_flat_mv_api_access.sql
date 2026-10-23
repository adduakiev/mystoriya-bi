-- Issue #18 security hardening phase 1.
-- Removes direct Data API access to the BI materialized sales cache.
-- SECURITY DEFINER RPCs and service_role retain access.
revoke all privileges on table public.bi_sales_flat_mv from anon, authenticated;
grant select on table public.bi_sales_flat_mv to service_role;
