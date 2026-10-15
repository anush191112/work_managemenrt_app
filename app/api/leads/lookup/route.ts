import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { normalizePhone } from "@/lib/architects/normalization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!await getCurrentActor()) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  const phone = normalizePhone(new URL(request.url).searchParams.get("phone"));
  if (!phone) return NextResponse.json({ error: "Enter a valid Indian phone number" }, { status: 400 });
  const { data, error } = await createAdminClient().from("leads").select("id, name, phone, touch_count, engagement_tag, last_marked_at").eq("phone", phone).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ phone, lead: data });
}
