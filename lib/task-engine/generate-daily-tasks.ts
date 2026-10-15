import { buildWorkingDayContext, getPostgresDow, isWorkingDay } from "./working-day";
import type {
  GenerateDailyTasksInput,
  GenerateDailyTasksResult,
  GeneratedTask,
  TaskEngineExistingTask,
  TaskEnginePoolTask,
  TaskEngineTemplate,
  TaskPriority,
} from "./types";

function taskKey(task: TaskEngineExistingTask): string {
  return `${task.template_id ?? "manual"}:${task.assigned_to}:${task.scheduled_date}`;
}

function buildExistingTaskKeys(tasks: TaskEngineExistingTask[]): Set<string> {
  return new Set(tasks.map(taskKey));
}

function priorityForTemplate(template: TaskEngineTemplate): TaskPriority {
  if (!template.is_mandatory) {
    return "flexible";
  }
  return "medium";
}

function shouldSkipTemplateQuantity(quantity: number | null): boolean {
  return quantity !== null && quantity <= 0;
}

function templateMatchesDate(
  template: TaskEngineTemplate,
  date: GenerateDailyTasksInput["date"],
): boolean {
  return template.day_of_week === getPostgresDow(date);
}

function toGeneratedTask(
  template: TaskEngineTemplate,
  date: GenerateDailyTasksInput["date"],
): GeneratedTask {
  return {
    template_id: template.id,
    assigned_to: template.assigned_to,
    assigned_by: template.created_by,
    title: template.title,
    category: template.category,
    scheduled_date: date,
    quantity_required: template.quantity,
    quantity_done: 0,
    time_allotted_minutes: template.time_allotted_minutes,
    priority: priorityForTemplate(template),
    status: "not_started",
    requires_proof: template.requires_proof,
    is_pool_task: template.repeats_daily_until_cleared,
    ...(template.repeats_daily_until_cleared ? { pool_target_total: template.quantity ?? undefined } : {}),
  };
}

function hasActivePoolTask(template: TaskEngineTemplate, tasks: TaskEnginePoolTask[]): boolean {
  return tasks.some((task) =>
    task.template_id === template.id
    && task.assigned_to === template.assigned_to
    && task.status !== "done"
    && task.pool_target_total !== null
    && task.quantity_done < task.pool_target_total,
  );
}

/**
 * Generate task rows for a single IST calendar date from weekly templates.
 * Idempotent: skips rows that already exist for (template_id, assignee, date).
 */
export function generateDailyTasks(
  input: GenerateDailyTasksInput,
): GenerateDailyTasksResult {
  const {
    date,
    users,
    templates,
    existingTasks,
    activePoolTasks = [],
    holidays,
    offDayRequests,
  } = input;

  const existingKeys = buildExistingTaskKeys(existingTasks);
  const created: GeneratedTask[] = [];
  const skipped = {
    nonWorkingDay: 0,
    zeroQuantity: 0,
    alreadyExists: 0,
  };

  for (const user of users) {
    const context = buildWorkingDayContext(
      user,
      date,
      holidays,
      offDayRequests,
    );

    if (!isWorkingDay(context)) {
      skipped.nonWorkingDay += templates.filter(
        (template) =>
          template.assigned_to === user.id && templateMatchesDate(template, date),
      ).length;
      continue;
    }

    const userTemplates = templates.filter(
      (template) =>
        template.assigned_to === user.id && templateMatchesDate(template, date),
    );

    for (const template of userTemplates) {
      if (shouldSkipTemplateQuantity(template.quantity)) {
        skipped.zeroQuantity += 1;
        continue;
      }

      if (template.repeats_daily_until_cleared && hasActivePoolTask(template, activePoolTasks)) {
        skipped.alreadyExists += 1;
        continue;
      }

      const key = taskKey({
        template_id: template.id,
        assigned_to: template.assigned_to,
        scheduled_date: date,
      });

      if (existingKeys.has(key)) {
        skipped.alreadyExists += 1;
        continue;
      }

      const generated = toGeneratedTask(template, date);
      created.push(generated);
      existingKeys.add(key);
    }
  }

  return { date, created, skipped };
}
