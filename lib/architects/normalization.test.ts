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

  it("uses the Excel export rule for a dotted abbreviation", () => {
    expect(formatExportName("MR. R.S. SHARMA")).toBe("MR. R.S.");
  });

  it("skips single-letter initials before selecting the first full word", () => {
    expect(formatExportName("MR. R. S. SHARMA")).toBe("MR. SHARMA");
  });

  it("keeps the stored spelling and takes the first meaningful name word", () => {
    expect(formatExportName("mrs. priya patel")).toBe("mrs. priya");
    expect(formatExportName("Dr. Ananya Rao")).toBe("Dr. Ananya");
    expect(formatExportName("Madonna")).toBe("Madonna");
  });
});
