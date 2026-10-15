import "server-only";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";

export async function scopedUserIds(actor: CurrentActor): Promise<string[]> {
  if (actor.role === "admin") {
    const { data, error } = await createAdminClient().from("users").select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).map((user) => user.id);
  }
  if (actor.role === "manager") {
    const { data, error } = await createAdminClient().from("users").select("id").or(`id.eq.${actor.id},manager_id.eq.${actor.id}`);
    if (error) throw new Error(error.message);
    return (data ?? []).map((user) => user.id);
  }
  return [actor.id];
}
