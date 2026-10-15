import type { CampaignAccount, CampaignType } from "@/lib/campaigns/types";

export const CAMPAIGN_ACCOUNTS: Array<{ value: CampaignAccount; label: string; type: CampaignType }> = [
  { value: "whatsapp_9928781655", label: "WhatsApp 9928781655", type: "whatsapp" },
  { value: "whatsapp_9928501655", label: "WhatsApp 9928501655", type: "whatsapp" },
  { value: "email_stonekingexports", label: "stonekingexports email", type: "email" },
  { value: "email_stonekingexportindia", label: "stonekingexportindia email", type: "email" },
];

function utcDate(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function iso(date: Date) { return date.toISOString().slice(0, 10); }

export function followingMonday(campaignDate: string): string {
  const date = utcDate(campaignDate);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (day === 0 ? 1 : 8 - day));
  return iso(date);
}

export function mondayOfWeek(dateValue: string): string {
  const date = utcDate(dateValue);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  return iso(date);
}

export function addDays(dateValue: string, days: number): string {
  const date = utcDate(dateValue); date.setUTCDate(date.getUTCDate() + days); return iso(date);
}

export function campaignName(state: string | null, campaignDate: string, serialStart: number | null, serialEnd: number | null, birthday = false): string {
  const date = utcDate(campaignDate);
  const datePart = `${String(date.getUTCDate()).padStart(2, "0")}_${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()}`;
  return birthday ? `BIRTHDAY_${datePart}` : `${state?.trim().toUpperCase()}_${datePart}_${serialStart}-${serialEnd}`;
}

export function campaignMetrics(input: Record<string, unknown>) {
  const numericNames = ["total_attempted", "total_delivered_first", "retarget_attempted", "retarget_delivered", "total_delivered_final", "total_failed", "total_replies", "total_instagram_clicks", "total_whatsapp_channel_clicks", "total_catalog_requests", "total_inquiries"] as const;
  const values = Object.fromEntries(numericNames.map((name) => {
    const value = input[name];
    return [name, value === "" || value === null || value === undefined ? null : Number(value)];
  }));
  if (Object.values(values).some((value) => value !== null && (!Number.isInteger(value) || value < 0))) throw new Error("Metrics must be whole numbers of zero or more");
  const totalLeads = [values.total_replies, values.total_instagram_clicks, values.total_whatsapp_channel_clicks, values.total_catalog_requests, values.total_inquiries].reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const percentage = values.total_attempted && values.total_delivered_final !== null ? Number(((values.total_delivered_final / values.total_attempted) * 100).toFixed(2)) : null;
  const retargetCompletedOn = typeof input.retarget_completed_on === "string" && input.retarget_completed_on ? input.retarget_completed_on : null;
  const retargetName = typeof input.retarget_name === "string" && input.retarget_name.trim() ? input.retarget_name.trim() : null;
  const campaignCompletedOn = typeof input.campaign_completed_on === "string" && input.campaign_completed_on ? input.campaign_completed_on : null;
  const required = [values.total_attempted, values.total_delivered_first, values.retarget_attempted, values.retarget_delivered, values.total_delivered_final, values.total_failed, values.total_replies, values.total_instagram_clicks, values.total_whatsapp_channel_clicks, values.total_catalog_requests, values.total_inquiries, retargetCompletedOn];
  return { ...values, campaign_completed_on: campaignCompletedOn, retarget_name: retargetName, retarget_completed_on: retargetCompletedOn, total_leads: totalLeads, percentage, stage: required.every((value) => value !== null) ? "complete" : "awaiting_completion" };
}
