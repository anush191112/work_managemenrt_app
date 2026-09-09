-- Prevent counted-task progress from exceeding its required target.
-- NOT VALID preserves deployability for pre-existing data while enforcing the rule for new writes.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_quantity_done_within_required_check
  CHECK (quantity_required IS NULL OR quantity_done <= quantity_required) NOT VALID;
