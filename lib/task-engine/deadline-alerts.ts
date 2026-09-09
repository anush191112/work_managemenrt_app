export type DeadlineAlertType = "deadline_approaching" | "deadline_missed";

export function currentIstMinutes(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return valueFor("hour") * 60 + valueFor("minute");
}

export function deadlineTimeToMinutes(deadlineTime: string): number {
  const [hour, minute] = deadlineTime.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

export function classifyDeadlineAlert(deadlineTime: string, nowMinutes: number): DeadlineAlertType | null {
  const minutesRemaining = deadlineTimeToMinutes(deadlineTime) - nowMinutes;
  if (minutesRemaining <= 0) return "deadline_missed";
  if (minutesRemaining <= 30) return "deadline_approaching";
  return null;
}
