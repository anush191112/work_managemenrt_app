import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { currentIstDate, isIstDate } from "@/lib/task-engine/ist-date";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const date = body?.date;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
  if (!isIstDate(date) || date < currentIstDate()) {
    return NextResponse.json({ error: "Choose today or a future IST date" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("off_day_requests").insert({
    user_id: actor.id,
    date,
    reason: reason || null,
  }).select("id, date, status").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ request: data }, { status: 201 });
}
