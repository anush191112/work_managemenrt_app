import { NextResponse } from "next/server";
import { canManageTasks, getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { applyOffDayShift } from "@/lib/server/apply-off-day-shift";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getCurrentActor();
  if (!actor) {
    return error("Authentication is required", 401);
  }
  if (!canManageTasks(actor)) {
    return error("Only admins and managers can approve off-day requests", 403);
  }

  const { id } = await params;
  const scopedClient = await createClient();
  const { data: offDay, error: offDayError } = await scopedClient
    .from("off_day_requests")
    .select("id, user_id, date, status")
    .eq("id", id)
    .single();

  if (offDayError || !offDay) {
    return error("Off-day request was not found in your scope", 404);
  }
  if (offDay.status !== "pending") {
    return error("This request is no longer pending", 409);
  }

  const { data: approved, error: approvalError } = await scopedClient
    .from("off_day_requests")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (approvalError) {
    return error(approvalError.message, 500);
  }
  if (!approved) {
    return error("This request is no longer pending", 409);
  }

  let result;
  try {
    result = await applyOffDayShift(offDay.user_id, offDay.date);
  } catch (shiftError) {
    return error(shiftError instanceof Error ? shiftError.message : "Could not shift tasks", 500);
  }

  return NextResponse.json({ approvedRequestId: id, ...result });
}
