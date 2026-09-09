-- RLS policies define row access, but Supabase API roles also need table privileges
-- before PostgREST can evaluate those policies.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.users,
  public.holidays,
  public.off_day_requests,
  public.task_templates,
  public.tasks,
  public.task_proofs,
  public.task_blockers,
  public.audit_log,
  public.notifications
TO authenticated, service_role;
