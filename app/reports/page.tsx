import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { resolveReportPeriod } from "@/lib/reports/date-range";
import { scopedUserIds } from "@/lib/server/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import type { TaskStatus } from "@/lib/task-engine/types";

interface ReportTask { assigned_to: string; status: TaskStatus; has_blocker: boolean; }
interface Person { id: string; name: string; }

function percent(done: number, total: number): string { return total ? `${Math.round((done / total) * 100)}%` : "0%"; }
function value(input: string | string[] | undefined): string | undefined { return typeof input === "string" ? input : undefined; }

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const params = await searchParams;
  const today = currentIstDate();
  const period = resolveReportPeriod({ range: value(params.range), start: value(params.start), end: value(params.end), today });
  const accessibleIds = await scopedUserIds(actor);
  const selectedUserId = value(params.user);
  const scopedIds = selectedUserId && accessibleIds.includes(selectedUserId) ? [selectedUserId] : accessibleIds;
  const admin = createAdminClient();
  let taskQuery = admin.from("tasks").select("assigned_to, status, has_blocker").in("assigned_to", scopedIds).lte("scheduled_date", period.endDate);
  if (period.startDate) taskQuery = taskQuery.gte("scheduled_date", period.startDate);
  const [{ data: taskRows, error: tasksError }, { data: userRows, error: usersError }] = await Promise.all([
    taskQuery,
    admin.from("users").select("id, name").in("id", accessibleIds).order("name"),
  ]);
  if (tasksError) throw new Error(tasksError.message);
  if (usersError) throw new Error(usersError.message);
  const users = (userRows ?? []) as Person[];
  const tasks = (taskRows ?? []) as ReportTask[];
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const notStarted = tasks.filter((task) => task.status === "not_started").length;
  const atRisk = tasks.filter((task) => task.status === "at_risk").length;
  const blocked = tasks.filter((task) => task.has_blocker || task.status === "blocked").length;
  const rollups = new Map(users.filter((user) => scopedIds.includes(user.id)).map((user) => [user.id, { ...user, total: 0, done: 0, inProgress: 0, notStarted: 0, atRisk: 0, blocked: 0 }]));

  for (const task of tasks) {
    const row = rollups.get(task.assigned_to);
    if (!row) continue;
    row.total += 1;
    if (task.status === "done") row.done += 1;
    if (task.status === "in_progress") row.inProgress += 1;
    if (task.status === "not_started") row.notStarted += 1;
    if (task.status === "at_risk") row.atRisk += 1;
    if (task.has_blocker || task.status === "blocked") row.blocked += 1;
  }
  const people = [...rollups.values()];

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">{actor.role === "employee" ? "My performance" : "Team performance"}</p><h1>Reports</h1><p className="dashboard-date">{period.label}</p></div><Link className="back-link" href="/dashboard">Back to today</Link></header>
    <form className="filter-bar report-filters" method="get">
      <label>Time period<select name="range" defaultValue={period.range}><option value="all">All time</option><option value="week">Last 7 days</option><option value="month">Last month</option><option value="quarter">Last 3 months</option><option value="custom">Custom range</option></select></label>
      <label>From<input type="date" name="start" defaultValue={period.range === "custom" ? period.startDate ?? "" : ""} /></label>
      <label>To<input type="date" name="end" defaultValue={period.endDate} max={today} /></label>
      {users.length > 1 ? <label>Team member<select name="user" defaultValue={scopedIds.length === 1 ? scopedIds[0] : ""}><option value="">Everyone in scope</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label> : null}
      <button className="primary-action" type="submit">Apply filters</button>
    </form>
    <section className="report-summary" aria-label="Report summary">
      <div><span>Scheduled</span><strong>{total}</strong></div>
      <div><span>Completed</span><strong>{done}</strong></div>
      <div><span>Completion rate</span><strong>{percent(done, total)}</strong></div>
      <div><span>In progress</span><strong>{inProgress}</strong></div>
      <div><span>Not started</span><strong>{notStarted}</strong></div>
      <div><span>At risk</span><strong>{atRisk}</strong></div>
      <div><span>Blocked</span><strong>{blocked}</strong></div>
    </section>
    <section className="report-section"><div className="section-heading"><div><h2>{scopedIds.length === 1 ? "Person summary" : "By team member"}</h2><p>Choose a person to review their day-by-day work.</p></div></div>{people.length ? <div className="report-table-wrap"><table className="report-table report-person-table"><thead><tr><th scope="col">Team member</th><th scope="col">Scheduled</th><th scope="col">Completed</th><th scope="col">Rate</th><th scope="col">In progress</th><th scope="col">Not started</th><th scope="col">At risk</th><th scope="col">Blocked</th></tr></thead><tbody>{people.map((person) => <tr key={person.id}><th scope="row"><Link className="back-link" href={{ pathname: `/reports/${person.id}`, query: { range: period.range, ...(period.startDate ? { start: period.startDate } : {}), end: period.endDate } }}>{person.name}</Link></th><td>{person.total}</td><td>{person.done}</td><td>{percent(person.done, person.total)}</td><td>{person.inProgress}</td><td>{person.notStarted}</td><td>{person.atRisk}</td><td>{person.blocked}</td></tr>)}</tbody></table></div> : <p className="empty-state">No people are available in this report.</p>}</section>
  </main>;
}
