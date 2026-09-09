-- Backfill profiles for Auth users that existed before the signup trigger.
-- New users continue to be handled by public.handle_new_user().
INSERT INTO public.users (id, name, email, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'name', split_part(au.email, '@', 1)),
  au.email,
  'employee'::public.user_role
FROM auth.users AS au
ON CONFLICT (id) DO NOTHING;
