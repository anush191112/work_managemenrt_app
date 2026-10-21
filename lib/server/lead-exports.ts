import "server-only";
import { buildExportCsv } from "@/lib/architects/export-csv";
import { isIsoDate, normalizePhone } from "@/lib/architects/normalization";
import { followingMonday, leadExportName } from "@/lib/campaigns/logic";
import { accountMatchesType, isCampaignAccount } from "@/lib/campaigns/types";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadExportRequest = { startDate?: unknown; endDate?: unknown; account?: unknown };
type LeadContact = { name: string; phone: string; created_at: string };

function nextDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function createLeadExport(actorId: string, request: LeadExportRequest) {
  const startDate = typeof request.startDate === "string" && request.startDate ? request.startDate : null;
  const endDate = typeof request.endDate === "string" ? request.endDate : "";
  if ((startDate && !isIsoDate(startDate)) || !isIsoDate(endDate)) throw new Error("Choose a valid end date and, if needed, a valid start date");
  if (startDate && startDate > endDate) throw new Error("The start date must be on or before the end date");
  if (!isCampaignAccount(request.account) || !accountMatchesType(request.account, "whatsapp")) throw new Error("Select a WhatsApp account");

  const admin = createAdminClient();
  let query = admin.from("leads").select("name, phone, created_at").lt("created_at", `${nextDay(endDate)}T00:00:00+05:30`).order("created_at", { ascending: true });
  if (startDate) query = query.gte("created_at", `${startDate}T00:00:00+05:30`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const { data: suppressions, error: suppressionError } = await admin.from("contact_suppressions").select("phone");
  if (suppressionError) throw new Error(suppressionError.message);
  const blockedPhones = new Set((suppressions ?? []).map((suppression) => suppression.phone));
  const rows = ((data ?? []) as LeadContact[])
    .filter((lead) => Boolean(normalizePhone(lead.phone)))
    .map((lead) => ({ ...lead, phone: normalizePhone(lead.phone)! }))
    .filter((lead) => !blockedPhones.has(lead.phone));
  if (!rows.length) throw new Error("No leads were marked in that date range");

  const name = leadExportName(startDate, endDate);
  const { data: campaign, error: campaignError } = await admin.from("campaigns").insert({
    name,
    campaign_type: "whatsapp",
    source: "lead_export",
    account: request.account,
    state: null,
    serial_start: null,
    serial_end: null,
    campaign_date: endDate,
    created_by: actorId,
    assigned_to: actorId,
    retarget_name: `Retarget_${name}`,
    retarget_due_date: followingMonday(endDate),
  }).select("id").single();
  if (campaignError || !campaign) throw new Error(campaignError?.message ?? "Could not create lead export campaign");

  return {
    campaignId: campaign.id,
    filename: `${name}.csv`,
    csv: buildExportCsv(rows.map((lead) => ({ ...lead, email: null })), "whatsapp"),
    contactCount: rows.length,
  };
}
