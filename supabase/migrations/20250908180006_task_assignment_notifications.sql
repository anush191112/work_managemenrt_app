-- Make assignment notifications atomic with task creation for both manual and scheduled tasks.
CREATE OR REPLACE FUNCTION public.notify_task_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, related_task_id, message)
  VALUES (
    NEW.assigned_to,
    'task_assigned'::public.notification_type,
    NEW.id,
    format('You have been assigned task "%s".', NEW.title)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_notify_assignee
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignee();
