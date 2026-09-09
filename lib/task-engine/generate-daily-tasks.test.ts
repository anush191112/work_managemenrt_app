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
