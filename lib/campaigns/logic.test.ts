import { describe, expect, it } from "vitest";
import { campaignMetrics, campaignName, followingMonday, leadExportName, mondayOfWeek, stateCode } from "./logic";

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
    expect(stateCode("Daman & Diu")).toBe("DD");
    expect(stateCode("Dadar & Nagar Haveli")).toBe("DN");
    expect(stateCode("Jammu&Kashmir")).toBe("JK");
    expect(stateCode("Mumbai_Suburban")).toBe("MS");
    expect(stateCode("Navi Mumbai")).toBe("NM");
    expect(campaignName("Maharashtra", "2026-10-17", 1, 500)).toBe("MH_17_OCT_1-500");
  });

  it("derives total delivered and failed from campaign delivery values", () => {
    const result = campaignMetrics({ total_attempted: 100, total_delivered_first: 80, retarget_delivered: 15 });
    expect(result.total_delivered_final).toBe(95);
    expect(result.total_failed).toBe(5);
  });

  it("keeps email campaigns as one-day completed campaigns", () => {
    const result = campaignMetrics({ campaign_type: "email", campaign_date: "2026-10-23", total_attempted: 100, total_delivered_final: 90, total_failed: 10, total_leads: 3 });
    expect(result).toMatchObject({ stage: "complete", campaign_completed_on: "2026-10-23", total_leads: 3, retarget_name: null });
  });

  it("uses the campaign date in birthday campaign names", () => {
    expect(campaignName(null, "2026-10-17", null, null, true)).toBe("bday_17_oct_2026");
  });

  it("names lead exports from their selected date range", () => {
    expect(leadExportName(null, "2026-10-15")).toBe("lead_till_15_oct");
    expect(leadExportName("2026-10-20", "2026-10-23")).toBe("lead_20_oct_to_23_oct");
  });
});
