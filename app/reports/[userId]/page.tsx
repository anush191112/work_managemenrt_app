import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { resolveReportPeriod } from "@/lib/reports/date-range";
import { scopedUserIds } from "@/lib/server/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import type { TaskStatus } from "@/lib/task-engine/types";
import { DeleteTaskButton } from "@/app/tasks/delete-task-button";

interface DetailTask { id: string; title: string; scheduled_date: string; status: TaskStatus; has_blocker: boolean; quantity_required: number | null; quantity_done: number; }
const STATUS_LABELS: Record<TaskStatus, string> = { not_started: "Not started", in_progress: "In progress", done: "Completed", at_risk: "At risk", blocked: "Blocked" };
function value(input: string | string[] | undefined): string | undefined { return typeof input === "string" ? input : undefined; }

export default async function PersonReportPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const { userId } = await params;
  const query = await searchParams;
  const today = currentIstDate();
  const period = resolveReportPeriod({ range: value(query.range), start: value(query.start), end: value(query.end), today });
  const accessibleIds = await scopedUserIds(actor);
  if (!accessibleIds.includes(userId)) notFound();
  const admin = createAdminClient();
  let tasksQuery = admin.from("tasks").select("id, title, scheduled_date, status, has_blocker, quantity_required, quantity_done").eq("assigned_to", userId).lte("scheduled_date", period.endDate).order("scheduled_date", { ascending: false });
  if (period.startDate) tasksQuery = tasksQuery.gte("scheduled_date", period.startDate);
  const [{ data: person, error: personError }, { data: taskRows, error: tasksError }] = await Promise.all([
    admin.from("users").select("id, name").eq("id", userId).single(),
    tasksQuery,
  ]);
  if (personError || !person) notFound();
  if (tasksError) throw new Error(tasksError.message);
  const tasks = (taskRows ?? []) as DetailTask[];

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">Individual performance</p><h1>{person.name}</h1><p className="dashboard-date">{period.label}</p></div><Link className="back-link" href={{ pathname: "/reports", query: { range: period.range, ...(period.startDate ? { start: period.startDate } : {}), end: period.endDate } }}>Back to reports</Link></header>
    <form className="filter-bar report-filters" method="get">
      <label>Time period<select name="range" defaultValue={period.range}><option value="all">All time</option><option value="week">Last 7 days</option><option value="month">Last month</option><option value="quarter">Last 3 months</option><option value="custom">Custom range</option></select></label>
      <label>From<input type="date" name="start" defaultValue={period.range === "custom" ? period.startDate ?? "" : ""} /></label>
      <label>To<input type="date" name="end" defaultValue={period.endDate} max={today} /></label>
      <button className="primary-action" type="submit">Apply filters</button>
    </form>
    <section className="report-section"><div className="section-heading"><div><h2>Day-by-day tasks</h2><p>Tasks scheduled in the selected period.</p></div></div>{tasks.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Date</th><th scope="col">Task</th><th scope="col">Status</th><th scope="col">Progress</th><th scope="col">Blocker</th>{actor.role === "admin" ? <th scope="col"><span className="sr-only">Actions</span></th> : null}</tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td>{task.scheduled_date}</td><th scope="row">{task.title}</th><td><span className={`status-pill status-${task.status}`}>{STATUS_LABELS[task.status]}</span></td><td>{task.quantity_required === null ? "-" : `${task.quantity_done} of ${task.quantity_required}`}</td><td>{task.has_blocker || task.status === "blocked" ? "Yes" : "No"}</td>{actor.role === "admin" ? <td><DeleteTaskButton taskId={task.id} taskTitle={task.title} /></td> : null}</tr>)}</tbody></table></div> : <p className="empty-state">No tasks were scheduled for this period.</p>}</section>
  </main>;
}
