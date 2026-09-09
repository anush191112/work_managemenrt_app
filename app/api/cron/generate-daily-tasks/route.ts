import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/server/cron-auth";
import { generateTasksForUsers } from "@/lib/server/generate-daily-tasks";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import type { TaskEngineUser } from "@/lib/task-engine/types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("users").select("id, work_days");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const result = await generateTasksForUsers(currentIstDate(), (data ?? []) as TaskEngineUser[]);
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not generate tasks" }, { status: 500 });
  }
}
