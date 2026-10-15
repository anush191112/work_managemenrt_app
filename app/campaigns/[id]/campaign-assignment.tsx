"use client";
import { useState } from "react";
type User = { id: string; name: string };
export function CampaignAssignment({ campaignId, assignedTo, users }: { campaignId: string; assignedTo: string | null; users: User[] }) {
  const [value, setValue] = useState(assignedTo ?? ""); const [message, setMessage] = useState<string | null>(null);
  async function save() { const response = await fetch(`/api/campaigns/${campaignId}/assignment`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ assigned_to: value }) }); const result = await response.json(); setMessage(response.ok ? "Campaign reassigned." : result.error ?? "Could not reassign campaign"); }
  return <section className="assignment-control"><label>Assigned employee<select value={value} onChange={(event) => setValue(event.target.value)}><option value="">Choose employee</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><button type="button" onClick={save} disabled={!value}>Assign</button>{message ? <p className="action-message">{message}</p> : null}</section>;
}
