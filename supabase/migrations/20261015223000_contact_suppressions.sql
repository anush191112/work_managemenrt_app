CREATE TABLE public.contact_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),
  reason text,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contact_suppressions_phone_idx ON public.contact_suppressions (phone);
ALTER TABLE public.contact_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_suppressions_select ON public.contact_suppressions FOR SELECT TO authenticated USING (true);
CREATE POLICY contact_suppressions_insert ON public.contact_suppressions FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY contact_suppressions_delete ON public.contact_suppressions FOR DELETE TO authenticated USING (public.is_admin());
GRANT SELECT, INSERT, DELETE ON public.contact_suppressions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_suppressions TO service_role;
