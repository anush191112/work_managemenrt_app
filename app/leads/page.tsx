import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { LeadEntryForm } from "./lead-entry-form";
import { RecentLeads, type RecentLead } from "./recent-leads";

export default async function LeadsPage() {
  if (!await getCurrentActor()) redirect("/login");

  const { data } = await createAdminClient()
    .from("leads")
    .select("id, name, phone, account, purpose, engagement_tag, touch_count, created_at, last_marked_at")
    .order("last_marked_at", { ascending: false })
    .limit(5);

  return <main>
    <header className="page-header"><div><p className="eyebrow">Inbox</p><h1>Lead entry</h1></div><div className="header-actions"><Link className="primary-action" href="/lead-export">Export leads</Link><Link className="back-link" href="/dashboard">Back to today</Link></div></header>
    <div className="lead-entry-layout">
      <LeadEntryForm />
      <RecentLeads leads={(data ?? []) as RecentLead[]} />
    </div>
  </main>;
}
