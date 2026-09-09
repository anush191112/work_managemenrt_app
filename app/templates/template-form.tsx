"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  ["whatsapp_campaign", "WhatsApp campaigns"], ["email_campaign", "Email campaigns"],
  ["inbox_check", "Inbox check"], ["instagram_post", "Instagram post"],
  ["content_research", "Content research"], ["lead_sheet", "Lead sheet"],
  ["catalog_revamp", "Catalog revamp"], ["other", "Other"],
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function TemplateForm({ users }: { users: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError(null);
    const response = await fetch("/api/task-templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: fields.get("title"), category: fields.get("category"),
        day_of_week: Number(fields.get("day_of_week")), assigned_to: fields.get("assigned_to"),
        quantity: fields.get("quantity"), time_allotted_minutes: fields.get("time_allotted_minutes"),
        is_mandatory: fields.get("is_mandatory") === "on", requires_proof: fields.get("requires_proof") === "on",
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Could not save template");
      return;
    }
    form.reset();
    router.refresh();
  }

  return <form className="template-form" onSubmit={submit}>
    <label>Task name<input name="title" required placeholder="e.g. WhatsApp campaigns" /></label>
    <label>Category<select name="category" defaultValue="whatsapp_campaign">{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label>Day<select name="day_of_week" defaultValue="1">{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
    <label>Assigned to<select name="assigned_to" required>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
    <label>Required quantity<input name="quantity" type="number" min="0" placeholder="Optional" /></label>
    <label>Time allotted (minutes)<input name="time_allotted_minutes" type="number" min="1" placeholder="Optional" /></label>
    <label className="checkbox-label"><input name="is_mandatory" type="checkbox" defaultChecked /> Mandatory task</label>
    <label className="checkbox-label"><input name="requires_proof" type="checkbox" /> Require proof</label>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <button type="submit" className="primary-action" disabled={busy}>{busy ? "Saving" : "Add template"}</button>
  </form>;
}
