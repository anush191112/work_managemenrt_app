export type LeadEngagementTag = "curious" | "interested" | "regular" | "fan";

export function engagementTagForTouchCount(touchCount: number): LeadEngagementTag {
  if (touchCount >= 4) return "fan";
  if (touchCount === 3) return "regular";
  if (touchCount === 2) return "interested";
  return "curious";
}
