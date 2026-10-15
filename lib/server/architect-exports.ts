import "server-only";
import { campaignName, followingMonday } from "@/lib/campaigns/logic";
import { accountMatchesType, isCampaignAccount, type CampaignType } from "@/lib/campaigns/types";
import { formatExportName, isIsoDate, normalizeEmail, normalizePhone } from "@/lib/architects/normalization";
import { createAdminClient } from "@/lib/supabase/admin";

type Architect = { id: string; state: string; serial_no: number; name: string; phone: string | null; email: string | null; address: string | null; birthdate: string | null };
type ExportContact = { id: string; source: "architect" | "birthday_contact"; state: string | null; serial_no: number | null; name: string; phone: string | null; email: string | null; address: string | null; birthdate: string | null };
export type ExportRequest = { mode: "state_wise"; campaignType: CampaignType; state: string; startingSerial: number; count: number; account?: unknown; campaignDate?: unknown } | { mode: "birthday"; targetDate: string; account?: unknown };

function validContact(contact: ExportContact, type: CampaignType) { return type === "whatsapp" ? Boolean(normalizePhone(contact.phone)) : Boolean(normalizeEmail(contact.email)); }

function csvCell(value: string | null) { return `"${(value ?? "").replaceAll('"', '""')}"`; }
function csvFor(rows: ExportContact[]) { return ["Name,Phone Number,Country Code,Email Address,Address", ...rows.map((row) => [formatExportName(row.name), row.phone, "91", row.email, row.address].map(csvCell).join(","))].join("\r\n"); }

function stateAbbreviation(state: string) { return state.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "STATE"; }
function birthdaySelection(value: string) {
  const match = value.match(/^(\d{2})-(\d{2})$/);
  if (!match) throw new Error("Birthday must use DD-MM");
  const day = Number(match[1]); const month = Number(match[2]);
  const placeholder = new Date(Date.UTC(2000, month - 1, day));
  if (placeholder.getUTCMonth() !== month - 1 || placeholder.getUTCDate() !== day) throw new Error("Birthday must be a valid DD-MM date");
  const year = new Date().getUTCFullYear(); const campaign = new Date(Date.UTC(year, month - 1, day));
  if (campaign.getUTCMonth() !== month - 1 || campaign.getUTCDate() !== day) throw new Error("29-02 can only be exported in a leap year");
  return { placeholderDate: `2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, campaignDate: campaign.toISOString().slice(0, 10), month, day };
}

export async function selectArchitects(request: ExportRequest) {
  const admin = createAdminClient();
  let allRows: ExportContact[] = [];
  let campaignType: CampaignType;
  if (request.mode === "state_wise") {
    campaignType = request.campaignType;
    const { data, error } = await admin.from("architects").select("id, state, serial_no, name, phone, email, address, birthdate").eq("state", request.state.trim()).gte("serial_no", request.startingSerial).order("serial_no");
    if (error) throw new Error(error.message);
    allRows = ((data ?? []) as Architect[]).map((row) => ({ ...row, source: "architect" }));
    if (!Number.isInteger(request.count) || request.count < 1) throw new Error("Count must be a positive whole number");
    allRows = allRows.filter((row) => validContact(row, campaignType)).slice(0, request.count);
    if (allRows.length < request.count) throw new Error(`Only ${allRows.length} eligible contacts were found from that serial number`);
  } else {
    campaignType = "whatsapp";
    const target = birthdaySelection(request.targetDate);
    const [{ data: architectRows, error: architectError }, { data: birthdayRows, error: birthdayError }] = await Promise.all([
      admin.from("architects").select("id, state, serial_no, name, phone, email, address, birthdate").eq("birthdate", target.placeholderDate).order("state").order("serial_no"),
      admin.from("birthday_contacts").select("id, name, phone, email, address, birthdate").eq("birthdate", target.placeholderDate).order("name"),
    ]);
    if (architectError || birthdayError) throw new Error((architectError ?? birthdayError)?.message ?? "Could not retrieve birthday contacts");
    const merged = new Map<string, ExportContact>();
    for (const row of (architectRows ?? []) as Architect[]) if (validContact({ ...row, source: "architect" }, campaignType) && row.phone) merged.set(row.phone, { ...row, source: "architect" });
    for (const row of birthdayRows ?? []) if (normalizePhone(row.phone)) merged.set(row.phone, { ...row, state: null, serial_no: null, source: "birthday_contact" });
    allRows = [...merged.values()];
    if (allRows.length === 0) throw new Error("No architects with a valid phone number have that birthday");
  }
  let duplicates: Array<{ architectId: string; exportedAt: string }> = [];
  if (request.mode === "state_wise") {
    const { data: recentLogs, error: logError } = await admin.from("architect_export_logs").select("id, exported_at").eq("campaign_type", campaignType).gte("exported_at", new Date(Date.now() - 30 * 86400_000).toISOString());
    if (logError) throw new Error(logError.message);
    const logIds = (recentLogs ?? []).map((log) => log.id);
    const { data: oldItems, error: itemsError } = logIds.length ? await admin.from("architect_export_items").select("architect_id, export_id").in("export_id", logIds).in("architect_id", allRows.map((row) => row.id)) : { data: [], error: null };
    if (itemsError) throw new Error(itemsError.message);
    const loggedAt = new Map((recentLogs ?? []).map((log) => [log.id, log.exported_at]));
    duplicates = (oldItems ?? []).map((item) => ({ architectId: item.architect_id, exportedAt: loggedAt.get(item.export_id) ?? "" }));
  }
  const birthday = request.mode === "birthday" ? birthdaySelection(request.targetDate) : null;
  const filename = request.mode === "state_wise" ? `${stateAbbreviation(request.state)}_${allRows[0].serial_no}-${allRows.at(-1)?.serial_no}.csv` : `BIRTHDAY_${request.targetDate}.csv`;
  const architectContactCount = allRows.filter((row) => row.source === "architect").length;
  return { rows: allRows, campaignType, duplicates, filename, csv: csvFor(allRows), architectContactCount, birthdayContactCount: allRows.length - architectContactCount, birthdayCampaignDate: birthday?.campaignDate, birthdayPlaceholderDate: birthday?.placeholderDate };
}

export async function createExport(actorId: string, request: ExportRequest) {
  const selected = await selectArchitects(request);
  if (!isCampaignAccount(request.account) || !accountMatchesType(request.account, selected.campaignType)) throw new Error("Select an account that matches the campaign type");
  const campaignDate = request.mode === "birthday" ? selected.birthdayCampaignDate : request.campaignDate;
  if (!isIsoDate(campaignDate)) throw new Error("Campaign date must be a valid date");
  const admin = createAdminClient();
  const first = selected.rows[0]; const last = selected.rows.at(-1)!;
  const logData: Record<string, unknown> = request.mode === "birthday"
    ? { exported_by: actorId, campaign_type: selected.campaignType, birthdate_filter: selected.birthdayPlaceholderDate, contact_count: selected.rows.length, architect_contact_count: selected.architectContactCount, birthday_contact_count: selected.birthdayContactCount }
    : { exported_by: actorId, campaign_type: selected.campaignType, state: request.state.trim(), serial_start: first.serial_no, serial_end: last.serial_no, contact_count: selected.rows.length };
  const { data: log, error: logError } = await admin.from("architect_export_logs").insert(logData).select("id").single();
  if (logError || !log) throw new Error(logError?.message ?? "Could not record export");
  const { data: campaign, error: campaignError } = await admin.from("campaigns").insert({
    name: campaignName(request.mode === "birthday" ? null : request.state.trim(), campaignDate, request.mode === "birthday" ? null : first.serial_no, request.mode === "birthday" ? null : last.serial_no, request.mode === "birthday"),
    campaign_type: selected.campaignType, source: request.mode === "birthday" ? "birthday" : "state_wise", account: request.account,
    state: request.mode === "birthday" ? null : request.state.trim(), serial_start: request.mode === "birthday" ? null : first.serial_no, serial_end: request.mode === "birthday" ? null : last.serial_no,
    csv_export_id: log.id, campaign_date: campaignDate, created_by: actorId, assigned_to: actorId,
    retarget_name: `${request.mode === "birthday" ? "Belated" : "Retarget"}_${campaignName(request.mode === "birthday" ? null : request.state.trim(), campaignDate, request.mode === "birthday" ? null : first.serial_no, request.mode === "birthday" ? null : last.serial_no, request.mode === "birthday")}`,
    retarget_due_date: followingMonday(campaignDate),
  }).select("id").single();
  if (campaignError || !campaign) { await admin.from("architect_export_logs").delete().eq("id", log.id); throw new Error(campaignError?.message ?? "Could not create campaign"); }
  const { error: updateError } = await admin.from("architect_export_logs").update({ campaign_id: campaign.id }).eq("id", log.id);
  const architectItems = selected.rows.filter((row) => row.source === "architect").map((row) => ({ export_id: log.id, architect_id: row.id }));
  const { error: itemError } = architectItems.length ? await admin.from("architect_export_items").insert(architectItems) : { error: null };
  if (updateError || itemError) throw new Error((updateError ?? itemError)?.message ?? "Could not record exported contacts");
  return { ...selected, campaignId: campaign.id };
}
