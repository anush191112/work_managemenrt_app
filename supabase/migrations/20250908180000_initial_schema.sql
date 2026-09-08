-- Phase 1: Employee Task Management — initial schema
-- Spec: phase1-task-management-spec.md Section 3

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'employee');

CREATE TYPE public.off_day_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE public.task_category AS ENUM (
  'whatsapp_campaign',
  'email_campaign',
  'inbox_check',
  'instagram_post',
  'content_research',
  'lead_sheet',
  'catalog_revamp',
  'other'
);

CREATE TYPE public.task_priority AS ENUM ('high', 'medium', 'low', 'flexible');

CREATE TYPE public.task_status AS ENUM (
  'not_started',
  'in_progress',
  'done',
  'at_risk',
  'blocked'
);

CREATE TYPE public.notification_type AS ENUM (
  'task_assigned',
  'deadline_approaching',
  'deadline_missed',
  'at_risk',
  'blocker_raised'
);

-- ---------------------------------------------------------------------------
-- users (extends Supabase Auth)
-- day_of_week / work_days use PostgreSQL DOW: 0=Sunday … 6=Saturday
-- Default work_days Mon–Sat = {1,2,3,4,5,6}
-- ---------------------------------------------------------------------------
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'employee',
  manager_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  work_days smallint[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::smallint[],
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id),
  CONSTRAINT users_work_days_valid CHECK (
    work_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
    AND cardinality(work_days) > 0
  )
);

CREATE INDEX users_manager_id_idx ON public.users (manager_id);
CREATE INDEX users_role_idx ON public.users (role);

-- ---------------------------------------------------------------------------
-- holidays
-- applies_to NULL → company-wide; otherwise scoped to listed user IDs
-- ---------------------------------------------------------------------------
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  label text NOT NULL,
  applies_to uuid[],
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX holidays_date_idx ON public.holidays (date);

-- ---------------------------------------------------------------------------
-- off_day_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.off_day_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  status public.off_day_request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT off_day_requests_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX off_day_requests_user_id_idx ON public.off_day_requests (user_id);
CREATE INDEX off_day_requests_date_idx ON public.off_day_requests (date);
CREATE INDEX off_day_requests_status_idx ON public.off_day_requests (status);

-- ---------------------------------------------------------------------------
-- task_templates (weekly recurring rules)
-- ---------------------------------------------------------------------------
CREATE TABLE public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category public.task_category NOT NULL,
  day_of_week smallint NOT NULL,
  assigned_to uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  quantity integer,
  time_allotted_minutes integer,
  is_mandatory boolean NOT NULL DEFAULT true,
  requires_proof boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT task_templates_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT task_templates_quantity_check CHECK (quantity IS NULL OR quantity >= 0),
  CONSTRAINT task_templates_time_check CHECK (
    time_allotted_minutes IS NULL OR time_allotted_minutes > 0
  )
);

CREATE INDEX task_templates_assigned_to_idx ON public.task_templates (assigned_to);
CREATE INDEX task_templates_day_of_week_idx ON public.task_templates (day_of_week);

-- ---------------------------------------------------------------------------
-- tasks (daily instances + manual / pool tasks)
-- has_blocker: spec §4.5 — separate from status so in_progress + blocked coexist
-- carried_forward_from: UI label when mandatory tasks shift before an off-day
-- ---------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES public.task_templates (id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  title text NOT NULL,
  category public.task_category NOT NULL,
  scheduled_date date NOT NULL,
  quantity_required integer,
  quantity_done integer NOT NULL DEFAULT 0,
  time_allotted_minutes integer,
  deadline_time time,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  status public.task_status NOT NULL DEFAULT 'not_started',
  requires_proof boolean NOT NULL DEFAULT false,
  has_blocker boolean NOT NULL DEFAULT false,
  is_pool_task boolean NOT NULL DEFAULT false,
  pool_target_total integer,
  pool_target_date date,
  carried_forward_from date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tasks_quantity_required_check CHECK (quantity_required IS NULL OR quantity_required >= 0),
  CONSTRAINT tasks_quantity_done_check CHECK (quantity_done >= 0),
  CONSTRAINT tasks_time_check CHECK (time_allotted_minutes IS NULL OR time_allotted_minutes > 0),
  CONSTRAINT tasks_pool_target_check CHECK (pool_target_total IS NULL OR pool_target_total > 0),
  CONSTRAINT tasks_pool_fields_check CHECK (
    (is_pool_task = false AND pool_target_total IS NULL AND pool_target_date IS NULL)
    OR is_pool_task = true
  )
);

CREATE INDEX tasks_assigned_to_scheduled_date_idx ON public.tasks (assigned_to, scheduled_date);
CREATE INDEX tasks_scheduled_date_idx ON public.tasks (scheduled_date);
CREATE INDEX tasks_status_idx ON public.tasks (status);
CREATE INDEX tasks_template_id_idx ON public.tasks (template_id);

-- ---------------------------------------------------------------------------
-- task_proofs
-- ---------------------------------------------------------------------------
CREATE TABLE public.task_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  file_url text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_proofs_task_id_idx ON public.task_proofs (task_id);

-- ---------------------------------------------------------------------------
-- task_blockers
-- ---------------------------------------------------------------------------
CREATE TABLE public.task_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks (id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  reason_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX task_blockers_task_id_idx ON public.task_blockers (task_id);
CREATE INDEX task_blockers_reported_by_idx ON public.task_blockers (reported_by);

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx ON public.audit_log (entity_type, entity_id);
CREATE INDEX audit_log_actor_id_idx ON public.audit_log (actor_id);
CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  related_task_id uuid REFERENCES public.tasks (id) ON DELETE SET NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_id_is_read_idx ON public.notifications (user_id, is_read);
CREATE INDEX notifications_created_at_idx ON public.notifications (created_at DESC);

-- ---------------------------------------------------------------------------
-- Realtime (dashboards subscribe to tasks + notifications)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
