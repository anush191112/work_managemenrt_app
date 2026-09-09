import { nextWorkingDay, previousWorkingDay } from "./working-day";
import type {
  IstDateString,
  ShiftTasksForOffDayInput,
  ShiftTasksForOffDayResult,
  TaskEngineShiftTask,
} from "./types";

function shiftsForward(task: TaskEngineShiftTask): boolean {
  return (
    task.is_pool_task ||
    task.priority === "flexible" ||
    task.category === "lead_sheet" ||
    task.category === "catalog_revamp"
  );
}

function mergedQuantity(
  target: number | null,
  source: number | null,
): number | null {
  if (target === null || source === null) {
    return target ?? source;
  }

  return target + source;
}

function findMergeTarget(
  tasks: TaskEngineShiftTask[],
  source: TaskEngineShiftTask,
  targetDate: IstDateString,
): TaskEngineShiftTask | undefined {
  if (source.template_id === null) {
    return undefined;
  }

  return tasks.find(
    (task) =>
      task.id !== source.id &&
      task.template_id === source.template_id &&
      task.assigned_to === source.assigned_to &&
      task.scheduled_date === targetDate,
  );
}

/**
 * Plans the changes needed when an employee's working date becomes an off-day.
 * Database callers apply the returned moves, merges, and source-task deletes atomically.
 */
export function shiftTasksForOffDay(
  input: ShiftTasksForOffDayInput,
): ShiftTasksForOffDayResult {
  const { user, offDate, tasks, holidays, offDayRequests, maxWorkingDaySteps } = input;
  const result: ShiftTasksForOffDayResult = { moved: [], merged: [], skipped: [] };

  const affectedTasks = tasks.filter(
    (task) => task.assigned_to === user.id && task.scheduled_date === offDate,
  );

  for (const task of affectedTasks) {
    if (task.status === "done") {
      result.skipped.push({ taskId: task.id, reason: "completed" });
      continue;
    }

    const movesForward = shiftsForward(task);
    const targetDate = movesForward
      ? nextWorkingDay(offDate, {
          user,
          holidays,
          offDayRequests,
          maxSteps: maxWorkingDaySteps,
        })
      : previousWorkingDay(offDate, {
          user,
          holidays,
          offDayRequests,
          maxSteps: maxWorkingDaySteps,
        });

    if (targetDate === null) {
      result.skipped.push({
        taskId: task.id,
        reason: movesForward ? "no_next_working_day" : "no_previous_working_day",
      });
      continue;
    }

    const mergeTarget = findMergeTarget(tasks, task, targetDate);
    if (mergeTarget) {
      result.merged.push({
        sourceTaskId: task.id,
        targetTaskId: mergeTarget.id,
        quantity_required: mergedQuantity(
          mergeTarget.quantity_required,
          task.quantity_required,
        ),
        carried_forward_from: offDate,
      });
      continue;
    }

    result.moved.push({
      taskId: task.id,
      scheduled_date: targetDate,
      carried_forward_from: offDate,
    });
  }

  return result;
}
