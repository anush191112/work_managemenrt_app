import { isIstDate } from "@/lib/task-engine/ist-date";

export const REPORT_RANGES = ["all", "week", "month", "quarter", "custom"] as const;
export type ReportRange = (typeof REPORT_RANGES)[number];

export interface ReportPeriod { range: ReportRange; startDate: string | null; endDate: string; label: string; }

export function formatReportDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export function formatReportTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("day")}-${part("month")}-${part("year")}`;
}

function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function shiftMonths(date: string, months: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + months);
  return value.toISOString().slice(0, 10);
}

export function resolveReportPeriod(input: { range?: string; start?: string; end?: string; today: string }): ReportPeriod {
  const range = REPORT_RANGES.includes(input.range as ReportRange) ? input.range as ReportRange : "all";
  const validEnd = isIstDate(input.end) && input.end <= input.today ? input.end : input.today;
  if (range === "week") return { range, startDate: shiftDays(validEnd, -6), endDate: validEnd, label: "Last 7 days" };
  if (range === "month") return { range, startDate: shiftMonths(validEnd, -1), endDate: validEnd, label: "Last month" };
  if (range === "quarter") return { range, startDate: shiftMonths(validEnd, -3), endDate: validEnd, label: "Last 3 months" };
  if (range === "custom" && isIstDate(input.start) && input.start <= validEnd) return { range, startDate: input.start, endDate: validEnd, label: `${formatReportDate(input.start)} to ${formatReportDate(validEnd)}` };
  return { range: "all", startDate: null, endDate: validEnd, label: `All time through ${formatReportDate(validEnd)}` };
}
