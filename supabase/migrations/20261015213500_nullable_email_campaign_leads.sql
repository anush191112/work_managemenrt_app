-- Historical email campaigns can have an unknown reported lead count.
-- WhatsApp campaign totals continue to be populated by sync_campaign_totals.
ALTER TABLE public.campaigns
  ALTER COLUMN total_leads DROP NOT NULL;
