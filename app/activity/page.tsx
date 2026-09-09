import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  detail: Record<string, unknown>;
  created_at: string;
}

function formatStatus(value: unknown): string {
  return typeof value === "string" ? value.replaceAll("_", " ") : "unknown";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function description(entry: AuditEntry, taskNames: Map<string, string>): string {
  const taskId = entry.entity_type === "task" ? entry.entity_id : typeof entry.detail.task_id === "string" ? entry.detail.task_id : null;
  const taskName = taskId ? taskNames.get(taskId) ?? "a task" : "a task";
  if (entry.action === "status_changed") return `changed ${taskName} from ${formatStatus(entry.detail.old_status)} to ${formatStatus(entry.detail.new_status)}`;
  if (entry.action === "proof_uploaded") return `uploaded proof for ${taskName}`;
  if (entry.action === "blocker_added") return `reported a blocker on ${taskName}`;
  return `${entry.action.replaceAll("_", " ")} on ${taskName}`;
}

export default async function ActivityPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.role === "employee") redirect("/dashboard");

  const supabase = await createClient();
  const { data: auditRows } = await supabase.from("audit_log")
    .select("id, entity_type, entity_id, action, actor_id, detail, created_at")
    .order("created_at", { ascending: false }).limit(50);
  const entries = (auditRows ?? []) as AuditEntry[];
  const taskIds = [...new Set(entries.flatMap((entry) => {
    const taskId = entry.entity_type === "task" ? entry.entity_id : entry.detail?.task_id;
    return typeof taskId === "string" ? [taskId] : [];
  }))];
  const [{ data: users }, taskResponse] = await Promise.all([
    supabase.from("users").select("id, name"),
    taskIds.length ? supabase.from("tasks").select("id, title").in("id", taskIds) : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
  ]);
  const actorNames = new Map((users ?? []).map((user) => [user.id, user.name]));
  const taskNames = new Map((taskResponse.data ?? []).map((task) => [task.id, task.title]));

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">Team history</p><h1>Activity</h1></div><Link className="back-link" href="/dashboard">Back to today</Link></header>
    {entries.length ? <section className="activity-list" aria-label="Recent activity">{entries.map((entry) => <article className="activity-item" key={entry.id}><div><strong>{actorNames.get(entry.actor_id) ?? "Team member"}</strong><span>{description(entry, taskNames)}</span></div><time dateTime={entry.created_at}>{formatTime(entry.created_at)}</time></article>)}</section> : <p className="empty-state">No activity has been recorded yet.</p>}
  </main>;
}
