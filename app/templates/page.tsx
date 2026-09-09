import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { TemplateForm } from "./template-form";
import { TemplateList } from "./template-list";

export default async function TemplatesPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.role === "employee") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: templates }, { data: users }] = await Promise.all([
    supabase.from("task_templates").select("id, title, category, day_of_week, quantity, time_allotted_minutes, is_mandatory, requires_proof, assigned_to").order("day_of_week"),
    supabase.from("users").select("id, name").order("name"),
  ]);

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">Recurring work</p><h1>Task templates</h1></div><Link className="back-link" href="/dashboard">Back to today</Link></header>
    <div className="template-layout">
      <section><h2>Add weekly task</h2><TemplateForm users={users ?? []} /></section>
      <section><h2>Current templates</h2><TemplateList templates={templates ?? []} users={users ?? []} /></section>
    </div>
  </main>;
}
