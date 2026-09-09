import { describe, expect, it } from "vitest";
import { shiftTasksForOffDay } from "@/lib/task-engine/shift-tasks-for-off-day";
import {
  DEFAULT_WORK_DAYS,
  type ShiftTasksForOffDayInput,
  type TaskEngineShiftTask,
} from "@/lib/task-engine/types";

const employee = { id: "user-1", work_days: DEFAULT_WORK_DAYS };

function task(overrides: Partial<TaskEngineShiftTask>): TaskEngineShiftTask {
  return {
    id: "task-1",
    template_id: "template-1",
    assigned_to: "user-1",
    category: "whatsapp_campaign",
    scheduled_date: "2026-09-12",
    quantity_required: 5,
    priority: "medium",
    status: "not_started",
    is_pool_task: false,
    carried_forward_from: null,
    ...overrides,
  };
}

function input(tasks: TaskEngineShiftTask[]): ShiftTasksForOffDayInput {
  return {
    user: employee,
    offDate: "2026-09-12",
    tasks,
    holidays: [],
    offDayRequests: [
      { user_id: "user-1", date: "2026-09-12", status: "approved" },
    ],
  };
}

describe("shiftTasksForOffDay", () => {
  it("moves mandatory work to the prior working day", () => {
    const result = shiftTasksForOffDay(input([task({ id: "campaign" })]));

    expect(result.moved).toEqual([
      {
        taskId: "campaign",
        scheduled_date: "2026-09-11",
        carried_forward_from: "2026-09-12",
      },
    ]);
  });

  it("moves flexible and pool work to the next working day", () => {
    const result = shiftTasksForOffDay(
      input([
        task({ id: "lead-sheet", category: "lead_sheet", priority: "flexible" }),
        task({
          id: "pool",
          template_id: null,
          category: "other",
          is_pool_task: true,
        }),
      ]),
    );

    expect(result.moved.map((change) => change.scheduled_date)).toEqual([
      "2026-09-14",
      "2026-09-14",
    ]);
  });

  it("skips holidays and approved off-days while finding a target date", () => {
    const shiftInput = input([task({ id: "campaign" })]);
    shiftInput.holidays = [{ date: "2026-09-11", applies_to: null }];

    const result = shiftTasksForOffDay(shiftInput);

    expect(result.moved[0].scheduled_date).toBe("2026-09-10");
  });

  it("merges a shifted template task into its target-date counterpart", () => {
    const result = shiftTasksForOffDay(
      input([
        task({ id: "off-day-task", quantity_required: 5 }),
        task({
          id: "friday-task",
          scheduled_date: "2026-09-11",
          quantity_required: 3,
        }),
      ]),
    );

    expect(result.merged).toEqual([
      {
        sourceTaskId: "off-day-task",
        targetTaskId: "friday-task",
        quantity_required: 8,
        carried_forward_from: "2026-09-12",
      },
    ]);
    expect(result.moved).toHaveLength(0);
  });

  it("does not shift completed tasks", () => {
    const result = shiftTasksForOffDay(input([task({ id: "done", status: "done" })]));

    expect(result.skipped).toEqual([{ taskId: "done", reason: "completed" }]);
  });
});
