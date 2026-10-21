"use client";

import { useCallback, useEffect, useState } from "react";
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

  return <section className="recent-leads" aria-labelledby="recent-leads-heading">
    <div className="section-heading"><div><p className="eyebrow">Shared lead queue</p><h2 id="recent-leads-heading">Last {limit} marked leads</h2></div><p>Most recently entered or updated</p></div>
    <div className="recent-lead-controls"><label>Account<select value={account} onChange={(event) => setAccount(event.target.value)}><option value="">All accounts</option>{CAMPAIGN_ACCOUNTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Show<select value={limit} onChange={(event) => setLimit(event.target.value === "10" ? 10 : 5)}><option value="5">Last 5</option><option value="10">Last 10</option></select></label></div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {rows.length === 0 && !loading ? <p className="empty-state">No leads match this account yet.</p> : <div className="table-wrap"><table className="report-table"><thead><tr><th scope="col">Phone</th><th scope="col">Name</th><th scope="col">Account</th><th scope="col">Purpose</th><th scope="col">Level</th><th scope="col">Created at</th><th scope="col">Last marked</th></tr></thead><tbody>{rows.map((lead) => <tr key={lead.id}><td>{lead.phone}</td><th scope="row">{lead.name}</th><td>{CAMPAIGN_ACCOUNTS.find((item) => item.value === lead.account)?.label ?? lead.account}</td><td>{PURPOSE_LABELS[lead.purpose] ?? lead.purpose}</td><td><span className="type-badge">{lead.engagement_tag} ({lead.touch_count})</span></td><td><time dateTime={lead.created_at}>{formatTimestamp(lead.created_at)}</time></td><td><time dateTime={lead.last_marked_at}>{formatTimestamp(lead.last_marked_at)}</time></td></tr>)}</tbody></table></div>}
    {loading ? <p className="field-helper" role="status">Loading leads...</p> : null}
  </section>;
}
