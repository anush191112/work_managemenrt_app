import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Only admins can delete campaigns" }, { status: 403 });

  const body = await request.json() as { ids?: unknown };
  const ids = [...new Set(Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [])];
  if (ids.length === 0) return NextResponse.json({ error: "Select at least one campaign" }, { status: 400 });

  const { data, error } = await createAdminClient().from("campaigns").delete().in("id", ids).select("id");
  if (error) return NextResponse.json({ error: error.code === "23503" ? "One or more selected campaigns are part of a lead sheet or backlog and cannot be deleted." : error.message }, { status: 400 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
