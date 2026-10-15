import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { ContactPreferencesForm } from "./preferences-form";

export default async function ContactPreferencesPage() {
  if (!await getCurrentActor()) redirect("/login");
  return <main><header className="page-header"><div><p className="eyebrow">Contact safety</p><h1>Do not contact</h1></div><Link className="back-link" href="/dashboard">Back to today</Link></header><ContactPreferencesForm /></main>;
}
