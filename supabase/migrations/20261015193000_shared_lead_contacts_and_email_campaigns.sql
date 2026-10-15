-- Keep one shared contact per phone while preserving every lead-marking event.
CREATE TYPE public.lead_engagement_tag AS ENUM ('curious', 'interested', 'regular', 'fan');
CREATE TYPE public.lead_interaction_source AS ENUM ('manual', 'historical_import');

ALTER TABLE public.leads
  ADD COLUMN touch_count integer NOT NULL DEFAULT 1 CHECK (touch_count >= 1),
  ADD COLUMN engagement_tag public.lead_engagement_tag NOT NULL DEFAULT 'curious',
  ADD COLUMN last_marked_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

UPDATE public.leads
SET last_marked_by = created_by
WHERE last_marked_by IS NULL;

CREATE UNIQUE INDEX leads_phone_key ON public.leads (phone);
CREATE INDEX leads_engagement_tag_idx ON public.leads (engagement_tag, last_marked_at DESC);

CREATE TABLE public.lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  reported_name text NOT NULL CHECK (btrim(reported_name) <> ''),
  account public.campaign_account NOT NULL,
  purpose public.lead_purpose NOT NULL,
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source public.lead_interaction_source NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_interactions_lead_created_idx ON public.lead_interactions (lead_id, created_at DESC);

INSERT INTO public.lead_interactions (lead_id, reported_name, account, purpose, marked_by, source, created_at)
SELECT id, name, account, purpose, created_by, 'historical_import', created_at
FROM public.leads;

ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_interactions_select ON public.lead_interactions FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.lead_interactions TO authenticated;

DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated USING (true);

ALTER TABLE public.campaigns
  ALTER COLUMN retarget_name DROP NOT NULL,
  ALTER COLUMN retarget_due_date DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_campaign_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.campaign_type = 'whatsapp' THEN
    NEW.total_leads := COALESCE(NEW.total_replies, 0)
      + COALESCE(NEW.total_instagram_clicks, 0)
      + COALESCE(NEW.total_whatsapp_channel_clicks, 0)
      + COALESCE(NEW.total_catalog_requests, 0)
      + COALESCE(NEW.total_inquiries, 0);
  END IF;

  NEW.percentage := CASE
    WHEN NEW.total_attempted IS NULL OR NEW.total_attempted = 0 OR NEW.total_delivered_final IS NULL THEN NULL
    ELSE ROUND((NEW.total_delivered_final::numeric / NEW.total_attempted::numeric) * 100, 2)
  END;
  RETURN NEW;
END;
$$;
