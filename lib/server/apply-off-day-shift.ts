import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { shiftTasksForOffDay } from "@/lib/task-engine/shift-tasks-for-off-day";
import { addIstDays } from "@/lib/task-engine/working-day";
import type {
  IstDateString,
  ShiftTasksForOffDayResult,
  TaskEngineHoliday,
  TaskEngineOffDayRequest,
  TaskEngineShiftTask,
  TaskEngineUser,
} from "@/lib/task-engine/types";

const MAX_WORKING_DAY_STEPS = 30;

export async function applyOffDayShift(
  userId: string,
  offDate: IstDateString,
): Promise<ShiftTasksForOffDayResult> {
  const admin = createAdminClient();
  const rangeStart = addIstDays(offDate, -MAX_WORKING_DAY_STEPS);
  const rangeEnd = addIstDays(offDate, MAX_WORKING_DAY_STEPS);
  const [{ data: userRow, error: userError }, { data: taskRows, error: tasksError }, { data: holidayRows, error: holidaysError }, { data: offDayRows, error: offDaysError }] = await Promise.all([
    admin.from("users").select("id, work_days").eq("id", userId).single(),
    admin.from("tasks").select("id, template_id, assigned_to, category, scheduled_date, quantity_required, priority, status, is_pool_task, carried_forward_from").eq("assigned_to", userId).gte("scheduled_date", rangeStart).lte("scheduled_date", rangeEnd),
    admin.from("holidays").select("date, applies_to").gte("date", rangeStart).lte("date", rangeEnd),
    admin.from("off_day_requests").select("user_id, date, status").eq("user_id", userId).eq("status", "approved").gte("date", rangeStart).lte("date", rangeEnd),
  ]);
  const dataError = userError ?? tasksError ?? holidaysError ?? offDaysError;
  if (dataError || !userRow) {
    throw new Error(dataError?.message ?? "Assigned user was not found");
  }

  const result = shiftTasksForOffDay({
    user: userRow as TaskEngineUser,
    offDate,
    tasks: (taskRows ?? []) as TaskEngineShiftTask[],
    holidays: (holidayRows ?? []) as TaskEngineHoliday[],
    offDayRequests: (offDayRows ?? []) as TaskEngineOffDayRequest[],
    maxWorkingDaySteps: MAX_WORKING_DAY_STEPS,
  });

  for (const move of result.moved) {
    const { error } = await admin.from("tasks").update({ scheduled_date: move.scheduled_date, carried_forward_from: move.carried_forward_from }).eq("id", move.taskId);
    if (error) throw new Error(error.message);
  }
  for (const merge of result.merged) {
    const { error: updateError } = await admin.from("tasks").update({ quantity_required: merge.quantity_required, carried_forward_from: merge.carried_forward_from }).eq("id", merge.targetTaskId);
    if (updateError) throw new Error(updateError.message);
    const { error: deleteError } = await admin.from("tasks").delete().eq("id", merge.sourceTaskId);
    if (deleteError) throw new Error(deleteError.message);
  }
  return result;
}
