import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateDailyTasks } from "@/lib/task-engine/generate-daily-tasks";
import { generateLeadSheetTasks } from "@/lib/server/lead-sheet-tasks";
import type {
  IstDateString,
  TaskEngineExistingTask,
  TaskEngineHoliday,
  TaskEngineOffDayRequest,
  TaskEngineTemplate,
  TaskEnginePoolTask,
  TaskEngineUser,
} from "@/lib/task-engine/types";

export async function generateTasksForUsers(date: IstDateString, users: TaskEngineUser[]) {
  if (users.length === 0) return { date, created: 0, skipped: {} };

  const admin = createAdminClient();
  const userIds = users.map((user) => user.id);
  const [{ data: templateRows, error: templatesError }, { data: existingRows, error: tasksError }, { data: poolRows, error: poolsError }, { data: holidayRows, error: holidaysError }, { data: offDayRows, error: offDaysError }] = await Promise.all([
    admin.from("task_templates").select("id, title, category, day_of_week, assigned_to, quantity, time_allotted_minutes, is_mandatory, requires_proof, repeats_daily_until_cleared, created_by").in("assigned_to", userIds),
    admin.from("tasks").select("template_id, assigned_to, scheduled_date").in("assigned_to", userIds).eq("scheduled_date", date),
    admin.from("tasks").select("template_id, assigned_to, quantity_done, pool_target_total, status").in("assigned_to", userIds).eq("is_pool_task", true).neq("status", "done"),
    admin.from("holidays").select("date, applies_to").eq("date", date),
    admin.from("off_day_requests").select("user_id, date, status").eq("date", date).eq("status", "approved"),
  ]);
  const dataError = templatesError ?? tasksError ?? poolsError ?? holidaysError ?? offDaysError;
  if (dataError) throw new Error(dataError.message);

  const result = generateDailyTasks({
    date,
    users,
    templates: (templateRows ?? []) as TaskEngineTemplate[],
    existingTasks: (existingRows ?? []) as TaskEngineExistingTask[],
    activePoolTasks: (poolRows ?? []) as TaskEnginePoolTask[],
    holidays: (holidayRows ?? []) as TaskEngineHoliday[],
    offDayRequests: (offDayRows ?? []) as TaskEngineOffDayRequest[],
  });
  if (result.created.length > 0) {
    const { error } = await admin.from("tasks").insert(result.created);
    if (error) throw new Error(error.message);
  }

  const leadSheetResult = await generateLeadSheetTasks(date);
  return { date, created: result.created.length + leadSheetResult.weeklyCreated + leadSheetResult.backlogCreated, skipped: result.skipped, leadSheets: leadSheetResult };
}
