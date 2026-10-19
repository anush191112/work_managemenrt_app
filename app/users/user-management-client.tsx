"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/task-engine/types";

export interface ManagedUser { id: string; name: string; email: string; role: UserRole; manager_id: string | null; work_days: number[]; }
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CreateUserForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    setBusy(true); setError(null); setMessage(null);
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: fields.get("name"), email: fields.get("email"), password: fields.get("password") }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setError(result.error ?? "Could not create user"); return; }
    setMessage(result.restored ? "The existing sign-in was restored and is ready to use." : "User created successfully.");
    form.reset(); router.refresh();
  }
  return <form className="create-user-form" onSubmit={submit}>
    <label>Name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Temporary password<input name="password" type="password" minLength={8} required /></label>
    {error ? <p className="error" role="alert">{error}</p> : null}{message ? <p className="success-message" role="status">{message}</p> : null}<button className="primary-action" disabled={busy}>{busy ? "Creating" : "Create user"}</button>
  </form>;
}

export function UserList({ users }: { users: ManagedUser[] }) {
  const router = useRouter(); const [error, setError] = useState<string | null>(null); const [busyId, setBusyId] = useState<string | null>(null);
  async function update(id: string, body: Record<string, unknown>) {
    setBusyId(id); setError(null); const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); setBusyId(null);
    if (!response.ok) { setError(result.error ?? "Could not update user"); return; } router.refresh();
  }
  return <div className="user-list">{error ? <p className="error" role="alert">{error}</p> : null}{users.map((user) => <article className="user-row" key={user.id}>
    <div><strong>{user.name}</strong><span>{user.email}</span></div>
    <label>Role<select value={user.role} disabled={busyId === user.id} onChange={(event) => update(user.id, { role: event.target.value })}><option value="admin">Admin</option><option value="manager">Manager</option><option value="employee">Employee</option></select></label>
    <label>Manager<select value={user.manager_id ?? ""} disabled={busyId === user.id} onChange={(event) => update(user.id, { manager_id: event.target.value || null })}><option value="">None</option>{users.filter((candidate) => candidate.id !== user.id && candidate.role === "manager").map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></label>
    <label>Work days<div className="workdays">{DAYS.map((day, index) => <label key={day}><input type="checkbox" defaultChecked={user.work_days.includes(index)} onChange={(event) => { const days = new Set(user.work_days); event.target.checked ? days.add(index) : days.delete(index); if (days.size) update(user.id, { work_days: [...days].sort() }); }} disabled={busyId === user.id} />{day}</label>)}</div></label>
  </article>)}</div>;
}
