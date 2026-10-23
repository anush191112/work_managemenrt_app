-- Keep delivery totals consistent for UI updates, direct table edits, and imports.
CREATE OR REPLACE FUNCTION public.sync_campaign_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS campaigns_sync_totals ON public.campaigns;
CREATE TRIGGER campaigns_sync_totals
  BEFORE INSERT OR UPDATE OF total_attempted, total_delivered_first, retarget_delivered, total_replies, total_instagram_clicks, total_whatsapp_channel_clicks, total_catalog_requests, total_inquiries
  ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_totals();
