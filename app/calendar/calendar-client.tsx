"use client";

import { FormEvent, useState } from "react";
import { Check, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";

export interface OffDayItem {
  id: string;
  user_id: string;
  date: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  name: string;
}

export function OffDayRequestForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setError(null);
    const response = await fetch("/api/off-day-requests", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: fields.get("date"), reason: fields.get("reason") }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Could not submit request"); return; }
    form.reset(); router.refresh();
  }

  return <form className="offday-form" onSubmit={submit}>
    <label>Date<input name="date" type="date" required /></label>
    <label>Reason<input name="reason" maxLength={1000} placeholder="Optional" /></label>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <button className="primary-action" disabled={busy}>{busy ? "Submitting" : "Request off-day"}</button>
  </form>;
}

export function HolidayForm({ users, canCreateCompanyHoliday }: { users: Array<{ id: string; name: string }>; canCreateCompanyHoliday: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setError(null);
    const response = await fetch("/api/holidays", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: fields.get("date"), label: fields.get("label"), user_id: fields.get("user_id") || null }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Could not create holiday"); return; }
    form.reset(); router.refresh();
  }

  return <form className="holiday-form" onSubmit={submit}>
    <label>Holiday name<input name="label" required maxLength={120} placeholder="e.g. Diwali" /></label>
    <label>Date<input name="date" type="date" required /></label>
    <label>Applies to<select name="user_id" defaultValue="">{canCreateCompanyHoliday ? <option value="">Everyone</option> : null}{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
    {error ? <p className="error" role="alert">{error}</p> : null}
    <button className="primary-action" disabled={busy}>{busy ? "Saving" : "Add holiday"}</button>
  </form>;
}

export function HolidayDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Remove this holiday? Tasks already shifted for it will remain where they are.")) return;
    setBusy(true); setError(null);
    const response = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "Could not remove holiday"); return; }
    router.refresh();
  }

  return <span className="holiday-delete"><button className="icon-button" type="button" title="Remove holiday" aria-label="Remove holiday" onClick={remove} disabled={busy}><Trash2 size={17} aria-hidden="true" /></button>{error ? <span className="error" role="alert">{error}</span> : null}</span>;
}

export function OffDayRequests({ items, canApprove, currentUserId }: { items: OffDayItem[]; canApprove: boolean; currentUserId: string }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(id: string) {
    setBusyId(id); setError(null);
    const response = await fetch(`/api/off-day-requests/${id}/approve`, { method: "POST" });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) { setError(result.error ?? "Could not approve request"); return; }
    router.refresh();
  }

  async function reject(id: string) {
    setBusyId(id); setError(null);
    const response = await fetch(`/api/off-day-requests/${id}/reject`, { method: "POST" });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) { setError(result.error ?? "Could not reject request"); return; }
    router.refresh();
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this pending off-day request?")) return;
    setBusyId(id); setError(null);
    const response = await fetch(`/api/off-day-requests/${id}`, { method: "DELETE" });
    const result = await response.json();
    setBusyId(null);
    if (!response.ok) { setError(result.error ?? "Could not cancel request"); return; }
    router.refresh();
  }

  if (items.length === 0) return <p className="empty-state">No off-day requests in your current scope.</p>;
  return <div className="request-list">
    {error ? <p className="error" role="alert">{error}</p> : null}
    {items.map((item) => <article className="request-item" key={item.id}>
      <div><strong>{item.date}</strong><span>{item.name}{item.reason ? ` · ${item.reason}` : ""}</span></div>
      <div className="request-status"><span className={`request-badge ${item.status}`}>{item.status}</span>{canApprove && item.status === "pending" ? <><button className="icon-button" title="Approve off-day" onClick={() => approve(item.id)} disabled={busyId === item.id}><Check size={17} aria-hidden="true" /><span className="sr-only">Approve off-day</span></button><button className="icon-button" title="Reject off-day" onClick={() => reject(item.id)} disabled={busyId === item.id}><X size={17} aria-hidden="true" /><span className="sr-only">Reject off-day</span></button></> : null}{item.user_id === currentUserId && item.status === "pending" ? <button className="icon-button" title="Cancel off-day request" onClick={() => cancel(item.id)} disabled={busyId === item.id}><X size={17} aria-hidden="true" /><span className="sr-only">Cancel off-day request</span></button> : null}</div>
    </article>)}
  </div>;
}
