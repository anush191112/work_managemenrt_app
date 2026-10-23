import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { campaignMetrics } from "@/lib/campaigns/logic";
import { reconcileCampaignTaskItems } from "@/lib/server/lead-sheet-tasks";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  const { id } = await params;
  const admin = createAdminClient();
  const { data: campaign, error: findError } = await admin.from("campaigns").select("id, campaign_type, campaign_date, campaign_end_date, campaign_completed_on, retarget_name, retarget_start_date, retarget_due_date, retarget_completed_on, created_by, assigned_to, is_shared").eq("id", id).maybeSingle();
  if (findError || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (actor.role !== "admin" && !campaign.is_shared && campaign.assigned_to !== actor.id) {
    if (actor.role !== "manager") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const { data: owner } = await admin.from("users").select("manager_id").eq("id", campaign.assigned_to ?? campaign.created_by).single();
    if (owner?.manager_id !== actor.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (body.schedule === true) {
      if (campaign.campaign_type !== "whatsapp" || campaign.campaign_date < "2026-10-19") throw new Error("Only tool-calculated WhatsApp schedules can be edited here");
      const fields = ["campaign_end_date", "retarget_start_date", "retarget_due_date"] as const;
      if (fields.some((field) => typeof body[field] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body[field])) || typeof body.retarget_name !== "string" || !body.retarget_name.trim()) throw new Error("Enter the campaign end, retarget name, retarget start, and retarget end dates");
      if (body.campaign_end_date < campaign.campaign_date || body.retarget_start_date < body.campaign_end_date || body.retarget_due_date < body.retarget_start_date) throw new Error("Schedule dates must be in order");
      const { data, error } = await admin.from("campaigns").update({ campaign_end_date: body.campaign_end_date, retarget_name: body.retarget_name.trim(), retarget_start_date: body.retarget_start_date, retarget_due_date: body.retarget_due_date }).eq("id", id).select("id").single();
      if (error || !data) throw new Error(error?.message ?? "Could not update campaign schedule");
      return NextResponse.json({ campaign: data });
    }
    const calculatedSchedule = campaign.campaign_type === "whatsapp" && campaign.campaign_date >= "2026-10-19";
    const metrics = campaignMetrics({ ...body, campaign_type: campaign.campaign_type, campaign_date: campaign.campaign_date, retarget_name: body.retarget_name ?? campaign.retarget_name, campaign_completed_on: body.campaign_completed_on ?? campaign.campaign_completed_on, retarget_completed_on: body.retarget_completed_on ?? campaign.retarget_completed_on ?? (calculatedSchedule ? campaign.retarget_due_date : null) });
    const { data, error } = await admin.from("campaigns").update(metrics).eq("id", id).select("id, stage").single();
    if (error || !data) throw new Error(error?.message ?? "Could not update campaign");
    await reconcileCampaignTaskItems(id, data.stage === "complete");
    return NextResponse.json({ campaign: data });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not update campaign" }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Only admins can delete campaigns" }, { status: 403 });
  const { id } = await params;
  const { error } = await createAdminClient().from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.code === "23503" ? "This campaign is part of a lead sheet or backlog and cannot be deleted." : error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
