-- Phase 1: Auth sync, audit triggers, business rules, storage bucket

-- ---------------------------------------------------------------------------
-- Sync auth.users → public.users on signup
-- Role is always 'employee' by default; admin promotes via User Management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'employee'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Require proof before marking task done
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_task_proof_on_done()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'done'
     AND NEW.requires_proof
     AND OLD.status IS DISTINCT FROM 'done'
     AND NOT EXISTS (
       SELECT 1 FROM public.task_proofs tp WHERE tp.task_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'Cannot mark task done: at least one proof upload is required'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_enforce_proof_on_done
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_proof_on_done();

-- ---------------------------------------------------------------------------
-- Generic audit log writer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_detail jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, detail)
  VALUES (p_entity_type, p_entity_id, p_action, auth.uid(), p_detail);
END;
$$;

-- ---------------------------------------------------------------------------
-- Task status change → audit_log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.write_audit_log(
      'task',
      NEW.id,
      'status_changed',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_audit_status_change
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_task_status_change();

-- ---------------------------------------------------------------------------
-- Blocker raised → set has_blocker, audit, notify admin + manager
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_task_blocker_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.tasks%ROWTYPE;
  v_admin_id uuid;
  v_manager_id uuid;
  v_message text;
BEGIN
  SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;

  UPDATE public.tasks
  SET has_blocker = true,
      status = CASE
        WHEN status IN ('not_started', 'in_progress') THEN 'blocked'::public.task_status
        ELSE status
      END
  WHERE id = NEW.task_id;

  INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, detail)
  VALUES (
    'blocker',
    NEW.id,
    'blocker_added',
    NEW.reported_by,
    jsonb_build_object(
      'task_id', NEW.task_id,
      'reason_text', NEW.reason_text
    )
  );

  v_message := format('Blocker raised on task "%s": %s', v_task.title, NEW.reason_text);

  -- Notify all admins
  FOR v_admin_id IN
    SELECT id FROM public.users WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, related_task_id, message)
    VALUES (v_admin_id, 'blocker_raised', NEW.task_id, v_message);
  END LOOP;

  -- Notify the employee's manager (if any)
  SELECT manager_id INTO v_manager_id
  FROM public.users
  WHERE id = v_task.assigned_to;

  IF v_manager_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, related_task_id, message)
    VALUES (v_manager_id, 'blocker_raised', NEW.task_id, v_message);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_blockers_after_insert
  AFTER INSERT ON public.task_blockers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_task_blocker_insert();

-- ---------------------------------------------------------------------------
-- Proof uploaded → audit_log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_task_proof_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (entity_type, entity_id, action, actor_id, detail)
  VALUES (
    'task',
    NEW.task_id,
    'proof_uploaded',
    NEW.uploaded_by,
    jsonb_build_object('proof_id', NEW.id, 'file_url', NEW.file_url)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_proofs_after_insert
  AFTER INSERT ON public.task_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_task_proof_insert();

-- ---------------------------------------------------------------------------
-- Storage: task-proofs bucket (images only, 5 MB — see config.toml)
-- Path convention: {user_id}/{task_id}/{filename}
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-proofs',
  'task-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY task_proofs_storage_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-proofs'
    AND public.can_access_task((storage.foldername(name))[2]::uuid)
  );

CREATE POLICY task_proofs_storage_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'task-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = (storage.foldername(name))[2]::uuid
        AND t.assigned_to = auth.uid()
    )
  );

CREATE POLICY task_proofs_storage_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-proofs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin_or_manager()
    )
  );
