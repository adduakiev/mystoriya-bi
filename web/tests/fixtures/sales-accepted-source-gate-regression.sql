-- Entirely synthetic; applied only after the existing atomic happy-path fixtures.
-- The gate overlay must already be installed in this disposable PostgreSQL cluster.
begin;
create function pg_temp.accepted_source_snapshot() returns text language sql as $$
  select md5(jsonb_build_object(
    'facts',(select jsonb_agg(to_jsonb(x) order by id) from public.fact_sales_daily x),
    'locations',(select jsonb_agg(to_jsonb(x) order by id) from public.dim_location x),
    'brands',(select jsonb_agg(to_jsonb(x) order by id) from public.dim_brand x),
    'owners',(select jsonb_agg(to_jsonb(x) order by id) from public.dim_ownership x),
    'channels',(select jsonb_agg(to_jsonb(x) order by id) from public.dim_channel x),
    'types',(select jsonb_agg(to_jsonb(x) order by id) from public.dim_order_type x),
    'dates',(select jsonb_agg(to_jsonb(x) order by date_id) from public.dim_date x),
    'mapping',(select jsonb_agg(to_jsonb(x) order by source_name) from public.map_location_source x),
    'lifecycle',(select jsonb_agg(to_jsonb(x) order by canonical_name) from public.location_lifecycle_registry x),
    'flat',(select jsonb_agg(to_jsonb(x) order by date,location) from public.bi_sales_flat_mv x),
    'monthly',(select jsonb_agg(to_jsonb(x) order by location_id) from public.agg_sales_monthly x),
    'weekly',(select jsonb_agg(to_jsonb(x) order by location_id) from public.agg_sales_weekly x),
    'imports',(select jsonb_agg(to_jsonb(x) order by id) from public.import_runs x),
    'runs',(select jsonb_agg(to_jsonb(x) order by id) from bi_import_private.sales_runs x),
    'batches',(select jsonb_agg(to_jsonb(x) order by run_id,batch_no) from bi_import_private.sales_batches x),
    'generation',(select version from bi_import_private.generation))::text);
$$;
do $fixture$
declare v_before text; v_id uuid; v_prior uuid; v_evidence jsonb; v_case text; v_role text;
begin
  v_before := pg_temp.accepted_source_snapshot();
  select id into strict v_prior from public.import_runs where status='success' order by finished_at desc limit 1;
  foreach v_case in array array['missing','empty','verified_flag','forged_complete','stale','wrong_run',
    'wrong_generation','changed_mapping','bad_totals','legacy_prior'] loop
    begin
      -- Reservation, staged batch and attempted evidence publication share this
      -- subtransaction. An error must undo ALL of them, including metadata.
      v_id := public.begin_sales_snapshot_v2('{"rows":1,"raw_rows":1,"batches":1,"revenue":10,"checks":1,"markup":5,"min_date":"2026-10-31","max_date":"2026-10-31"}');
      perform public.stage_sales_batch_v2(v_id,0,'[{"accounting_date":"2026-10-31","location_raw":"Gate-only synthetic","brand":"Gate-only brand","ownership":"Owned","channel_group":"Заклад","order_type":"Sale","revenue":10,"checks":1,"markup":5}]');
      v_evidence := jsonb_build_object('verified',true,'run_id',v_id,
        'base_generation',(select version::text from bi_import_private.generation),
        'generation',(select (version+1)::text from bi_import_private.generation),
        'sha256',repeat('a',64),'manifest_sha256',repeat('b',64),
        'warehouse_sha256',repeat('c',64),'mapping_sha256',repeat('d',64),
        'canonical_rows',jsonb_build_array(jsonb_build_array('2026-10-31','Gate-only synthetic',
          'Gate-only brand','Owned','Заклад','Заклад','Sale','1000','1','500')),
        'aliases',jsonb_build_array(jsonb_build_array('Gate-only synthetic','Gate-only synthetic')),
        'prior_receipt',jsonb_build_object('run_id',v_prior,'sha256',repeat('e',64)),
        'observations',jsonb_build_array(
          jsonb_build_object('observerId','synthetic-a','observedAt',clock_timestamp(),'signatureHex',repeat('a',128)),
          jsonb_build_object('observerId','synthetic-b','observedAt',clock_timestamp(),'signatureHex',repeat('b',128))));
      case v_case
        when 'missing' then v_evidence := null;
        when 'empty' then v_evidence := '{}';
        when 'verified_flag' then v_evidence := '{"verified":true}';
        when 'stale' then v_evidence := v_evidence || '{"observed_at":"2000-01-01T00:00:00Z"}';
        when 'wrong_run' then v_evidence := v_evidence || jsonb_build_object('run_id',v_prior);
        when 'wrong_generation' then v_evidence := v_evidence || '{"base_generation":"-1"}';
        when 'changed_mapping' then
          insert into public.map_location_source(source_name,canonical_name) values('Gate-only alias','Changed');
        when 'bad_totals' then
          update bi_import_private.sales_runs set revenue=11 where id=v_id;
        when 'legacy_prior' then v_evidence := v_evidence || '{"prior_receipt":{"kind":"legacy","verified":true}}';
        else null;
      end case;
      -- Even plausible success metadata is untrusted; it must not persist after
      -- rejection. This owner-only fixture write is NOT an attestation adapter.
      update public.import_runs set details=jsonb_build_object('accepted_source_v1',v_evidence) where id=v_id;
      set local role service_role;
      perform public.commit_sales_snapshot_with_evidence_v1(v_id,v_evidence);
      raise exception 'EXPECTED_GATE_FAILURE: %',v_case;
    exception when sqlstate '55000' then
      if sqlerrm <> 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE' then raise; end if;
    end;
    if current_user <> session_user then raise exception 'FIXTURE_ROLE_LEAK'; end if;
    if v_before is distinct from pg_temp.accepted_source_snapshot() then
      raise exception 'PARTIAL_EFFECTS_AFTER_GATE_REJECTION: %',v_case;
    end if;
  end loop;
  -- The previous one-argument promotion cannot bypass evidence, even for a
  -- formerly committed run. Historical success is not a new accepted receipt.
  begin
    set local role service_role;
    perform public.commit_sales_snapshot_v2(v_prior);
    raise exception 'OLD_COMMIT_BYPASS';
  exception when sqlstate '55000' then
    if sqlerrm <> 'SALES_ACCEPTED_SOURCE_ATTESTOR_UNAVAILABLE' then raise; end if;
  end;
  foreach v_role in array array['anon','authenticated'] loop
    if has_function_privilege(v_role,'public.commit_sales_snapshot_with_evidence_v1(uuid,jsonb)','execute') or
       has_function_privilege(v_role,'public.commit_sales_snapshot_v2(uuid)','execute') then
      raise exception 'PUBLIC_GATE_ACCESS';
    end if;
  end loop;
  if v_before is distinct from pg_temp.accepted_source_snapshot() then raise exception 'GATE_CHANGED_SNAPSHOT'; end if;
  raise notice 'FIXTURE_PHASE_ACCEPTED_SOURCE_GATE_REJECTED_ALL';
end $fixture$;
rollback;
select 'accepted_source_gate_no_partial_effects_passed';
