import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { ArchitectImportClient } from "./import-client";

export default async function ArchitectImportPage() {
  if (!await getCurrentActor()) redirect("/login");
  return <main><header className="page-header"><div><p className="eyebrow">Architect database</p><h1>Import architects</h1></div><Link className="back-link" href="/dashboard">Back to today</Link></header><ArchitectImportClient /></main>;
}
