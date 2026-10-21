ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_source_fields_check;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_source_fields_check CHECK (
    (source = 'state_wise' AND state IS NOT NULL AND serial_start IS NOT NULL AND serial_end IS NOT NULL)
    OR (source IN ('birthday', 'lead_export') AND state IS NULL AND serial_start IS NULL AND serial_end IS NULL)
  );
