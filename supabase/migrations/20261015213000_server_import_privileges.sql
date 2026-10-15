-- Import scripts run with the server-only service_role key. It bypasses RLS,
-- but still requires explicit table privileges for bulk historical imports.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.architects TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birthday_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_interactions TO service_role;
