"use client";

import { FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";

type CampaignScheduleProps = {
  campaignId: string;
  campaignEndDate: string | null;
  retargetName: string | null;
  retargetStartDate: string | null;
  retargetEndDate: string | null;
};

export function CampaignSchedule({ campaignId, campaignEndDate, retargetName, retargetStartDate, retargetEndDate }: CampaignScheduleProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schedule: true, ...Object.fromEntries(new FormData(event.currentTarget)) }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(result.error ?? "Could not update schedule"); return; }
    setEditing(false);
    router.refresh();
  }

  if (editing) return <form className="campaign-schedule-form" onSubmit={save}>
    <label>Campaign ends<input name="campaign_end_date" type="date" defaultValue={campaignEndDate ?? ""} required /></label>
    <label>Retarget name<input name="retarget_name" defaultValue={retargetName ?? ""} required /></label>
    <label>Retarget starts<input name="retarget_start_date" type="date" defaultValue={retargetStartDate ?? ""} required /></label>
    <label>Retarget ends<input name="retarget_due_date" type="date" defaultValue={retargetEndDate ?? ""} required /></label>
    <div className="campaign-schedule-actions"><button className="primary-action" disabled={saving}>{saving ? "Saving" : "Save schedule"}</button><button type="button" className="secondary-button" onClick={() => setEditing(false)} disabled={saving}>Cancel</button></div>
    {message ? <p className="error" role="alert">{message}</p> : null}
  </form>;

  return <section className="campaign-schedule" aria-label="Campaign schedule">
    <div className="campaign-schedule-heading"><span>Campaign schedule</span><button className="icon-button" type="button" onClick={() => setEditing(true)} aria-label="Edit campaign schedule" title="Edit campaign schedule"><Pencil size={18} aria-hidden="true" /></button></div>
    <div className="campaign-overview"><div><span>Campaign ends</span><strong>{campaignEndDate ?? "-"}</strong></div><div><span>Retarget</span><strong>{retargetName ?? "-"}</strong></div><div><span>Retarget starts</span><strong>{retargetStartDate ?? "-"}</strong></div><div><span>Retarget ends</span><strong>{retargetEndDate ?? "-"}</strong></div></div>
  </section>;
}
