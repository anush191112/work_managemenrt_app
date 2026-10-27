import { describe, expect, it } from "vitest";
import { formatReportDate, resolveReportPeriod } from "./date-range";

describe("resolveReportPeriod", () => {
  it("uses all time through today by default", () => {
    expect(resolveReportPeriod({ today: "2026-10-21" })).toEqual({ range: "all", startDate: null, endDate: "2026-10-21", label: "All time through 21-10-2026" });
  });

  it("keeps a valid custom date range", () => {
    expect(resolveReportPeriod({ range: "custom", start: "2026-09-20", end: "2026-10-20", today: "2026-10-21" })).toMatchObject({ range: "custom", startDate: "2026-09-20", endDate: "2026-10-20" });
  });

  it("formats visible ISO dates as day-month-year", () => {
    expect(formatReportDate("2026-10-21")).toBe("21-10-2026");
  });
});
