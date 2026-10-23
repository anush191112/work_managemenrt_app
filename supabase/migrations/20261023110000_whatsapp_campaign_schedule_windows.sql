-- Keep the campaign and retarget windows explicit. Completion dates remain actual
-- performance data and are deliberately not used for planned schedule dates.
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_end_date date,
  ADD COLUMN IF NOT EXISTS retarget_start_date date;

-- Correct only tool-created WhatsApp campaigns scheduled on or after 19 Oct 2026.
-- Earlier historical records retain their imported dates exactly as uploaded.
WITH scheduled_campaigns AS (
  SELECT
    id,
    campaign_date,
    source,
    CASE
      WHEN source = 'birthday' THEN campaign_date + 3
      WHEN EXTRACT(DOW FROM campaign_date)::integer IN (1, 2)
        THEN campaign_date + (5 - EXTRACT(DOW FROM campaign_date)::integer)
      ELSE campaign_date + (6 - EXTRACT(DOW FROM campaign_date)::integer)
    END AS campaign_end_date,
    CASE
      WHEN source = 'birthday' THEN campaign_date + 4
      WHEN EXTRACT(DOW FROM campaign_date)::integer = 0 THEN campaign_date + 1
      WHEN EXTRACT(DOW FROM campaign_date)::integer = 1 THEN campaign_date + 7
      ELSE campaign_date + (8 - EXTRACT(DOW FROM campaign_date)::integer)
    END AS retarget_start_date
  FROM public.campaigns
  WHERE campaign_type = 'whatsapp'
    AND campaign_date >= DATE '2026-10-19'
    AND (csv_export_id IS NOT NULL OR source IN ('birthday', 'lead_export'))
)
UPDATE public.campaigns AS campaign
SET
  campaign_end_date = scheduled.campaign_end_date,
  retarget_start_date = scheduled.retarget_start_date,
  retarget_due_date = CASE
    WHEN scheduled.source = 'birthday' THEN scheduled.retarget_start_date + 3
    ELSE scheduled.retarget_start_date + 4
  END
FROM scheduled_campaigns AS scheduled
WHERE campaign.id = scheduled.id;
