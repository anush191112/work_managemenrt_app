"use client";
import Link from "next/link";
import { useMemo, useState } from "react";

export type CampaignRow = { id: string; name: string; campaign_type: string; source: string; account: string; state: string | null; campaign_date: string; retarget_due_date: string; stage: "awaiting_completion" | "complete"; };
export function CampaignList({ campaigns }: { campaigns: CampaignRow[] }) {
  const [state, setState] = useState(""); const [status, setStatus] = useState(""); const [account, setAccount] = useState("");
  const states = [...new Set(campaigns.map((campaign) => campaign.state).filter((value): value is string => Boolean(value)))].sort();
  const accounts = [...new Set(campaigns.map((campaign) => campaign.account))].sort();
  const shown = useMemo(() => campaigns.filter((campaign) => (!state || campaign.state === state) && (!status || campaign.stage === status) && (!account || campaign.account === account)), [account, campaigns, state, status]);
  return <><div className="filter-bar"><label>State<select value={state} onChange={(event) => setState(event.target.value)}><option value="">All states</option>{states.map((value) => <option key={value}>{value}</option>)}</select></label><label>Account<select value={account} onChange={(event) => setAccount(event.target.value)}><option value="">All accounts</option>{accounts.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="awaiting_completion">Awaiting completion</option><option value="complete">Complete</option></select></label></div><div className="table-wrap"><table className="report-table"><thead><tr><th>Campaign</th><th>Type</th><th>State</th><th>Campaign date</th><th>Retarget due</th><th>Status</th></tr></thead><tbody>{shown.map((campaign) => <tr key={campaign.id}><th><Link className="back-link" href={`/campaigns/${campaign.id}`}>{campaign.name}</Link></th><td>{campaign.campaign_type}</td><td>{campaign.state ?? "Birthday"}</td><td>{campaign.campaign_date}</td><td>{campaign.retarget_due_date}</td><td>{campaign.stage.replace("_", " ")}</td></tr>)}</tbody></table></div></>;
}
