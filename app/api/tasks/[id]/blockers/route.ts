import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: RouteContext<"/api/tasks/[id]/blockers">) {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "A blocker reason is required" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, assigned_to")
    .eq("id", id)
    .single();

  if (taskError || !task || task.assigned_to !== actor.id) {
    return NextResponse.json({ error: "You can only report blockers on your own tasks" }, { status: 403 });
  }

  const { error } = await supabase.from("task_blockers").insert({
    task_id: id,
    reported_by: actor.id,
    reason_text: reason,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
