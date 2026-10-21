"use client";

import { useCallback, useEffect, useState } from "react";
import { Minus, Trash2 } from "lucide-react";
import { CAMPAIGN_ACCOUNTS } from "@/lib/campaigns/logic";

export type RecentLead = {
  id: string;
  name: string;
  phone: string;
  account: string;
  purpose: string;
  engagement_tag: string;
  touch_count: number;
  created_at: string;
  last_marked_at: string;
};

const PURPOSE_LABELS: Record<string, string> = {
  requested_for_catalog: "Requested catalog",
  casual_reply: "Casual reply",
  inquiry: "Inquiry",
  instagram_whatsapp_channel: "Instagram / WhatsApp channel",
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function RecentLeads({ leads }: { leads: RecentLead[] }) {
  const [account, setAccount] = useState("");
  const [limit, setLimit] = useState<5 | 10>(5);
  const [rows, setRows] = useState(leads);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const loadLeads = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ limit: String(limit) });
    if (account) params.set("account", account);
    const response = await fetch(`/api/leads?${params}`);
    const result = await response.json();
    setLoading(false);
    if (!response.ok) { setError(result.error ?? "Could not load leads"); return; }
    setRows(result.leads ?? []);
  }, [account, limit]);

  useEffect(() => { void loadLeads(); }, [loadLeads]);
  useEffect(() => {
    const refresh = () => { void loadLeads(); };
    window.addEventListener("lead-saved", refresh);
    return () => window.removeEventListener("lead-saved", refresh);
  }, [loadLeads]);

  async function correctLead(lead: RecentLead, action: "decrement" | "delete") {
    const deletion = action === "delete";
    const confirmation = deletion
      ? `Delete ${lead.name}'s lead record and all ${lead.touch_count} mark${lead.touch_count === 1 ? "" : "s"}? This cannot be undone.`
      : `Remove the latest mark for ${lead.name}? The count will decrease from ${lead.touch_count} to ${lead.touch_count - 1}.`;
    if (!window.confirm(confirmation)) return;

    setBusyAction(`${lead.id}:${action}`); setError(null);
    const response = await fetch(`/api/leads/${lead.id}`, {
      method: deletion ? "DELETE" : "PATCH",
      ...(deletion ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }),
    });
    const result = await response.json();
    setBusyAction(null);
    if (!response.ok) { setError(result.error ?? "Could not update lead"); return; }
    await loadLeads();
  }

  return <section className="recent-leads" aria-labelledby="recent-leads-heading">
    <div className="section-heading"><div><p className="eyebrow">Shared lead queue</p><h2 id="recent-leads-heading">Last {limit} marked leads</h2></div><p>Most recently entered or updated</p></div>
    <div className="recent-lead-controls"><label>Account<select value={account} onChange={(event) => setAccount(event.target.value)}><option value="">All accounts</option>{CAMPAIGN_ACCOUNTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Show<select value={limit} onChange={(event) => setLimit(event.target.value === "10" ? 10 : 5)}><option value="5">Last 5</option><option value="10">Last 10</option></select></label></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {rows.length === 0 && !loading ? <p className="empty-state">No leads match this account yet.</p> : <div className="table-wrap"><table className="report-table recent-leads-table"><thead><tr><th scope="col">Phone</th><th scope="col">Name</th><th scope="col">Account</th><th scope="col">Purpose</th><th scope="col">Level</th><th scope="col">Created at</th><th scope="col">Last marked</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((lead) => <tr key={lead.id}><td>{lead.phone}</td><th scope="row">{lead.name}</th><td>{CAMPAIGN_ACCOUNTS.find((item) => item.value === lead.account)?.label ?? lead.account}</td><td>{PURPOSE_LABELS[lead.purpose] ?? lead.purpose}</td><td><span className="type-badge">{lead.engagement_tag} ({lead.touch_count})</span></td><td><time dateTime={lead.created_at}>{formatTimestamp(lead.created_at)}</time></td><td><time dateTime={lead.last_marked_at}>{formatTimestamp(lead.last_marked_at)}</time></td><td><div className="lead-actions"><button type="button" className="icon-button" title="Remove latest mark" aria-label={`Remove latest mark for ${lead.name}`} onClick={() => correctLead(lead, "decrement")} disabled={lead.touch_count <= 1 || busyAction !== null}><Minus size={18} aria-hidden="true" /></button><button type="button" className="icon-button lead-delete" title="Delete lead" aria-label={`Delete ${lead.name}'s lead record`} onClick={() => correctLead(lead, "delete")} disabled={busyAction !== null}><Trash2 size={17} aria-hidden="true" /></button></div></td></tr>)}</tbody></table></div>}
    {loading ? <p className="field-helper" role="status">Loading leads...</p> : null}
  </section>;
}
