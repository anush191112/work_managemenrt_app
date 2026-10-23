-- Email campaigns do not have a retarget phase. Keep their reported metrics intact.
CREATE OR REPLACE FUNCTION public.sync_campaign_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.campaign_type = 'email' THEN
    NEW.retarget_name := NULL;
    NEW.retarget_due_date := NULL;
    NEW.retarget_completed_on := NULL;
    NEW.campaign_completed_on := COALESCE(NEW.campaign_completed_on, NEW.campaign_date);
    NEW.stage := 'complete';
  ELSE
    IF NEW.total_delivered_first IS NULL AND NEW.retarget_delivered IS NULL THEN
      NEW.total_delivered_final := NULL;
    ELSE
      NEW.total_delivered_final := COALESCE(NEW.total_delivered_first, 0) + COALESCE(NEW.retarget_delivered, 0);
    END IF;

    IF NEW.total_attempted IS NULL OR NEW.total_delivered_final IS NULL THEN
      NEW.total_failed := NULL;
    ELSIF NEW.total_delivered_final > NEW.total_attempted THEN
      RAISE EXCEPTION 'Total delivered cannot be greater than total attempted';
    ELSE
      NEW.total_failed := NEW.total_attempted - NEW.total_delivered_final;
    END IF;

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

UPDATE public.campaigns
SET
  retarget_name = NULL,
  retarget_due_date = NULL,
  retarget_completed_on = NULL,
  campaign_completed_on = COALESCE(campaign_completed_on, campaign_date),
  stage = 'complete'
WHERE campaign_type = 'email';
