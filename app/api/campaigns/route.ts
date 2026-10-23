import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { AUTOMATED_WHATSAPP_SCHEDULE_START, whatsappCampaignSchedule } from "@/lib/campaigns/logic";
import { accountMatchesType, isCampaignAccount, type CampaignType } from "@/lib/campaigns/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const campaignType = body.campaign_type as CampaignType;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const source = body.source === "birthday" ? "birthday" : "state_wise";
  const account = body.account;
  const campaignDate = typeof body.campaign_date === "string" ? body.campaign_date : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const serialStart = Number(body.serial_start); const serialEnd = Number(body.serial_end);
  if (!name || (campaignType !== "whatsapp" && campaignType !== "email") || !isCampaignAccount(account) || !accountMatchesType(account, campaignType) || !/^\d{4}-\d{2}-\d{2}$/.test(campaignDate)) return NextResponse.json({ error: "Name, campaign type, matching account, and date are required" }, { status: 400 });
  if (source === "state_wise" && (!state || !Number.isInteger(serialStart) || serialStart < 1 || !Number.isInteger(serialEnd) || serialEnd < serialStart)) return NextResponse.json({ error: "State campaigns need a state and valid serial range" }, { status: 400 });
  const schedule = campaignType === "whatsapp" && campaignDate >= AUTOMATED_WHATSAPP_SCHEDULE_START ? whatsappCampaignSchedule(campaignDate, source === "birthday") : null;
  const automaticRetargetName = `${source === "birthday" ? "Belated" : "Retarget"}_${name}`;
  const { data, error } = await createAdminClient().from("campaigns").insert({ name, campaign_type: campaignType, source, account, state: source === "state_wise" ? state : null, serial_start: source === "state_wise" ? serialStart : null, serial_end: source === "state_wise" ? serialEnd : null, campaign_date: campaignDate, campaign_end_date: schedule?.campaignEndDate ?? null, campaign_completed_on: campaignType === "email" ? campaignDate : null, created_by: actor.id, assigned_to: actor.id, retarget_name: campaignType === "whatsapp" ? (typeof body.retarget_name === "string" && body.retarget_name.trim() ? body.retarget_name.trim() : automaticRetargetName) : null, retarget_start_date: schedule?.retargetStartDate ?? null, retarget_due_date: campaignType === "whatsapp" ? schedule?.retargetEndDate ?? (typeof body.retarget_due_date === "string" && body.retarget_due_date ? body.retarget_due_date : null) : null, stage: campaignType === "email" ? "complete" : "awaiting_completion" }).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not create campaign" }, { status: 400 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}
