import { formatExportName } from "./normalization";
import type { CampaignType } from "@/lib/campaigns/types";

type ExportCsvContact = { name: string; phone: string | null; email: string | null };

function csvCell(value: string | null) { return `"${(value ?? "").replaceAll('"', '""')}"`; }

export function buildExportCsv(rows: ExportCsvContact[], campaignType: CampaignType) {
  if (campaignType === "whatsapp") {
    return ["Name,Country Code,Phone Number", ...rows.map((row) => [formatExportName(row.name), "91", row.phone].map(csvCell).join(","))].join("\r\n");
  }
  return ["Email Address,Name", ...rows.map((row) => [row.email, formatExportName(row.name)].map(csvCell).join(","))].join("\r\n");
}
