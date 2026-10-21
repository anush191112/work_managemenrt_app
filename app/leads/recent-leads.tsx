export type RecentLead = {
  id: string;
  name: string;
  phone: string;
  account: string;
  purpose: string;
  engagement_tag: string;
  touch_count: number;
  last_marked_at: string;
};

const ACCOUNT_LABELS: Record<string, string> = {
  whatsapp_9928781655: "WhatsApp 9928781655",
  whatsapp_9928501655: "WhatsApp 9928501655",
  email_stonekingexports: "Stoneking Exports email",
  email_stonekingexportindia: "Stoneking Export India email",
};

const PURPOSE_LABELS: Record<string, string> = {
  requested_for_catalog: "Requested catalog",
  casual_reply: "Casual reply",
  inquiry: "Inquiry",
  instagram_whatsapp_channel: "Instagram / WhatsApp channel",
};

function formatMarkedAt(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

export function RecentLeads({ leads }: { leads: RecentLead[] }) {
  return <section className="recent-leads" aria-labelledby="recent-leads-heading">
    <div className="section-heading"><div><p className="eyebrow">Shared lead queue</p><h2 id="recent-leads-heading">Last 5 marked leads</h2></div><p>Most recently entered or updated</p></div>
    {leads.length === 0 ? <p className="empty-state">No leads have been marked yet.</p> : <div className="table-wrap"><table className="report-table"><thead><tr><th scope="col">Phone</th><th scope="col">Name</th><th scope="col">Account</th><th scope="col">Purpose</th><th scope="col">Level</th><th scope="col">Last marked</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id}><td>{lead.phone}</td><th scope="row">{lead.name}</th><td>{ACCOUNT_LABELS[lead.account] ?? lead.account}</td><td>{PURPOSE_LABELS[lead.purpose] ?? lead.purpose}</td><td><span className="type-badge">{lead.engagement_tag} ({lead.touch_count})</span></td><td><time dateTime={lead.last_marked_at}>{formatMarkedAt(lead.last_marked_at)}</time></td></tr>)}</tbody></table></div>}
  </section>;
}
