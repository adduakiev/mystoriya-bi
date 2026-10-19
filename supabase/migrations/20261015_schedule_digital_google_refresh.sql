-- Refresh modeled Digital Google tables after Windsor staging exports.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname='digital_google_models_hourly'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'digital_google_models_hourly',
    '30 * * * *',
    'select public.refresh_digital_google_models();'
  );
end;
$$;
