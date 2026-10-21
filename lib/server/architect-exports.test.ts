import { describe, expect, it } from "vitest";
import { buildExportCsv } from "@/lib/architects/export-csv";

describe("architect export CSV columns", () => {
  const contact = { name: "RAVI KUMAR", phone: "9928781655", email: "ravi@example.com" };

  it("builds WhatsApp exports with name, country code, and phone only", () => {
    expect(buildExportCsv([contact], "whatsapp").split("\r\n")).toEqual([
      "Name,Country Code,Phone Number",
      '"RAVI KUMAR","91","9928781655"',
    ]);
  });

  it("builds email exports with email then name only", () => {
    expect(buildExportCsv([contact], "email").split("\r\n")).toEqual([
      "Email Address,Name",
      '"ravi@example.com","RAVI KUMAR"',
    ]);
  });
});
