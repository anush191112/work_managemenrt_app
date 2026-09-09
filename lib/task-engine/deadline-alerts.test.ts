import { describe, expect, it } from "vitest";
import { classifyDeadlineAlert, deadlineTimeToMinutes } from "./deadline-alerts";

describe("deadline alerts", () => {
  it("converts a database time to minutes after midnight", () => {
    expect(deadlineTimeToMinutes("14:05:00")).toBe(845);
  });

  it("flags work in the final 30 minutes", () => {
    expect(classifyDeadlineAlert("14:30:00", 14 * 60)).toBe("deadline_approaching");
    expect(classifyDeadlineAlert("14:31:00", 14 * 60)).toBeNull();
  });

  it("flags work at or after its deadline as missed", () => {
    expect(classifyDeadlineAlert("14:00:00", 14 * 60)).toBe("deadline_missed");
    expect(classifyDeadlineAlert("14:00:00", 14 * 60 + 1)).toBe("deadline_missed");
  });
});
