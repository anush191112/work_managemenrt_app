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
  const { data: campaign, error: findError } = await admin.from("campaigns").select("id, created_by, assigned_to, is_shared").eq("id", id).maybeSingle();
  if (findError || !campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (actor.role !== "admin" && !campaign.is_shared && campaign.assigned_to !== actor.id) {
    if (actor.role !== "manager") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const { data: owner } = await admin.from("users").select("manager_id").eq("id", campaign.assigned_to ?? campaign.created_by).single();
    if (owner?.manager_id !== actor.id) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  try {
    const metrics = campaignMetrics(await request.json());
    const { data, error } = await admin.from("campaigns").update(metrics).eq("id", id).select("id, stage").single();
    if (error || !data) throw new Error(error?.message ?? "Could not update campaign");
    await reconcileCampaignTaskItems(id, data.stage === "complete");
    return NextResponse.json({ campaign: data });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not update campaign" }, { status: 400 }); }
}
