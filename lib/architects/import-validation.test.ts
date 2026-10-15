import { describe, expect, it } from "vitest";
import { prepareBirthdayContactsImport, prepareCleanImport } from "./import-validation";

const headers = "State,Serial No,Name,Phone,Email,Address,DOB";

describe("clean architect import", () => {
  it("normalizes contacts, nulls known duplicate phones, and skips rows without a contact", () => {
    const result = prepareCleanImport(`${headers}\nGJ,1,One,+91 98765 43210,,A,\nGJ,2,Two,09876543210,two@example.com,B,\nGJ,3,Three,0000000000,,C,`, [], [{ name: "One", phone: "9876543210" }]);
    expect(result.rejected).toBe(false);
    expect(result.rows).toEqual([{ state: "GJ", serial_no: 2, name: "Two", phone: "9876543210", email: "two@example.com", address: "B", birthdate: null }]);
    expect(result.skipped).toEqual([{ line: 2, reason: "Duplicate name and phone pair" }, { line: 4, reason: "No valid phone or email after cleaning" }]);
  });

  it("rejects the entire file for duplicate state and serial pairs", () => {
    const result = prepareCleanImport(`${headers}\nGJ,1,One,9876543210,,A,\nGJ,1,Two,9876543211,,B,`, [], []);
    expect(result.rejected).toBe(true);
    expect(result.rejectedRows).toEqual(expect.arrayContaining([{ line: 3, reason: "Duplicate state/serial: GJ/1" }]));
  });

  it("accepts master-file header aliases and turns DD-MM birthdays into year-2000 dates", () => {
    const result = prepareCleanImport("State,Serial Number,Full Name,Mobile Number,Email Address,Address,Birthday\nGJ,1,Mr. Rahul Shah,9876543210,rahul@example.com,Ahmedabad,29-02", [], []);
    expect(result.rejected).toBe(false);
    expect(result.rows[0]).toMatchObject({ name: "Mr. Rahul Shah", phone: "9876543210", birthdate: "2000-02-29" });
  });

  it("skips duplicate birthday-source phones without checking architects", () => {
    const result = prepareBirthdayContactsImport("Name,Phone Number,Birthday\nMs. One,9876543210,01-01\nMs. Two,9876543210,01-01\nMs. Three,9876543211,02-01", []);
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toEqual([{ line: 3, reason: "Duplicate phone in birthday contacts" }]);
  });
});
