import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { normalizePhone } from "@/lib/architects/normalization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  if (!phone) return NextResponse.json({ error: "Enter a valid Indian phone number" }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  const { data, error } = await createAdminClient().from("contact_suppressions").upsert({ phone, reason, created_by: actor.id }, { onConflict: "phone" }).select("id, phone").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not suppress contact" }, { status: 400 });
  return NextResponse.json({ suppression: data });
}

export async function DELETE(request: Request) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Only admins can remove a do-not-contact flag" }, { status: 403 });
  const phone = normalizePhone(new URL(request.url).searchParams.get("phone"));
  if (!phone) return NextResponse.json({ error: "Enter a valid Indian phone number" }, { status: 400 });
  const { error } = await createAdminClient().from("contact_suppressions").delete().eq("phone", phone);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
