import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { LeadExportClient } from "./lead-export-client";

export default async function LeadExportPage() {
  if (!await getCurrentActor()) redirect("/login");
  return <main><header className="page-header"><div><p className="eyebrow">Lead queue</p><h1>Lead CSV export</h1></div><Link className="back-link" href="/leads">Back to leads</Link></header><LeadExportClient /></main>;
}
