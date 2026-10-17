import { describe, expect, it } from "vitest";
import { campaignMetrics, campaignName, followingMonday, mondayOfWeek, stateCode } from "./logic";

describe("campaign date rules", () => {
  it("sets retarget due date to the following Monday for every day of a campaign week", () => {
    expect(followingMonday("2026-09-21")).toBe("2026-09-28");
    expect(followingMonday("2026-09-25")).toBe("2026-09-28");
    expect(followingMonday("2026-09-26")).toBe("2026-09-28");
  });

  it("treats Sunday as part of the preceding Monday-started week", () => {
    expect(mondayOfWeek("2026-09-27")).toBe("2026-09-21");
  });

  it("calculates rolled-up metrics and completion from the campaign fields", () => {
    const result = campaignMetrics({
      total_attempted: 100, total_delivered_first: 80, retarget_completed_on: "2026-09-28", retarget_attempted: 20, retarget_delivered: 15, total_delivered_final: 95, total_failed: 5,
      total_replies: 1, total_instagram_clicks: 2, total_whatsapp_channel_clicks: 3, total_catalog_requests: 4, total_inquiries: 5,
    });
    expect(result.total_leads).toBe(15);
    expect(result.percentage).toBe(95);
    expect(result.stage).toBe("complete");
  });

  it("uses stable short state codes for state-wise campaign names", () => {
    expect(stateCode("Maharashtra")).toBe("MH");
    expect(stateCode("Rajasthan")).toBe("RJ");
    expect(stateCode("Chattisgarh")).toBe("CG");
    expect(stateCode("Mumbai_Suburban")).toBe("MS");
    expect(stateCode("Navi Mumbai")).toBe("NM");
    expect(campaignName("Maharashtra", "2026-10-17", 1, 500)).toBe("MH_17_OCT_1-500");
  });

  it("uses the campaign date in birthday campaign names", () => {
    expect(campaignName(null, "2026-10-17", null, null, true)).toBe("bday_17_oct_2026");
  });
});
