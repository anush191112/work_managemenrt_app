-- Correct the architect directory's state-relative serial numbers without
-- altering historical campaigns, export logs, or export items.
--
-- The current serial order remains the source order within each state. When
-- two records share a legacy serial number, creation time and ID make the
-- order deterministic. The temporary shift prevents collisions with the
-- unique (state, serial_no) index while rows are renumbered.

WITH bounds AS (
  SELECT COALESCE(MAX(serial_no), 0) + 1 AS serial_offset
  FROM public.architects
)
UPDATE public.architects
SET serial_no = architects.serial_no + bounds.serial_offset
FROM bounds;

WITH renumbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY state
      ORDER BY serial_no, created_at, id
    )::integer AS serial_no
  FROM public.architects
)
UPDATE public.architects AS architects
SET serial_no = renumbered.serial_no
FROM renumbered
WHERE architects.id = renumbered.id;
