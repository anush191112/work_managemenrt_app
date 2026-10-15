import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { ManualCampaignForm } from "./manual-campaign-form";
export default async function NewCampaignPage() { if (!await getCurrentActor()) redirect("/login"); return <main><header className="page-header"><div><p className="eyebrow">Performance</p><h1>New campaign</h1></div><Link className="back-link" href="/campaigns">Back to campaigns</Link></header><ManualCampaignForm /></main>; }
