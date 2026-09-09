import { NextResponse } from "next/server";
import { canManageTasks, getCurrentActor } from "@/lib/auth/current-actor";
import { applyOffDayShift } from "@/lib/server/apply-off-day-shift";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { currentIstDate, isIstDate } from "@/lib/task-engine/ist-date";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor || !canManageTasks(actor)) {
    return NextResponse.json({ error: "Only admins and managers can add holidays" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const date = body?.date;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const selectedUserId = typeof body?.user_id === "string" ? body.user_id : null;
  if (!isIstDate(date) || date < currentIstDate() || !label) {
    return NextResponse.json({ error: "Add a holiday name and a current or future IST date" }, { status: 400 });
  }
  if (actor.role === "manager" && !selectedUserId) {
    return NextResponse.json({ error: "Managers must choose a team member for a holiday" }, { status: 400 });
  }

  const admin = createAdminClient();
  let allowedUsersQuery = admin.from("users").select("id");
  if (actor.role === "manager") {
    allowedUsersQuery = allowedUsersQuery.or(`id.eq.${actor.id},manager_id.eq.${actor.id}`);
  }
  const { data: allowedUsers, error: usersError } = await allowedUsersQuery;
  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
  const allowedIds = (allowedUsers ?? []).map((user) => user.id);
  const appliesTo = selectedUserId ? [selectedUserId] : null;
  if (selectedUserId && !allowedIds.includes(selectedUserId)) {
    return NextResponse.json({ error: "The selected employee is outside your scope" }, { status: 403 });
  }

  const scopedClient = await createClient();
  const { data: holiday, error: holidayError } = await scopedClient.from("holidays").insert({
    date, label, applies_to: appliesTo, created_by: actor.id,
  }).select("id").single();
  if (holidayError || !holiday) {
    return NextResponse.json({ error: holidayError?.message ?? "Could not create holiday" }, { status: 400 });
  }

  const affectedIds = appliesTo ?? allowedIds;
  try {
    const shiftResults = await Promise.all(affectedIds.map((userId) => applyOffDayShift(userId, date)));
    return NextResponse.json({ holiday, shifted: shiftResults.reduce((total, result) => total + result.moved.length + result.merged.length, 0) }, { status: 201 });
  } catch (shiftError) {
    return NextResponse.json({ error: shiftError instanceof Error ? shiftError.message : "Holiday saved but tasks could not be shifted" }, { status: 500 });
  }
}
