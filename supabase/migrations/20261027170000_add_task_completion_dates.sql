ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS completed_at date;

-- Use the recorded status transition where it exists. The latest transition to
-- done is the relevant completion for tasks that were reopened and completed again.
WITH latest_completions AS (
  SELECT DISTINCT ON (entity_id)
    entity_id,
    (created_at AT TIME ZONE 'Asia/Kolkata')::date AS completed_at
  FROM public.audit_log
  WHERE entity_type = 'task'
    AND action = 'status_changed'
    AND detail ->> 'new_status' = 'done'
  ORDER BY entity_id, created_at DESC
)
UPDATE public.tasks AS task
SET completed_at = completion.completed_at
FROM latest_completions AS completion
WHERE task.id = completion.entity_id
  AND task.status = 'done'
  AND task.completed_at IS NULL;

-- Server-side updates do not always write an audit row, so use updated_at only
-- as the fallback for already-completed historical tasks.
UPDATE public.tasks
SET completed_at = (updated_at AT TIME ZONE 'Asia/Kolkata')::date
WHERE status = 'done'
  AND completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at = (now() AT TIME ZONE 'Asia/Kolkata')::date;
  ELSIF NEW.status IS DISTINCT FROM 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_set_completed_at ON public.tasks;
CREATE TRIGGER tasks_set_completed_at
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_completed_at();

CREATE INDEX IF NOT EXISTS tasks_assigned_to_completed_at_idx
  ON public.tasks (assigned_to, completed_at DESC);
