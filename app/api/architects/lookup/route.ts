import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { normalizePhone } from "@/lib/architects/normalization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!await getCurrentActor()) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  const phone = normalizePhone(new URL(request.url).searchParams.get("phone"));
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
  const admin = createAdminClient();
  const [{ data: birthdayRows, error: birthdayError }, { data: architectRows, error: architectError }] = await Promise.all([
    admin.from("birthday_contacts").select("id, name, phone, email, address").eq("phone", phone),
    admin.from("architects").select("id, name, phone, email, address").eq("phone", phone).order("name"),
  ]);
  if (birthdayError || architectError) return NextResponse.json({ error: (birthdayError ?? architectError)?.message ?? "Could not look up contact" }, { status: 500 });
  const contacts = (birthdayRows?.length ? birthdayRows.map((row) => ({ ...row, source: "birthday_contact", architect_id: null })) : (architectRows ?? []).map((row) => ({ ...row, source: "architect", architect_id: row.id })));
  return NextResponse.json({ contacts, phone });
}
