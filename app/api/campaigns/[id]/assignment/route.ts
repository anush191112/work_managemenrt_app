import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Only admins can reassign campaigns" }, { status: 403 });
  const { assigned_to: assignedTo } = await request.json().catch(() => ({}));
  if (typeof assignedTo !== "string") return NextResponse.json({ error: "Select an employee" }, { status: 400 });
  const admin = createAdminClient();
  const { data: user, error: userError } = await admin.from("users").select("id").eq("id", assignedTo).maybeSingle();
  if (userError || !user) return NextResponse.json({ error: "Employee not found" }, { status: 400 });
  const { id } = await params;
  const { data, error } = await admin.from("campaigns").update({ assigned_to: assignedTo, is_shared: false }).eq("id", id).select("id, assigned_to").maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Campaign not found" }, { status: 404 });
  return NextResponse.json({ campaign: data });
}
