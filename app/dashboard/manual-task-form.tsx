"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const CATEGORIES = [["whatsapp_campaign", "WhatsApp campaigns"], ["email_campaign", "Email campaigns"], ["inbox_check", "Inbox check"], ["instagram_post", "Instagram post"], ["content_research", "Content research"], ["lead_sheet", "Lead sheet"], ["catalog_revamp", "Catalog revamp"], ["other", "Other"]];

export function ManualTaskForm({ users, today }: { users: Array<{ id: string; name: string }>; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setError(null);
    const response = await fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      title: fields.get("title"), category: fields.get("category"), assigned_to: fields.get("assigned_to"),
      scheduled_date: fields.get("scheduled_date"), deadline_time: fields.get("deadline_time"), priority: fields.get("priority"),
      quantity_required: fields.get("quantity_required"), time_allotted_minutes: fields.get("time_allotted_minutes"),
      requires_proof: fields.get("requires_proof") === "on",
    }) });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Could not add task"); return; }
    form.reset(); setOpen(false); router.refresh();
  }

  return <div className="manual-task">
    <button type="button" className="primary-action" onClick={() => setOpen((value) => !value)}><Plus size={16} aria-hidden="true" /> Add task</button>
    {open ? <form className="manual-task-form" onSubmit={submit}>
      <label>Task name<input name="title" required placeholder="What needs to be done?" /></label>
      <label>Assignee<select name="assigned_to">{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label>Category<select name="category" defaultValue="other">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Date<input name="scheduled_date" type="date" defaultValue={today} min={today} required /></label>
      <label>Deadline<input name="deadline_time" type="time" /></label>
      <label>Priority<select name="priority" defaultValue="medium"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="flexible">Flexible</option></select></label>
      <label>Required quantity<input name="quantity_required" type="number" min="0" placeholder="Optional" /></label>
      <label>Time allotted (min)<input name="time_allotted_minutes" type="number" min="1" placeholder="Optional" /></label>
      <label className="checkbox-label"><input name="requires_proof" type="checkbox" /> Require proof</label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="primary-action" disabled={busy}>{busy ? "Adding" : "Add task"}</button>
    </form> : null}
  </div>;
}
