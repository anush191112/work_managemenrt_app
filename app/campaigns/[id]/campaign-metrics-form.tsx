"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Campaign = { id: string; campaign_type: "whatsapp" | "email"; retarget_name: string | null; total_attempted: number | null; total_delivered_first: number | null; campaign_completed_on: string | null; retarget_completed_on: string | null; retarget_attempted: number | null; retarget_delivered: number | null; total_delivered_final: number | null; total_failed: number | null; total_replies: number | null; total_instagram_clicks: number | null; total_whatsapp_channel_clicks: number | null; total_catalog_requests: number | null; total_inquiries: number | null; total_leads: number | null; };

const INPUT_METRICS = [["total_attempted", "Total attempted"], ["total_delivered_first", "First delivery"], ["retarget_attempted", "Retarget attempted"], ["retarget_delivered", "Retarget delivered"], ["total_replies", "Replies"], ["total_instagram_clicks", "Instagram clicks"], ["total_whatsapp_channel_clicks", "WhatsApp channel clicks"], ["total_catalog_requests", "Catalog requests"], ["total_inquiries", "Inquiries"]] as const;
const EMAIL_METRICS = [["total_attempted", "Total attempted"], ["total_delivered_final", "Total delivered"], ["total_failed", "Total bounces"], ["total_leads", "Total leads"]] as const;
type InputMetric = (typeof INPUT_METRICS)[number][0];
type EmailMetric = (typeof EMAIL_METRICS)[number][0];

function numericValue(value: string): number { return value === "" ? 0 : Number(value); }

export function CampaignMetricsForm({ campaign, calculatedSchedule }: { campaign: Campaign; calculatedSchedule: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Record<InputMetric, string>>(() => Object.fromEntries(INPUT_METRICS.map(([name]) => [name, campaign[name]?.toString() ?? ""])) as Record<InputMetric, string>);
  const firstDelivery = metrics.total_delivered_first;
  const retargetDelivery = metrics.retarget_delivered;
  const totalDelivered = firstDelivery === "" && retargetDelivery === "" ? "" : String(numericValue(firstDelivery) + numericValue(retargetDelivery));
  const totalFailed = metrics.total_attempted === "" || totalDelivered === "" ? "" : String(numericValue(metrics.total_attempted) - numericValue(totalDelivered));

  const [emailMetrics, setEmailMetrics] = useState<Record<EmailMetric, string>>(() => Object.fromEntries(EMAIL_METRICS.map(([name]) => [name, campaign[name]?.toString() ?? ""])) as Record<EmailMetric, string>);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const response = await fetch(`/api/campaigns/${campaign.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(fields)) });
    const result = await response.json();
    setMessage(response.ok ? `Campaign ${result.campaign.stage === "complete" ? "complete" : "saved"}.` : result.error ?? "Could not save campaign");
    if (response.ok) router.refresh();
  }

  if (campaign.campaign_type === "email") return <form onSubmit={submit} className="metrics-form">
    {EMAIL_METRICS.map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="0" step="1" value={emailMetrics[name]} readOnly={name === "total_attempted"} onChange={(event) => setEmailMetrics((current) => ({ ...current, [name]: event.target.value }))} />{name === "total_attempted" ? <span className="field-helper">Set when the campaign is created.</span> : null}</label>)}
    <button className="primary-action">Save metrics</button>{message ? <p className="action-message" role="status">{message}</p> : null}
  </form>;

  return <form onSubmit={submit} className="metrics-form">
    {!calculatedSchedule ? <><label>Interakt retarget campaign name<input name="retarget_name" defaultValue={campaign.retarget_name ?? ""} /></label><label>Campaign completed on<input name="campaign_completed_on" type="date" defaultValue={campaign.campaign_completed_on ?? ""} /></label><label>Retarget completed on<input name="retarget_completed_on" type="date" defaultValue={campaign.retarget_completed_on ?? ""} /></label></> : null}
    {INPUT_METRICS.map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="0" step="1" value={metrics[name]} readOnly={name === "total_attempted"} onChange={(event) => setMetrics((current) => ({ ...current, [name]: event.target.value }))} />{name === "total_attempted" ? <span className="field-helper">Set when the campaign is created.</span> : null}</label>)}
    <label>Total delivered<input name="total_delivered_final" type="number" value={totalDelivered} readOnly aria-describedby="total-delivered-help" /></label>
    <p id="total-delivered-help" className="field-helper">First delivery + retarget delivered</p>
    <label>Total failed<input name="total_failed" type="number" value={totalFailed} readOnly aria-describedby="total-failed-help" /></label>
    <p id="total-failed-help" className="field-helper">Total attempted - total delivered</p>
    <button className="primary-action">Save metrics</button>{message ? <p className="action-message" role="status">{message}</p> : null}
  </form>;
}
