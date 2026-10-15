"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

export type CampaignRow = { id: string; name: string; campaign_type: string; source: string; account: string; state: string | null; campaign_date: string; retarget_due_date: string; stage: "awaiting_completion" | "complete"; };

export function CampaignList({ campaigns, canBulkDelete }: { campaigns: CampaignRow[]; canBulkDelete: boolean }) {
  const [state, setState] = useState(""); const [status, setStatus] = useState(""); const [account, setAccount] = useState(""); const [campaignDate, setCampaignDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]); const [message, setMessage] = useState<string | null>(null); const [deleting, setDeleting] = useState(false);
  const states = [...new Set(campaigns.map((campaign) => campaign.state).filter((value): value is string => Boolean(value)))].sort();
  const accounts = [...new Set(campaigns.map((campaign) => campaign.account))].sort();
  const shown = useMemo(() => campaigns.filter((campaign) => (!state || campaign.state === state) && (!status || campaign.stage === status) && (!account || campaign.account === account) && (!campaignDate || campaign.campaign_date === campaignDate)), [account, campaignDate, campaigns, state, status]);
  const shownIds = shown.map((campaign) => campaign.id); const allShownSelected = shownIds.length > 0 && shownIds.every((id) => selected.includes(id));

  function toggleCampaign(id: string) { setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function toggleAll() { setSelected(allShownSelected ? (current) => current.filter((id) => !shownIds.includes(id)) : (current) => [...new Set([...current, ...shownIds])]); }
  async function deleteSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length || !window.confirm(`Delete ${selected.length} selected campaign${selected.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true); setMessage(null);
    const response = await fetch("/api/campaigns/bulk-delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selected }) });
    const result = await response.json(); setDeleting(false);
    if (!response.ok) { setMessage(result.error ?? "Could not delete selected campaigns"); return; }
    window.location.reload();
  }

  return <>
    <div className="filter-bar"><label>State<select value={state} onChange={(event) => setState(event.target.value)}><option value="">All states</option>{states.map((value) => <option key={value}>{value}</option>)}</select></label><label>Account<select value={account} onChange={(event) => setAccount(event.target.value)}><option value="">All accounts</option>{accounts.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="awaiting_completion">Awaiting completion</option><option value="complete">Complete</option></select></label><label>Campaign date<input type="date" value={campaignDate} onChange={(event) => setCampaignDate(event.target.value)} /></label></div>
    {canBulkDelete ? <form className="bulk-actions" onSubmit={deleteSelected}><span>{selected.length ? `${selected.length} selected` : "Select campaigns to delete"}</span><button className="danger-action" disabled={!selected.length || deleting}>{deleting ? "Deleting campaigns" : "Delete selected"}</button>{message ? <p className="error" role="alert">{message}</p> : null}</form> : null}
    <div className="table-wrap"><table className="report-table"><thead><tr>{canBulkDelete ? <th scope="col"><input type="checkbox" aria-label="Select all shown campaigns" checked={allShownSelected} onChange={toggleAll} /></th> : null}<th scope="col">Campaign</th><th scope="col">Type</th><th scope="col">State</th><th scope="col">Campaign date</th><th scope="col">Retarget due</th><th scope="col">Status</th></tr></thead><tbody>{shown.map((campaign) => <tr key={campaign.id}>{canBulkDelete ? <td><input type="checkbox" aria-label={`Select ${campaign.name}`} checked={selected.includes(campaign.id)} onChange={() => toggleCampaign(campaign.id)} /></td> : null}<th scope="row"><Link className="back-link" href={`/campaigns/${campaign.id}`} title={campaign.name}>{campaign.name}</Link></th><td><span className="type-badge">{campaign.campaign_type}</span></td><td>{campaign.state ?? "Birthday"}</td><td>{campaign.campaign_date}</td><td>{campaign.retarget_due_date}</td><td><span className={`status-pill ${campaign.stage === "complete" ? "status-done" : "status-in_progress"}`}>{campaign.stage.replace("_", " ")}</span></td></tr>)}</tbody></table></div>
  </>;
}
