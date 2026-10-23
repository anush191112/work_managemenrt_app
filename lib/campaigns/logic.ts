import type { CampaignAccount, CampaignType } from "@/lib/campaigns/types";

export const CAMPAIGN_ACCOUNTS: Array<{ value: CampaignAccount; label: string; type: CampaignType }> = [
  { value: "whatsapp_9928781655", label: "WhatsApp 9928781655", type: "whatsapp" },
  { value: "whatsapp_9928501655", label: "WhatsApp 9928501655", type: "whatsapp" },
  { value: "email_stonekingexports", label: "stonekingexports email", type: "email" },
  { value: "email_stonekingexportindia", label: "stonekingexportindia email", type: "email" },
];

function utcDate(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function iso(date: Date) { return date.toISOString().slice(0, 10); }

const STATE_CODES: Record<string, string> = {
  "alibaug": "AL", "andaman and nicobar islands": "AN", "andaman and nicobar": "AN", "andhra pradesh": "AP", "arunachal pradesh": "AR", "assam": "AS", "bihar": "BR", "chandigarh": "CH", "chhattisgarh": "CG", "chattisgarh": "CG", "dadra and nagar haveli": "DN", "dadar and nagar haveli": "DN", "daman and diu": "DD", "dadra and nagar haveli and daman and diu": "DH", "delhi": "DL", "nct of delhi": "DL", "goa": "GA", "gujarat": "GJ", "haryana": "HR", "himachal pradesh": "HP", "jammu and kashmir": "JK", "jharkhand": "JH", "karnataka": "KA", "kerala": "KL", "ladakh": "LA", "lakshadweep": "LD", "lonawala": "LO", "madhya pradesh": "MP", "maharashtra": "MH", "manipur": "MN", "meghalaya": "ML", "mizoram": "MZ", "mumbai": "MU", "mumbai suburban": "MS", "navi mumbai": "NM", "nagaland": "NL", "odisha": "OD", "orissa": "OD", "puducherry": "PY", "pondicherry": "PY", "punjab": "PB", "rajasthan": "RJ", "sikkim": "SK", "tamil nadu": "TN", "telangana": "TS", "tripura": "TR", "uttar pradesh": "UP", "uttarakhand": "UK", "west bengal": "WB",
};

export function stateCode(state: string): string {
  const normalizedState = state.trim().toLowerCase().replace(/&/g, " and ").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const code = STATE_CODES[normalizedState];
  if (!code) throw new Error(`No campaign code is configured for ${state.trim()}`);
  return code;
}

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
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  if (birthday) return `bday_${day}_${month.toLowerCase()}_${date.getUTCFullYear()}`;
  const datePart = `${day}_${month.toUpperCase()}`;
  return `${stateCode(state ?? "")}_${datePart}_${serialStart}-${serialEnd}`;
}

function shortDate(value: string) {
  const date = utcDate(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase();
  return `${day}_${month}`;
}

export function leadExportName(startDate: string | null, endDate: string): string {
  return startDate ? `lead_${shortDate(startDate)}_to_${shortDate(endDate)}` : `lead_till_${shortDate(endDate)}`;
}

export function campaignMetrics(input: Record<string, unknown>): Record<string, number | string | null> {
  const campaignType = input.campaign_type;
  if (campaignType === "email") {
    const numericNames = ["total_attempted", "total_delivered_final", "total_failed", "total_leads"] as const;
    const values = Object.fromEntries(numericNames.map((name) => {
      const value = input[name];
      return [name, value === "" || value === null || value === undefined ? null : Number(value)];
    }));
    if (Object.values(values).some((value) => value !== null && (!Number.isInteger(value) || value < 0))) throw new Error("Metrics must be whole numbers of zero or more");
    if (values.total_attempted !== null && values.total_delivered_final !== null && values.total_delivered_final > values.total_attempted) throw new Error("Total delivered cannot be greater than total attempted");
    const percentage = values.total_attempted && values.total_delivered_final !== null ? Number(((values.total_delivered_final / values.total_attempted) * 100).toFixed(2)) : null;
    return {
      ...values,
      total_delivered_first: null,
      retarget_attempted: null,
      retarget_delivered: null,
      total_replies: null,
      total_instagram_clicks: null,
      total_whatsapp_channel_clicks: null,
      total_catalog_requests: null,
      total_inquiries: null,
      retarget_name: null,
      retarget_completed_on: null,
      campaign_completed_on: typeof input.campaign_date === "string" ? input.campaign_date : null,
      percentage,
      stage: "complete" as const,
    };
  }
  const numericNames = ["total_attempted", "total_delivered_first", "retarget_attempted", "retarget_delivered", "total_replies", "total_instagram_clicks", "total_whatsapp_channel_clicks", "total_catalog_requests", "total_inquiries"] as const;
  const values = Object.fromEntries(numericNames.map((name) => {
    const value = input[name];
    return [name, value === "" || value === null || value === undefined ? null : Number(value)];
  }));
  if (Object.values(values).some((value) => value !== null && (!Number.isInteger(value) || value < 0))) throw new Error("Metrics must be whole numbers of zero or more");
  const totalDelivered = values.total_delivered_first === null && values.retarget_delivered === null ? null : (values.total_delivered_first ?? 0) + (values.retarget_delivered ?? 0);
  const totalFailed = values.total_attempted === null || totalDelivered === null ? null : values.total_attempted - totalDelivered;
  if (totalFailed !== null && totalFailed < 0) throw new Error("Total delivered cannot be greater than total attempted");
  const totalLeads = [values.total_replies, values.total_instagram_clicks, values.total_whatsapp_channel_clicks, values.total_catalog_requests, values.total_inquiries].reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const percentage = values.total_attempted && totalDelivered !== null ? Number(((totalDelivered / values.total_attempted) * 100).toFixed(2)) : null;
  const retargetCompletedOn = typeof input.retarget_completed_on === "string" && input.retarget_completed_on ? input.retarget_completed_on : null;
  const retargetName = typeof input.retarget_name === "string" && input.retarget_name.trim() ? input.retarget_name.trim() : null;
  const campaignCompletedOn = typeof input.campaign_completed_on === "string" && input.campaign_completed_on ? input.campaign_completed_on : null;
  const required = [values.total_attempted, values.total_delivered_first, values.retarget_attempted, values.retarget_delivered, totalDelivered, totalFailed, values.total_replies, values.total_instagram_clicks, values.total_whatsapp_channel_clicks, values.total_catalog_requests, values.total_inquiries, retargetCompletedOn];
  return { ...values, total_delivered_final: totalDelivered, total_failed: totalFailed, campaign_completed_on: campaignCompletedOn, retarget_name: retargetName, retarget_completed_on: retargetCompletedOn, total_leads: totalLeads, percentage, stage: required.every((value) => value !== null) ? "complete" : "awaiting_completion" };
}
