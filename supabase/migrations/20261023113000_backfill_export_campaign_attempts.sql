-- Export-created campaigns should begin with the number of valid contacts that
-- were actually written to their CSV. Do not alter uploaded historical records.
UPDATE public.campaigns AS campaign
SET total_attempted = export_log.contact_count
FROM public.architect_export_logs AS export_log
WHERE campaign.csv_export_id = export_log.id
  AND campaign.campaign_date >= DATE '2026-10-19'
  AND campaign.total_attempted IS NULL;
