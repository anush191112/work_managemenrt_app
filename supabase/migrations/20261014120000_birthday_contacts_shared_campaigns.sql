-- A second birthday source remains independent from the architect directory.
CREATE TABLE public.birthday_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email text,
  address text,
  birthdate date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birthday_contacts_phone_key UNIQUE (phone)
);
CREATE INDEX birthday_contacts_birth_month_day_idx ON public.birthday_contacts (EXTRACT(MONTH FROM birthdate), EXTRACT(DAY FROM birthdate));

-- A phone can now describe multiple architects, but an identical person/phone pair is kept once.
DROP INDEX IF EXISTS public.architects_phone_key;
CREATE UNIQUE INDEX architects_name_phone_key ON public.architects (name, phone) WHERE phone IS NOT NULL;
CREATE INDEX architects_phone_idx ON public.architects (phone) WHERE phone IS NOT NULL;

ALTER TABLE public.architect_export_logs
  ADD COLUMN architect_contact_count integer NOT NULL DEFAULT 0,
  ADD COLUMN birthday_contact_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaigns
  ADD COLUMN campaign_completed_on date,
  ADD COLUMN assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN is_shared boolean NOT NULL DEFAULT false;
UPDATE public.campaigns SET assigned_to = created_by WHERE assigned_to IS NULL;
CREATE INDEX campaigns_assigned_to_date_idx ON public.campaigns (assigned_to, campaign_date);

ALTER TABLE public.lead_sheet_backlogs
  ALTER COLUMN owner_id DROP NOT NULL,
  ADD COLUMN is_shared boolean NOT NULL DEFAULT false;

ALTER TABLE public.birthday_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY birthday_contacts_select ON public.birthday_contacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS campaigns_select ON public.campaigns;
CREATE POLICY campaigns_select ON public.campaigns FOR SELECT TO authenticated
  USING (is_shared OR public.can_access_user(COALESCE(assigned_to, created_by)));
DROP POLICY IF EXISTS campaigns_update ON public.campaigns;
CREATE POLICY campaigns_update ON public.campaigns FOR UPDATE TO authenticated
  USING (is_shared OR public.can_access_user(COALESCE(assigned_to, created_by)))
  WITH CHECK (is_shared OR public.can_access_user(COALESCE(assigned_to, created_by)));

DROP POLICY IF EXISTS lead_sheet_backlogs_select ON public.lead_sheet_backlogs;
CREATE POLICY lead_sheet_backlogs_select ON public.lead_sheet_backlogs FOR SELECT TO authenticated
  USING (is_shared OR public.can_access_user(owner_id));
DROP POLICY IF EXISTS lead_sheet_backlog_items_select ON public.lead_sheet_backlog_items;
CREATE POLICY lead_sheet_backlog_items_select ON public.lead_sheet_backlog_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lead_sheet_backlogs b WHERE b.id = backlog_id AND (b.is_shared OR public.can_access_user(b.owner_id))));

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
  USING (public.can_access_user(assigned_to) OR EXISTS (SELECT 1 FROM public.lead_sheet_backlogs b WHERE b.task_id = public.tasks.id AND b.is_shared));

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (public.can_access_user(assigned_to) OR EXISTS (SELECT 1 FROM public.lead_sheet_backlogs b WHERE b.task_id = public.tasks.id AND b.is_shared))
  WITH CHECK (public.can_access_user(assigned_to) OR EXISTS (SELECT 1 FROM public.lead_sheet_backlogs b WHERE b.task_id = public.tasks.id AND b.is_shared));

CREATE OR REPLACE FUNCTION public.sync_campaign_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total_leads := COALESCE(NEW.total_replies, 0)
    + COALESCE(NEW.total_instagram_clicks, 0)
    + COALESCE(NEW.total_whatsapp_channel_clicks, 0)
    + COALESCE(NEW.total_catalog_requests, 0)
    + COALESCE(NEW.total_inquiries, 0);
  NEW.percentage := CASE
    WHEN NEW.total_attempted IS NULL OR NEW.total_attempted = 0 OR NEW.total_delivered_final IS NULL THEN NULL
    ELSE ROUND((NEW.total_delivered_final::numeric / NEW.total_attempted::numeric) * 100, 2)
  END;
  RETURN NEW;
END;
$$;
CREATE TRIGGER campaigns_sync_totals BEFORE INSERT OR UPDATE OF total_attempted, total_delivered_final, total_replies, total_instagram_clicks, total_whatsapp_channel_clicks, total_catalog_requests, total_inquiries ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_totals();

GRANT SELECT ON public.birthday_contacts TO authenticated;
