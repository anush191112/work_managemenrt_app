import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import type { TaskStatus } from "@/lib/task-engine/types";

interface ReportTask {
  assigned_to: string;
  status: TaskStatus;
  has_blocker: boolean;
}

function sevenDaysAgo(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 6);
  return value.toISOString().slice(0, 10);
}

function percent(done: number, total: number): string {
  return total ? `${Math.round((done / total) * 100)}%` : "0%";
}

export default async function ReportsPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.role === "employee") redirect("/dashboard");

  const endDate = currentIstDate();
  const startDate = sevenDaysAgo(endDate);
  const supabase = await createClient();
  const [{ data: taskRows }, { data: users }] = await Promise.all([
    supabase.from("tasks").select("assigned_to, status, has_blocker").gte("scheduled_date", startDate).lte("scheduled_date", endDate),
    supabase.from("users").select("id, name").order("name"),
  ]);
  const tasks = (taskRows ?? []) as ReportTask[];
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "done").length;
  const atRisk = tasks.filter((task) => task.status === "at_risk").length;
  const blocked = tasks.filter((task) => task.has_blocker || task.status === "blocked").length;
  const rollups = new Map((users ?? []).map((user) => [user.id, { name: user.name, total: 0, done: 0, atRisk: 0, blocked: 0 }]));

  for (const task of tasks) {
    const row = rollups.get(task.assigned_to);
    if (!row) continue;
    row.total += 1;
    if (task.status === "done") row.done += 1;
    if (task.status === "at_risk") row.atRisk += 1;
    if (task.has_blocker || task.status === "blocked") row.blocked += 1;
  }
  const people = [...rollups.values()].filter((row) => row.total > 0);

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">Team performance</p><h1>Reports</h1><p className="dashboard-date">{startDate} to {endDate}</p></div><Link className="back-link" href="/dashboard">Back to today</Link></header>
    <section className="report-summary" aria-label="Seven day summary">
      <div><span>Scheduled</span><strong>{total}</strong></div>
      <div><span>Completed</span><strong>{done}</strong></div>
      <div><span>Completion rate</span><strong>{percent(done, total)}</strong></div>
      <div><span>At risk</span><strong>{atRisk}</strong></div>
      <div><span>Blocked</span><strong>{blocked}</strong></div>
    </section>
    <section className="report-section"><h2>By team member</h2>{people.length ? <div className="report-table-wrap"><table className="report-table"><thead><tr><th scope="col">Team member</th><th scope="col">Scheduled</th><th scope="col">Completed</th><th scope="col">Rate</th><th scope="col">At risk</th><th scope="col">Blocked</th></tr></thead><tbody>{people.map((person) => <tr key={person.name}><th scope="row">{person.name}</th><td>{person.total}</td><td>{person.done}</td><td>{percent(person.done, person.total)}</td><td>{person.atRisk}</td><td>{person.blocked}</td></tr>)}</tbody></table></div> : <p className="empty-state">No scheduled tasks in this seven-day window.</p>}</section>
  </main>;
}
