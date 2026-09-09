import { NextResponse } from "next/server";
import { canManageTasks, getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTasksForUsers } from "@/lib/server/generate-daily-tasks";
import { currentIstDate, isIstDate } from "@/lib/task-engine/ist-date";
import type { IstDateString, TaskEngineUser } from "@/lib/task-engine/types";

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requestDate(request: Request): Promise<IstDateString | null> {
  const body = await request.json().catch(() => ({}));
  const date = body.date ?? currentIstDate();
  return isIstDate(date) ? date : null;
}

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) {
    return error("Authentication is required", 401);
  }
  if (!canManageTasks(actor)) {
    return error("Only admins and managers can generate tasks", 403);
  }

  const date = await requestDate(request);
  if (!date) {
    return error("date must be an IST calendar date in YYYY-MM-DD format", 400);
  }

  const admin = createAdminClient();
  let usersQuery = admin.from("users").select("id, work_days");
  if (actor.role === "manager") {
    usersQuery = usersQuery.or(`id.eq.${actor.id},manager_id.eq.${actor.id}`);
  }

  const { data: userRows, error: usersError } = await usersQuery;
  if (usersError) {
    return error(usersError.message, 500);
  }

  const users = (userRows ?? []) as TaskEngineUser[];
  try {
    return NextResponse.json(await generateTasksForUsers(date, users));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Could not generate tasks", 500);
  }
}
