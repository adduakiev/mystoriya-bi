-- Gate D #37 orchestrator rollback.
-- Disables the recurring adapter surface without deleting Meta data.
drop function if exists public.sync_meta_windsor_snapshot(text,date,date,jsonb);
