-- Phase 2a/2b: architect directory, exports, campaigns, lead sheets, and leads.
CREATE TYPE public.campaign_type AS ENUM ('whatsapp', 'email');
CREATE TYPE public.campaign_source AS ENUM ('state_wise', 'birthday');
CREATE TYPE public.campaign_account AS ENUM (
  'whatsapp_9928781655',
  'whatsapp_9928501655',
  'email_stonekingexports',
  'email_stonekingexportindia'
);
CREATE TYPE public.campaign_stage AS ENUM ('awaiting_completion', 'complete');
CREATE TYPE public.lead_purpose AS ENUM (
  'requested_for_catalog', 'casual_reply', 'inquiry', 'instagram_whatsapp_channel'
);

CREATE TABLE public.architects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state text NOT NULL CHECK (btrim(state) <> ''),
  serial_no integer NOT NULL CHECK (serial_no > 0),
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text,
  email text,
  address text,
  birthdate date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT architects_contact_required CHECK (phone IS NOT NULL OR email IS NOT NULL),
  CONSTRAINT architects_phone_valid CHECK (phone IS NULL OR phone ~ '^[6-9][0-9]{9}$')
);
CREATE UNIQUE INDEX architects_state_serial_no_key ON public.architects (state, serial_no);
CREATE UNIQUE INDEX architects_phone_key ON public.architects (phone) WHERE phone IS NOT NULL;
CREATE INDEX architects_state_serial_no_idx ON public.architects (state, serial_no);
CREATE INDEX architects_birthdate_idx ON public.architects (birthdate) WHERE birthdate IS NOT NULL;

CREATE TABLE public.architect_export_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  state text,
  campaign_type public.campaign_type NOT NULL,
  serial_start integer,
  serial_end integer,
  birthdate_filter date,
  contact_count integer NOT NULL CHECK (contact_count > 0),
  exported_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT architect_export_logs_filter_check CHECK (
    (state IS NOT NULL AND serial_start IS NOT NULL AND serial_end IS NOT NULL AND birthdate_filter IS NULL)
    OR (state IS NULL AND serial_start IS NULL AND serial_end IS NULL AND birthdate_filter IS NOT NULL)
  )
);
CREATE INDEX architect_export_logs_exported_at_idx ON public.architect_export_logs (exported_at);
CREATE INDEX architect_export_logs_exported_by_idx ON public.architect_export_logs (exported_by, exported_at DESC);

CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type public.campaign_type NOT NULL,
  source public.campaign_source NOT NULL,
  account public.campaign_account NOT NULL,
  state text,
  serial_start integer,
  serial_end integer,
  csv_export_id uuid UNIQUE REFERENCES public.architect_export_logs(id) ON DELETE SET NULL,
  campaign_date date NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  total_attempted integer CHECK (total_attempted >= 0),
  total_delivered_first integer CHECK (total_delivered_first >= 0),
  retarget_name text NOT NULL,
  retarget_due_date date NOT NULL,
  retarget_completed_on date,
  retarget_attempted integer CHECK (retarget_attempted >= 0),
  retarget_delivered integer CHECK (retarget_delivered >= 0),
  total_delivered_final integer CHECK (total_delivered_final >= 0),
  percentage numeric(7, 2),
  total_failed integer CHECK (total_failed >= 0),
  total_replies integer CHECK (total_replies >= 0),
  total_instagram_clicks integer CHECK (total_instagram_clicks >= 0),
  total_whatsapp_channel_clicks integer CHECK (total_whatsapp_channel_clicks >= 0),
  total_catalog_requests integer CHECK (total_catalog_requests >= 0),
  total_inquiries integer CHECK (total_inquiries >= 0),
  total_leads integer NOT NULL DEFAULT 0 CHECK (total_leads >= 0),
  stage public.campaign_stage NOT NULL DEFAULT 'awaiting_completion',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_source_fields_check CHECK (
    (source = 'state_wise' AND state IS NOT NULL AND serial_start IS NOT NULL AND serial_end IS NOT NULL)
    OR (source = 'birthday' AND state IS NULL AND serial_start IS NULL AND serial_end IS NULL)
  ),
  CONSTRAINT campaigns_account_type_check CHECK (
    (campaign_type = 'whatsapp' AND account IN ('whatsapp_9928781655', 'whatsapp_9928501655'))
    OR (campaign_type = 'email' AND account IN ('email_stonekingexports', 'email_stonekingexportindia'))
  )
);
CREATE INDEX campaigns_created_by_date_idx ON public.campaigns (created_by, campaign_date);
CREATE INDEX campaigns_stage_idx ON public.campaigns (stage, campaign_date);
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.architect_export_logs
  ADD COLUMN campaign_id uuid UNIQUE REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE TABLE public.architect_export_items (
  export_id uuid NOT NULL REFERENCES public.architect_export_logs(id) ON DELETE CASCADE,
  architect_id uuid NOT NULL REFERENCES public.architects(id) ON DELETE RESTRICT,
  PRIMARY KEY (export_id, architect_id)
);
CREATE INDEX architect_export_items_architect_idx ON public.architect_export_items (architect_id, export_id);

CREATE TABLE public.weekly_lead_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_lead_sheets_owner_week_key UNIQUE (owner_id, week_start)
);

CREATE TABLE public.weekly_lead_sheet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_lead_sheet_id uuid NOT NULL REFERENCES public.weekly_lead_sheets(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_lead_sheet_items_campaign_key UNIQUE (weekly_lead_sheet_id, campaign_id)
);
CREATE INDEX weekly_lead_sheet_items_campaign_idx ON public.weekly_lead_sheet_items(campaign_id);

CREATE TABLE public.lead_sheet_backlogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_sheet_backlogs_owner_idx ON public.lead_sheet_backlogs(owner_id);

CREATE TABLE public.lead_sheet_backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backlog_id uuid NOT NULL REFERENCES public.lead_sheet_backlogs(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_sheet_backlog_items_campaign_key UNIQUE (backlog_id, campaign_id)
);
CREATE INDEX lead_sheet_backlog_items_campaign_idx ON public.lead_sheet_backlog_items(campaign_id);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  architect_id uuid REFERENCES public.architects(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  account public.campaign_account NOT NULL,
  purpose public.lead_purpose NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_phone_idx ON public.leads(phone);
CREATE INDEX leads_created_by_idx ON public.leads(created_by, created_at DESC);

ALTER TABLE public.architects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architect_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.architect_export_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_lead_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_lead_sheet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sheet_backlogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sheet_backlog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY architects_select ON public.architects FOR SELECT TO authenticated USING (true);
CREATE POLICY architect_export_logs_select ON public.architect_export_logs FOR SELECT TO authenticated USING (
  public.is_admin() OR (public.is_manager() AND public.can_access_user(exported_by))
);
CREATE POLICY architect_export_items_select ON public.architect_export_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.architect_export_logs l WHERE l.id = export_id AND (public.is_admin() OR (public.is_manager() AND public.can_access_user(l.exported_by))))
);
CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated USING (public.can_access_user(created_by));
CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated USING (public.can_access_user(created_by)) WITH CHECK (public.can_access_user(created_by));
CREATE POLICY weekly_lead_sheets_select ON public.weekly_lead_sheets FOR SELECT TO authenticated USING (public.can_access_user(owner_id));
CREATE POLICY weekly_lead_sheet_items_select ON public.weekly_lead_sheet_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.weekly_lead_sheets s WHERE s.id = weekly_lead_sheet_id AND public.can_access_user(s.owner_id)));
CREATE POLICY lead_sheet_backlogs_select ON public.lead_sheet_backlogs FOR SELECT TO authenticated USING (public.can_access_user(owner_id));
CREATE POLICY lead_sheet_backlog_items_select ON public.lead_sheet_backlog_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.lead_sheet_backlogs b WHERE b.id = backlog_id AND public.can_access_user(b.owner_id)));
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated USING (public.can_access_user(created_by));
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

GRANT SELECT ON public.architects, public.architect_export_logs, public.architect_export_items, public.campaigns, public.weekly_lead_sheets, public.weekly_lead_sheet_items, public.lead_sheet_backlogs, public.lead_sheet_backlog_items, public.leads TO authenticated;
GRANT INSERT ON public.leads TO authenticated;
GRANT UPDATE ON public.campaigns TO authenticated;
