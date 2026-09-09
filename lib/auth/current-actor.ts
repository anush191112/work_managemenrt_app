import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/task-engine/types";

export interface CurrentActor {
  id: string;
  role: UserRole;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

export async function getCurrentActor(): Promise<CurrentActor | null> {
  const supabase = await createClient();
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return null;
  }

  const { data: profile, error } = await createAdminClient()
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return null;
  }

  return profile as CurrentActor;
}

export function canManageTasks(actor: CurrentActor): boolean {
  return actor.role === "admin" || actor.role === "manager";
}
