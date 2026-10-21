"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { CircleAlert, Image, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TaskPriority, TaskStatus } from "@/lib/task-engine/types";
import { DeleteTaskButton } from "@/app/tasks/delete-task-button";

export interface DashboardTask {
  id: string;
  title: string;
  category: string;
  assignedToName: string;
  assigned_to: string;
  scheduled_date: string;
  quantity_required: number | null;
  quantity_done: number;
  time_allotted_minutes: number | null;
  deadline_time: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  requires_proof: boolean;
  has_blocker: boolean;
  is_pool_task: boolean;
  pool_target_total: number | null;
  carried_forward_from: string | null;
  proofCount: number;
  proofUrls: string[];
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  at_risk: "At risk",
  blocked: "Blocked",
};

function formatCategory(value: string) {
  return value.replaceAll("_", " ");
}

export function GenerateTasksButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setMessage(null);
    const response = await fetch("/api/admin/generate-tasks", { method: "POST", body: "{}" });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Could not generate tasks");
      return;
    }
    setMessage(`${result.created} task${result.created === 1 ? "" : "s"} generated`);
    router.refresh();
  }

  return (
    <div className="dashboard-action">
      <button type="button" className="primary-action" onClick={generate} disabled={busy}>
        <RefreshCw size={16} aria-hidden="true" />
        {busy ? "Generating" : "Generate today"}
      </button>
      {message ? <span className="action-message">{message}</span> : null}
    </div>
  );
}

export function TaskList({ tasks, isOwnDashboard, canManageTasks, canDeleteTasks, templateHref }: { tasks: DashboardTask[]; isOwnDashboard: boolean; canManageTasks: boolean; canDeleteTasks: boolean; templateHref?: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchTask(taskId: string, body: Record<string, unknown>) {
    setBusyId(taskId);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(result.error ?? "Could not update task");
      return;
    }
    router.refresh();
  }

  async function uploadProof(taskId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusyId(taskId);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch(`/api/tasks/${taskId}/proofs`, { method: "POST", body: formData });
    const result = await response.json();
    setBusyId(null);
    event.target.value = "";
    if (!response.ok) {
      setError(result.error ?? "Could not upload proof");
      return;
    }
    router.refresh();
  }

  async function reportBlocker(taskId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = new FormData(form).get("reason");
    setBusyId(taskId);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}/blockers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(result.error ?? "Could not report blocker");
      return;
    }
    form.reset();
    router.refresh();
  }

  if (tasks.length === 0) {
    return <div className="empty-state"><p>No tasks are scheduled for today.</p>{templateHref ? <Link className="back-link" href={templateHref}>Set up recurring templates</Link> : null}</div>;
  }

  return (
    <section className="task-list" aria-label="Today's tasks">
      {error ? <p className="error" role="alert">{error}</p> : null}
      {tasks.map((task) => {
        const busy = busyId === task.id;
        return (
          <article className="task-row" key={task.id}>
            <div className="task-main">
              <div className="task-title-line">
                <h2>{task.category === "lead_sheet" && (task.title === "Weekly Lead Sheet" || task.title === "Lead Sheet Backlog") ? <Link className="back-link" href={`/lead-sheets/${task.id}`}>{task.title}</Link> : task.title}</h2>
                <span className={`status-pill status-${task.status}`}>{STATUS_LABELS[task.status]}</span>
              </div>
              <p className="task-meta">
                <span>{formatCategory(task.category)}</span>
                {!isOwnDashboard ? <span>{task.assignedToName}</span> : null}
                {task.deadline_time ? <span>Due {task.deadline_time.slice(0, 5)}</span> : null}
                {task.carried_forward_from ? <span>Moved from {task.carried_forward_from}</span> : null}
              </p>
            </div>

            <div className="task-controls">
              {task.quantity_required !== null ? (
                <label className="quantity-control">
                  <span>Progress</span>
                  <input
                    type="number"
                    min="0"
                    max={task.is_pool_task ? task.pool_target_total ?? undefined : task.quantity_required}
                    defaultValue={task.quantity_done}
                    onBlur={(event) => patchTask(task.id, { quantity_done: Number(event.target.value) })}
                    disabled={!canManageTasks || busy}
                  />
                  <span>of {task.is_pool_task ? task.pool_target_total : task.quantity_required}</span>
                </label>
              ) : null}
              {!task.is_pool_task ? <select
                aria-label={`Status for ${task.title}`}
                value={task.status}
                onChange={(event) => patchTask(task.id, { status: event.target.value })}
                disabled={!canManageTasks || busy}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select> : null}
              {isOwnDashboard ? (
                <label className="icon-button" title="Upload proof">
                  <Upload size={17} aria-hidden="true" />
                  <span className="sr-only">Upload proof</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => uploadProof(task.id, event)} disabled={busy} />
                </label>
              ) : null}
              {task.proofUrls.length ? <details className="proof-preview"><summary className="icon-button" title="View proof" aria-label="View proof"><Image size={17} aria-hidden="true" /></summary><div className="proof-panel">{task.proofUrls.map((url, index) => <a href={url} key={url} target="_blank" rel="noreferrer"><img src={url} alt={`Proof ${index + 1} for ${task.title}`} /></a>)}</div></details> : null}
              {task.requires_proof ? <span className="proof-state">Proof {task.proofCount ? "added" : "required"}</span> : null}
              {canDeleteTasks ? <DeleteTaskButton taskId={task.id} taskTitle={task.title} /> : null}
            </div>

            {task.is_pool_task ? <p className="pool-progress">Ongoing pool · {Math.max(0, (task.pool_target_total ?? 0) - task.quantity_done)} remaining</p> : null}

            {isOwnDashboard ? (
              <details className="blocker-panel">
                <summary><CircleAlert size={16} aria-hidden="true" /> Report blocker</summary>
                <form onSubmit={(event) => reportBlocker(task.id, event)}>
                  <label>
                    Reason
                    <input name="reason" required maxLength={1000} placeholder="What is preventing progress?" />
                  </label>
                  <button type="submit" disabled={busy}>Send</button>
                </form>
              </details>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
