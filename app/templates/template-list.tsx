"use client";

import { FormEvent, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { TaskCategory } from "@/lib/task-engine/types";

const CATEGORIES: Array<[TaskCategory, string]> = [
  ["whatsapp_campaign", "WhatsApp campaigns"], ["email_campaign", "Email campaigns"],
  ["inbox_check", "Inbox check"], ["instagram_post", "Instagram post"],
  ["content_research", "Content research"], ["lead_sheet", "Lead sheet"],
  ["catalog_revamp", "Catalog revamp"], ["other", "Other"],
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Template {
  id: string;
  title: string;
  category: TaskCategory;
  day_of_week: number;
  assigned_to: string;
  quantity: number | null;
  time_allotted_minutes: number | null;
  is_mandatory: boolean;
  requires_proof: boolean;
}

export function TemplateList({ templates, users }: { templates: Template[]; users: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const names = new Map(users.map((user) => [user.id, user.name]));

  async function save(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/task-templates/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: fields.get("title"), category: fields.get("category"),
        day_of_week: Number(fields.get("day_of_week")), assigned_to: fields.get("assigned_to"),
        quantity: fields.get("quantity"), time_allotted_minutes: fields.get("time_allotted_minutes"),
        is_mandatory: fields.get("is_mandatory") === "on", requires_proof: fields.get("requires_proof") === "on",
      }),
    });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) return setError(result.error ?? "Could not update template");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this recurring task template? Existing generated tasks will remain.")) return;
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/task-templates/${id}`, { method: "DELETE" });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) return setError(result.error ?? "Could not delete template");
    router.refresh();
  }

  if (!templates.length) return <p className="empty-state">No templates yet. Add a weekly task, then return to Today and generate tasks.</p>;

  return <div className="template-list">
    {error ? <p className="error" role="alert">{error}</p> : null}
    {templates.map((template) => <details className="template-item" key={template.id}>
      <summary className="template-summary">
        <span><strong>{template.title}</strong><small>{DAYS[template.day_of_week]} · {names.get(template.assigned_to) ?? "Team member"}</small></span>
        <span>{template.quantity ?? "No count"} · {template.is_mandatory ? "Mandatory" : "Flexible"}{template.requires_proof ? " · Proof" : ""}</span>
      </summary>
      <form className="template-edit-form" onSubmit={(event) => save(event, template.id)}>
        <label>Task name<input name="title" required defaultValue={template.title} /></label>
        <label>Category<select name="category" defaultValue={template.category}>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Day<select name="day_of_week" defaultValue={template.day_of_week}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
        <label>Assigned to<select name="assigned_to" defaultValue={template.assigned_to}>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <label>Required quantity<input name="quantity" type="number" min="0" defaultValue={template.quantity ?? ""} /></label>
        <label>Time allotted (minutes)<input name="time_allotted_minutes" type="number" min="1" defaultValue={template.time_allotted_minutes ?? ""} /></label>
        <label className="checkbox-label"><input name="is_mandatory" type="checkbox" defaultChecked={template.is_mandatory} /> Mandatory task</label>
        <label className="checkbox-label"><input name="requires_proof" type="checkbox" defaultChecked={template.requires_proof} /> Require proof</label>
        <div className="template-actions">
          <button className="primary-action" type="submit" disabled={busyId === template.id}><Pencil size={16} aria-hidden="true" />{busyId === template.id ? "Saving" : "Save changes"}</button>
          <button className="icon-button" type="button" onClick={() => remove(template.id)} disabled={busyId === template.id} title="Delete template" aria-label="Delete template"><Trash2 size={17} aria-hidden="true" /></button>
        </div>
      </form>
    </details>)}
  </div>;
}
