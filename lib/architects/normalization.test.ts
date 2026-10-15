import { describe, expect, it } from "vitest";
import { formatExportName, normalizeEmail, normalizePhone } from "./normalization";

describe("architect contact normalization", () => {
  it("normalizes Indian country code and leading zero", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  it("rejects invalid and obvious fake phone numbers", () => {
    expect(normalizePhone("5123456789")).toBeNull();
    expect(normalizePhone("9999999999")).toBeNull();
  });

  it("normalizes valid emails", () => {
    expect(normalizeEmail(" ADMIN@EXAMPLE.COM ")).toBe("admin@example.com");
    expect(normalizeEmail("bad-address")).toBeNull();
  });

  it("formats all-caps abbreviated names without truncating", () => {
    expect(formatExportName("MR. R.S. SHARMA")).toBe("Mr. R.s. Sharma");
  });

  it("truncates all-caps and lowercase names to salutation and first name", () => {
    expect(formatExportName("MR. RAHUL SHARMA")).toBe("Mr. Rahul");
    expect(formatExportName("mrs. priya patel")).toBe("Mrs. Priya");
  });

  it("leaves mixed-case names untouched", () => {
    expect(formatExportName("Dr. Ananya Rao")).toBe("Dr. Ananya Rao");
  });
});
