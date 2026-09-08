-- Phase 1: RLS helper functions + row-level security policies

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — used by RLS policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'admin'
$$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'manager'
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('admin', 'manager')
$$;

-- True when auth.uid() may access data belonging to target_user_id
CREATE OR REPLACE FUNCTION public.can_access_user(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN target_user_id = auth.uid() THEN true
    WHEN public.is_admin() THEN true
    WHEN public.is_manager() AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = target_user_id
        AND u.manager_id = auth.uid()
    ) THEN true
    ELSE false
  END
$$;

-- True when auth.uid() may access a task (via assignee scope)
CREATE OR REPLACE FUNCTION public.can_access_task(task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tasks t
    WHERE t.id = task_id
      AND public.can_access_user(t.assigned_to)
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on all public tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.off_day_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users
-- Admin: full access. Manager/Employee: read self + (manager reads direct reports)
-- Only admin may insert/update/delete user records
-- ---------------------------------------------------------------------------
CREATE POLICY users_select ON public.users
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(id));

CREATE POLICY users_insert ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY users_update ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY users_delete ON public.users
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- holidays — all authenticated users can read; admin/manager manage
-- ---------------------------------------------------------------------------
CREATE POLICY holidays_select ON public.holidays
  FOR SELECT
  TO authenticated
  USING (
    applies_to IS NULL
    OR auth.uid() = ANY (applies_to)
    OR public.is_admin_or_manager()
  );

CREATE POLICY holidays_insert ON public.holidays
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_manager() AND created_by = auth.uid());

CREATE POLICY holidays_update ON public.holidays
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

CREATE POLICY holidays_delete ON public.holidays
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_manager());

-- ---------------------------------------------------------------------------
-- off_day_requests
-- Employee: CRUD own pending requests. Admin/Manager: read/update in scope.
-- ---------------------------------------------------------------------------
CREATE POLICY off_day_requests_select ON public.off_day_requests
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(user_id));

CREATE POLICY off_day_requests_insert ON public.off_day_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (public.is_admin_or_manager() AND public.can_access_user(user_id))
  );

CREATE POLICY off_day_requests_update ON public.off_day_requests
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR (public.is_admin_or_manager() AND public.can_access_user(user_id))
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'pending')
    OR (public.is_admin_or_manager() AND public.can_access_user(user_id))
  );

CREATE POLICY off_day_requests_delete ON public.off_day_requests
  FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'pending')
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- task_templates — admin/manager manage templates for users in scope
-- ---------------------------------------------------------------------------
CREATE POLICY task_templates_select ON public.task_templates
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(assigned_to));

CREATE POLICY task_templates_insert ON public.task_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    AND public.can_access_user(assigned_to)
    AND created_by = auth.uid()
  );

CREATE POLICY task_templates_update ON public.task_templates
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_manager() AND public.can_access_user(assigned_to))
  WITH CHECK (public.is_admin_or_manager() AND public.can_access_user(assigned_to));

CREATE POLICY task_templates_delete ON public.task_templates
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_manager() AND public.can_access_user(assigned_to));

-- ---------------------------------------------------------------------------
-- tasks
-- Assignee updates own tasks; admin/manager manage tasks in scope
-- ---------------------------------------------------------------------------
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT
  TO authenticated
  USING (public.can_access_user(assigned_to));

CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND (
      (assigned_to = auth.uid() AND public.current_user_role() = 'employee')
      OR (public.is_admin_or_manager() AND public.can_access_user(assigned_to))
    )
  );

CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (public.can_access_user(assigned_to))
  WITH CHECK (public.can_access_user(assigned_to));

CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_manager() AND public.can_access_user(assigned_to));

-- ---------------------------------------------------------------------------
-- task_proofs — assignee uploads own proof; scoped read for admin/manager
-- ---------------------------------------------------------------------------
CREATE POLICY task_proofs_select ON public.task_proofs
  FOR SELECT
  TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY task_proofs_insert ON public.task_proofs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.can_access_task(task_id)
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.assigned_to = auth.uid()
    )
  );

CREATE POLICY task_proofs_delete ON public.task_proofs
  FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (public.is_admin_or_manager() AND public.can_access_task(task_id))
  );

-- ---------------------------------------------------------------------------
-- task_blockers — assignee raises blockers on own tasks
-- ---------------------------------------------------------------------------
CREATE POLICY task_blockers_select ON public.task_blockers
  FOR SELECT
  TO authenticated
  USING (public.can_access_task(task_id));

CREATE POLICY task_blockers_insert ON public.task_blockers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND t.assigned_to = auth.uid()
    )
  );

-- Blockers are immutable audit records — no update/delete policies

-- ---------------------------------------------------------------------------
-- audit_log — read scoped; inserts via triggers / service role only
-- ---------------------------------------------------------------------------
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR actor_id = auth.uid()
    OR (
      entity_type = 'task'
      AND public.can_access_task(entity_id)
    )
    OR (
      entity_type = 'off_day_request'
      AND EXISTS (
        SELECT 1
        FROM public.off_day_requests odr
        WHERE odr.id = entity_id
          AND public.can_access_user(odr.user_id)
      )
    )
    OR (
      entity_type = 'blocker'
      AND EXISTS (
        SELECT 1
        FROM public.task_blockers tb
        WHERE tb.id = entity_id
          AND public.can_access_task(tb.task_id)
      )
    )
  );

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- notifications — users read/update own notifications only
-- Inserts typically from edge functions (service role) or triggers
-- ---------------------------------------------------------------------------
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_or_manager()
    OR user_id = auth.uid()
  );
