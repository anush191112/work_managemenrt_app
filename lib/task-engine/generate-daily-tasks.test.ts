import { describe, expect, it } from "vitest";
import { generateDailyTasks } from "@/lib/task-engine/generate-daily-tasks";
import {
  DEFAULT_WORK_DAYS,
  type GenerateDailyTasksInput,
  type TaskEngineTemplate,
} from "@/lib/task-engine/types";

const templates: TaskEngineTemplate[] = [
  {
    id: "tpl-wa-mon",
    title: "WhatsApp Campaigns",
    category: "whatsapp_campaign",
    day_of_week: 1,
    assigned_to: "user-1",
    quantity: 5,
    time_allotted_minutes: 120,
    is_mandatory: true,
    requires_proof: true,
    repeats_daily_until_cleared: false,
    created_by: "admin-1",
  },
  {
    id: "tpl-wa-fri-skip",
    title: "WhatsApp Campaigns",
    category: "whatsapp_campaign",
    day_of_week: 5,
    assigned_to: "user-1",
    quantity: 0,
    time_allotted_minutes: 120,
    is_mandatory: true,
    requires_proof: true,
    repeats_daily_until_cleared: false,
    created_by: "admin-1",
  },
  {
    id: "tpl-flex-thu",
    title: "Lead Sheet",
    category: "lead_sheet",
    day_of_week: 4,
    assigned_to: "user-1",
    quantity: null,
    time_allotted_minutes: null,
    is_mandatory: false,
    requires_proof: false,
    repeats_daily_until_cleared: false,
    created_by: "admin-1",
  },
  {
    id: "tpl-other-user",
    title: "Email Campaigns",
    category: "email_campaign",
    day_of_week: 1,
    assigned_to: "user-2",
    quantity: 3,
    time_allotted_minutes: 60,
    is_mandatory: true,
    requires_proof: true,
    repeats_daily_until_cleared: false,
    created_by: "admin-1",
  },
];

const baseInput: GenerateDailyTasksInput = {
  date: "2026-09-08",
  users: [
    { id: "user-1", work_days: DEFAULT_WORK_DAYS },
    { id: "user-2", work_days: DEFAULT_WORK_DAYS },
  ],
  templates,
  existingTasks: [],
  holidays: [],
  offDayRequests: [],
};

describe("generateDailyTasks", () => {
  it("creates one ongoing pool task for a quantity-based Lead Sheet template", () => {
    const result = generateDailyTasks({
      ...baseInput,
      date: "2026-09-10",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [{
        ...templates[2],
        quantity: 25,
        repeats_daily_until_cleared: true,
      }],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0]).toMatchObject({
      is_pool_task: true,
      pool_target_total: 25,
      quantity_required: 25,
      quantity_done: 0,
    });
  });

  it("keeps a quantity-based test template as a normal daily task until the option is enabled", () => {
    const testTemplate = {
      ...templates[2],
      id: "tpl-test",
      title: "test",
      quantity: 10,
      repeats_daily_until_cleared: false,
    };
    const result = generateDailyTasks({
      ...baseInput,
      date: "2026-09-10",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [testTemplate],
    });

    expect(result.created[0]).toMatchObject({
      title: "test",
      is_pool_task: false,
    });
    expect(result.created[0].pool_target_total).toBeUndefined();
  });

  it("does not create a new pool row while the existing Lead Sheet pool is incomplete", () => {
    const poolTemplate = {
      ...templates[2],
      quantity: 25,
      repeats_daily_until_cleared: true,
    };
    const result = generateDailyTasks({
      ...baseInput,
      date: "2026-09-17",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [poolTemplate],
      activePoolTasks: [{
        template_id: poolTemplate.id,
        assigned_to: "user-1",
        quantity_done: 8,
        pool_target_total: 25,
        status: "in_progress",
      }],
    });

    expect(result.created).toHaveLength(0);
    expect(result.skipped.alreadyExists).toBe(1);
  });

  it("starts the next pool cycle after the prior one is done", () => {
    const poolTemplate = {
      ...templates[2],
      quantity: 25,
      repeats_daily_until_cleared: true,
    };
    const result = generateDailyTasks({
      ...baseInput,
      date: "2026-09-17",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [poolTemplate],
      activePoolTasks: [{
        template_id: poolTemplate.id,
        assigned_to: "user-1",
        quantity_done: 25,
        pool_target_total: 25,
        status: "done",
      }],
    });

    expect(result.created).toHaveLength(1);
    expect(result.created[0].pool_target_total).toBe(25);
  });
  it("creates tasks from templates matching the IST day-of-week", () => {
    const mondayInput: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-07",
    };

    const result = generateDailyTasks(mondayInput);

    expect(result.created).toHaveLength(2);
    expect(result.created.map((task) => task.assigned_to).sort()).toEqual([
      "user-1",
      "user-2",
    ]);

    const userTask = result.created.find((task) => task.assigned_to === "user-1");
    expect(userTask).toMatchObject({
      template_id: "tpl-wa-mon",
      title: "WhatsApp Campaigns",
      scheduled_date: "2026-09-07",
      quantity_required: 5,
      quantity_done: 0,
      priority: "medium",
      status: "not_started",
      requires_proof: true,
      is_pool_task: false,
      assigned_by: "admin-1",
    });
  });

  it("skips generation on non-working days", () => {
    const sundayInput: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-13",
    };

    const result = generateDailyTasks(sundayInput);

    expect(result.created).toHaveLength(0);
    expect(result.skipped.nonWorkingDay).toBe(0);
  });

  it("counts templates that would have matched on a non-working day", () => {
    const sundayWithThursdayTemplate: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-13",
      templates: [
        {
          ...templates[2],
          day_of_week: 0,
        },
      ],
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
    };

    const result = generateDailyTasks(sundayWithThursdayTemplate);

    expect(result.created).toHaveLength(0);
    expect(result.skipped.nonWorkingDay).toBe(1);
  });

  it("skips templates with quantity zero", () => {
    const fridayInput: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-11",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [templates[1]],
    };

    const result = generateDailyTasks(fridayInput);

    expect(result.created).toHaveLength(0);
    expect(result.skipped.zeroQuantity).toBe(1);
  });

  it("is idempotent when a task already exists for template + date", () => {
    const mondayInput: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-07",
      existingTasks: [
        {
          template_id: "tpl-wa-mon",
          assigned_to: "user-1",
          scheduled_date: "2026-09-07",
        },
      ],
    };

    const result = generateDailyTasks(mondayInput);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].assigned_to).toBe("user-2");
    expect(result.skipped.alreadyExists).toBe(1);
  });

  it("assigns flexible priority to non-mandatory templates", () => {
    const thursdayInput: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-10",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [templates[2]],
    };

    const result = generateDailyTasks(thursdayInput);

    expect(result.created).toHaveLength(1);
    expect(result.created[0].priority).toBe("flexible");
  });

  it("does not generate tasks on approved off-days", () => {
    const offDayInput: GenerateDailyTasksInput = {
      ...baseInput,
      date: "2026-09-12",
      users: [{ id: "user-1", work_days: DEFAULT_WORK_DAYS }],
      templates: [
        {
          ...templates[0],
          day_of_week: 6,
        },
      ],
      offDayRequests: [
        {
          user_id: "user-1",
          date: "2026-09-12",
          status: "approved",
        },
      ],
    };

    const result = generateDailyTasks(offDayInput);

    expect(result.created).toHaveLength(0);
    expect(result.skipped.nonWorkingDay).toBe(1);
  });
});
