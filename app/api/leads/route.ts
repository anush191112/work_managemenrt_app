import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { normalizePhone } from "@/lib/architects/normalization";
import { isCampaignAccount } from "@/lib/campaigns/types";
import { engagementTagForTouchCount } from "@/lib/leads/engagement";
import { createAdminClient } from "@/lib/supabase/admin";

const PURPOSES = ["requested_for_catalog", "casual_reply", "inquiry", "instagram_whatsapp_channel"];
export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone || typeof body.name !== "string" || !body.name.trim() || !isCampaignAccount(body.account) || !PURPOSES.includes(body.purpose)) return NextResponse.json({ error: "Name, valid phone, account, and purpose are required" }, { status: 400 });
  const admin = createAdminClient();
  const architectId = typeof body.architect_id === "string" ? body.architect_id : null;
  let architect = null;
  if (architectId) {
    const { data } = await admin.from("architects").select("id, name, phone").eq("id", architectId).eq("phone", phone).maybeSingle();
    architect = data;
  }
  const { data: existing, error: existingError } = await admin.from("leads").select("id, touch_count, engagement_tag").eq("phone", phone).maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 400 });
  const name = architect?.name ?? body.name.trim();
  if (existing) {
    const touchCount = existing.touch_count + 1;
    const tag = engagementTagForTouchCount(touchCount);
    const { error: updateError } = await admin.from("leads").update({ touch_count: touchCount, engagement_tag: tag, last_marked_at: new Date().toISOString(), last_marked_by: actor.id }).eq("id", existing.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    const { error: interactionError } = await admin.from("lead_interactions").insert({ lead_id: existing.id, reported_name: name, account: body.account, purpose: body.purpose, marked_by: actor.id });
    if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 400 });
    return NextResponse.json({ lead: { id: existing.id, touch_count: touchCount, engagement_tag: tag }, existing: true }, { status: 200 });
  }
  const { data, error } = await admin.from("leads").insert({ architect_id: architect?.id ?? null, name, phone, account: body.account, purpose: body.purpose, created_by: actor.id, last_marked_by: actor.id }).select("id, touch_count, engagement_tag").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not save lead" }, { status: 400 });
  const { error: interactionError } = await admin.from("lead_interactions").insert({ lead_id: data.id, reported_name: name, account: body.account, purpose: body.purpose, marked_by: actor.id });
  if (interactionError) return NextResponse.json({ error: interactionError.message }, { status: 400 });
  return NextResponse.json({ lead: data, existing: false }, { status: 201 });
}
