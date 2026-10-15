-- Pool templates seed one ongoing task that remains visible until its target is cleared.
ALTER TABLE public.task_templates
  ADD COLUMN repeats_daily_until_cleared boolean NOT NULL DEFAULT false;

ALTER TABLE public.task_templates
  ADD CONSTRAINT task_templates_pool_requires_quantity_check
  CHECK (NOT repeats_daily_until_cleared OR quantity IS NOT NULL AND quantity > 0);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_pool_target_required_check
  CHECK (NOT is_pool_task OR pool_target_total IS NOT NULL AND pool_target_total > 0) NOT VALID;
