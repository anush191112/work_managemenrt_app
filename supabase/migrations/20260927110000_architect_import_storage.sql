-- Private raw uploads are written and read only by server-side service-role code.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('architect-imports', 'architect-imports', false, 10485760, ARRAY['text/csv', 'text/plain', 'application/vnd.ms-excel'])
ON CONFLICT (id) DO NOTHING;
