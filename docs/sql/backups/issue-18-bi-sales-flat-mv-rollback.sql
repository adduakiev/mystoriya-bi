-- Rollback for migration 20261023134905_security_revoke_bi_sales_flat_mv_api_access.
-- Restores the pre-hardening ACL captured on 2026-10-23.
-- Use only if direct Data API access is intentionally required again.

grant all privileges on table public.bi_sales_flat_mv to anon, authenticated;
grant all privileges on table public.bi_sales_flat_mv to service_role;
