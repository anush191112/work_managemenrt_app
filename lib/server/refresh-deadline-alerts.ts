import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyDeadlineAlert, currentIstMinutes, type DeadlineAlertType } from "@/lib/task-engine/deadline-alerts";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import type { TaskStatus } from "@/lib/task-engine/types";

interface DeadlineTask {
  id: string;
  title: string;
  assigned_to: string;
  deadline_time: string;
  status: TaskStatus;
}

export async function refreshDeadlineAlerts() {
  const admin = createAdminClient();
  const date = currentIstDate();
  const nowMinutes = currentIstMinutes();
  const { data, error } = await admin.from("tasks")
    .select("id, title, assigned_to, deadline_time, status")
    .eq("scheduled_date", date)
    .not("deadline_time", "is", null)
    .neq("status", "done");
  if (error || !data?.length) return;

  const alerts = (data as DeadlineTask[]).flatMap((task) => {
    const type = classifyDeadlineAlert(task.deadline_time, nowMinutes);
    return type ? [{ task, type }] : [];
  });
  if (!alerts.length) return;

  const taskIds = alerts.map(({ task }) => task.id);
  const [{ data: users }, { data: existing }] = await Promise.all([
    admin.from("users").select("id, role, manager_id"),
    admin.from("notifications").select("user_id, related_task_id, type").in("related_task_id", taskIds).in("type", ["deadline_approaching", "deadline_missed"]),
  ]);
  const userRows = users ?? [];
  const managers = new Map(userRows.map((user) => [user.id, user.manager_id]));
  const adminIds = userRows.filter((user) => user.role === "admin").map((user) => user.id);
  const existingKeys = new Set((existing ?? []).map((notification) => `${notification.user_id}:${notification.related_task_id}:${notification.type}`));
  const notifications: Array<{ user_id: string; type: DeadlineAlertType; related_task_id: string; message: string }> = [];

  for (const { task, type } of alerts) {
    if (task.status === "not_started" || task.status === "in_progress") {
      await admin.from("tasks").update({ status: "at_risk" }).eq("id", task.id);
    }
    const recipients = new Set([task.assigned_to, managers.get(task.assigned_to), ...adminIds].filter((id): id is string => Boolean(id)));
    const message = type === "deadline_missed"
      ? `Deadline missed for task "${task.title}".`
      : `Deadline approaching for task "${task.title}".`;
    for (const userId of recipients) {
      const key = `${userId}:${task.id}:${type}`;
      if (!existingKeys.has(key)) notifications.push({ user_id: userId, type, related_task_id: task.id, message });
    }
  }
  if (notifications.length) await admin.from("notifications").insert(notifications);
}
