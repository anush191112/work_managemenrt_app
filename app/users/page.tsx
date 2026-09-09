import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { CreateUserForm, UserList, type ManagedUser } from "./user-management-client";

export default async function UsersPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  if (actor.role !== "admin") redirect("/dashboard");
  const { data: users } = await createAdminClient().from("users").select("id, name, email, role, manager_id, work_days").order("name");
  return <main className="dashboard-shell"><header className="dashboard-header"><div><p className="eyebrow">Administration</p><h1>Users</h1></div><Link className="back-link" href="/dashboard">Back to today</Link></header><div className="users-layout"><section><h2>Create user</h2><CreateUserForm /></section><section><h2>People and access</h2><UserList users={(users ?? []) as ManagedUser[]} /></section></div></main>;
}
