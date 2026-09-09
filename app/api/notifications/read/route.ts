import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";

export async function PATCH() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
