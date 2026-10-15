import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { getAuthenticatedUserId, getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import { refreshDeadlineAlerts } from "@/lib/server/refresh-deadline-alerts";
import { GenerateTasksButton, TaskList, type DashboardTask } from "./task-list";
import { ManualTaskForm } from "./manual-task-form";
import { NotificationFeed } from "./notification-feed";

export default async function DashboardPage() {
  const actor = await getCurrentActor();
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  if (!actor) {
    return (
      <main className="dashboard-shell">
        <h1>Setting up your workspace</h1>
        <p className="empty-state">Your sign-in worked, but your employee profile is still being prepared. Refresh this page in a moment.</p>
      </main>
    );
  }

  await refreshDeadlineAlerts();
  const supabase = await createClient();
  const date = currentIstDate();
  const yesterday = new Date(`${date}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);
  const { data: taskRows } = await supabase
    .from("tasks")
    .select("id, title, category, assigned_to, scheduled_date, quantity_required, quantity_done, time_allotted_minutes, deadline_time, priority, status, requires_proof, has_blocker, is_pool_task, pool_target_total, carried_forward_from, task_proofs(id, file_url)")
    .or(`scheduled_date.eq.${date},and(is_pool_task.eq.true,scheduled_date.lte.${date},status.neq.done),and(category.eq.lead_sheet,title.eq."Weekly Lead Sheet",scheduled_date.eq.${yesterdayDate},status.neq.done)`)
    .order("deadline_time", { ascending: true, nullsFirst: false });
  const tasks = (taskRows ?? []) as Array<Omit<DashboardTask, "assignedToName" | "proofCount" | "proofUrls"> & { task_proofs: Array<{ id: string; file_url: string }> }>;
  const assigneeIds = [...new Set(tasks.map((task) => task.assigned_to))];
  const [{ data: userRows }, { data: notificationRows }] = await Promise.all([
    supabase.from("users").select("id, name").order("name"),
    supabase.from("notifications").select("id, type, message, is_read").eq("user_id", userId).order("created_at", { ascending: false }).limit(12),
  ]);
  const names = new Map((userRows ?? []).map((user) => [user.id, user.name]));
  const admin = createAdminClient();
  const proofUrls = new Map(await Promise.all(tasks.map(async (task) => {
    const signed = await Promise.all(task.task_proofs.map(async (proof) => {
      const { data } = await admin.storage.from("task-proofs").createSignedUrl(proof.file_url, 60 * 60);
      return data?.signedUrl ?? null;
    }));
    return [task.id, signed.filter((url): url is string => Boolean(url))] as const;
  })));
  const displayTasks: DashboardTask[] = tasks.map((task) => ({
    ...task,
    assignedToName: names.get(task.assigned_to) ?? "Team member",
    proofCount: task.task_proofs?.length ?? 0,
    proofUrls: proofUrls.get(task.id) ?? [],
  }));
  const isManagerView = actor.role === "admin" || actor.role === "manager";

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{isManagerView ? "Team overview" : "My work"}</p>
          <h1>Today</h1>
          <p className="dashboard-date">{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T00:00:00+05:30`))} <span aria-hidden="true">·</span> {date}</p>
        </div>
        <div className="header-actions">
          {isManagerView ? <GenerateTasksButton /> : null}
          {isManagerView ? <ManualTaskForm users={userRows ?? []} today={date} /> : null}
          <NotificationFeed notifications={notificationRows ?? []} />
          <form action="/auth/signout" method="post">
            <button type="submit" className="icon-button" title="Sign out"><LogOut size={17} aria-hidden="true" /><span className="sr-only">Sign out</span></button>
          </form>
        </div>
      </header>
      <section className="dashboard-summary">
        <span>{displayTasks.length} scheduled</span>
        <span>{displayTasks.filter((task) => task.status === "done").length} completed</span>
        <span>{displayTasks.filter((task) => task.has_blocker).length} blocked</span>
      </section>
      <TaskList tasks={displayTasks} isOwnDashboard={!isManagerView} canManageTasks templateHref={isManagerView ? "/templates" : undefined} />
    </main>
  );
}
