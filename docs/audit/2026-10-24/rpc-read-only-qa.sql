-- Issue #43 revision: CATALOG METADATA ONLY; PRODUCTION NOT EXECUTED.
-- Supersedes the earlier payload-invocation design, which is WITHDRAWN.
-- Reviewer reports VOLATILE + SECURITY DEFINER payloads. READ ONLY is not
-- permission to invoke them. No password, service credential or payload call.
-- Existing authorized SELECT-only operator may collect metadata; do not change
-- grants/RLS/auth/protection. An empty result means unavailable/absent, not safe.
-- Metadata equality cannot prove exact deployed-function definition parity.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL TIME ZONE 'UTC';
SELECT n.nspname AS schema_name,p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
       pg_catalog.pg_get_function_arguments(p.oid) AS arguments_with_defaults,
       pg_catalog.pg_get_function_result(p.oid) AS result_type,
       p.provolatile AS volatility_code,p.prosecdef AS security_definer,
       p.proconfig AS function_configuration,
       'UNKNOWN' AS deployed_definition_parity,
       'NOT_EXECUTED' AS payload_execution
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'bi_overview_payload','bi_digital_payload','bi_digital_history_payload',
  'bi_digital_ads_payload','bi_digital_local_payload','bi_digital_meta_ads_payload',
  'bi_digital_social_payload','bi_digital_app_payload','bi_digital_merchant_payload'
)
ORDER BY p.proname,p.oid;
ROLLBACK;
