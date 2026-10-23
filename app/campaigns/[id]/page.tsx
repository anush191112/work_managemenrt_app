import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { CampaignAssignment } from "./campaign-assignment";
import { CampaignMetricsForm } from "./campaign-metrics-form";
import { DeleteCampaign } from "./delete-campaign";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const { id } = await params;
  const admin = createAdminClient();
  const { data: campaign } = await admin.from("campaigns")
    .select("id, name, campaign_type, source, account, state, serial_start, serial_end, campaign_date, campaign_end_date, campaign_completed_on, retarget_name, retarget_start_date, retarget_due_date, retarget_completed_on, stage, total_attempted, total_delivered_first, retarget_attempted, retarget_delivered, total_delivered_final, total_failed, total_replies, total_instagram_clicks, total_whatsapp_channel_clicks, total_catalog_requests, total_inquiries, total_leads, percentage, created_by, assigned_to, is_shared")
    .eq("id", id).maybeSingle();
  if (!campaign) notFound();
  if (actor.role !== "admin" && !campaign.is_shared && campaign.assigned_to !== actor.id) {
    const { data: owner } = await admin.from("users").select("manager_id").eq("id", campaign.assigned_to ?? campaign.created_by).single();
    if (actor.role !== "manager" || owner?.manager_id !== actor.id) notFound();
  }
  const { data: users } = actor.role === "admin" ? await admin.from("users").select("id, name").order("name") : { data: [] };
  const overview = campaign.campaign_type === "email" ? <><div><span>Campaign date</span><strong>{campaign.campaign_date}</strong></div><div><span>Total delivered</span><strong>{campaign.total_delivered_final ?? "-"}</strong></div><div><span>Total bounces</span><strong>{campaign.total_failed ?? "-"}</strong></div><div><span>Leads</span><strong>{campaign.total_leads ?? "-"}</strong></div></> : <><div><span>Campaign ends</span><strong>{campaign.campaign_end_date ?? "-"}</strong></div><div><span>Retarget</span><strong>{campaign.retarget_name ?? "-"}</strong></div><div><span>Retarget starts</span><strong>{campaign.retarget_start_date ?? "-"}</strong></div><div><span>Retarget ends</span><strong>{campaign.retarget_due_date ?? "-"}</strong></div><div><span>Leads</span><strong>{campaign.total_leads ?? "-"}</strong></div><div><span>Delivery</span><strong>{campaign.percentage ?? "-"}{campaign.percentage === null ? "" : "%"}</strong></div></>;
  return <main><header className="page-header"><div><p className="eyebrow">{campaign.is_shared ? "Shared historical backlog" : campaign.source}</p><h1>{campaign.name}</h1><p className="dashboard-date">{campaign.campaign_type} · {campaign.account} · Campaign date {campaign.campaign_date}</p></div><Link className="back-link" href="/campaigns">Back to campaigns</Link></header><section className="campaign-overview">{overview}</section>{actor.role === "admin" && !campaign.is_shared ? <CampaignAssignment campaignId={campaign.id} assignedTo={campaign.assigned_to} users={users ?? []} /> : null}<CampaignMetricsForm campaign={campaign} />{actor.role === "admin" ? <DeleteCampaign campaignId={campaign.id} /> : null}</main>;
}
