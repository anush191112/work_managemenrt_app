import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { engagementTagForTouchCount } from "@/lib/leads/engagement";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "decrement") return NextResponse.json({ error: "Unsupported lead action" }, { status: 400 });

  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin
    .from("leads")
    .select("id, touch_count, created_at")
    .eq("id", id)
    .maybeSingle();
  if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "Lead not found" }, { status: 404 });
  if (lead.touch_count <= 1) return NextResponse.json({ error: "A lead with one mark cannot be decreased. Delete it instead if it was added by mistake." }, { status: 400 });

  const { data: latestInteraction, error: latestError } = await admin
    .from("lead_interactions")
    .select("id")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError || !latestInteraction) return NextResponse.json({ error: latestError?.message ?? "Could not find the latest lead mark" }, { status: 400 });

  const { error: interactionError } = await admin.from("lead_interactions").delete().eq("id", latestInteraction.id);
  if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 400 });

  const { data: priorInteraction, error: priorError } = await admin
    .from("lead_interactions")
    .select("account, purpose, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorError) return NextResponse.json({ error: priorError.message }, { status: 400 });

  const touchCount = lead.touch_count - 1;
  const { error: updateError } = await admin.from("leads").update({
    touch_count: touchCount,
    engagement_tag: engagementTagForTouchCount(touchCount),
    ...(priorInteraction ? {
      account: priorInteraction.account,
      purpose: priorInteraction.purpose,
      last_marked_at: priorInteraction.created_at,
    } : { last_marked_at: lead.created_at }),
  }).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

  return NextResponse.json({ lead: { id, touch_count: touchCount } });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });

  const { id } = await params;
  const { error } = await createAdminClient().from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
