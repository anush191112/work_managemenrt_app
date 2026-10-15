-- Populate the export state selector without fetching the entire architect directory.
CREATE OR REPLACE FUNCTION public.list_architect_states()
RETURNS TABLE (state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT a.state
  FROM public.architects a
  WHERE btrim(a.state) <> ''
  ORDER BY a.state;
$$;

GRANT EXECUTE ON FUNCTION public.list_architect_states() TO authenticated, service_role;

-- Server-side export creation records an audit entry and its exported contacts.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.architect_export_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.architect_export_items TO service_role;
