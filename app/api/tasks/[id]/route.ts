import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidQuantityDone } from "@/lib/task-engine/task-progress";
import type { TaskStatus } from "@/lib/task-engine/types";

const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "done", "at_risk", "blocked"];

export async function PATCH(request: Request, { params }: RouteContext<"/api/tasks/[id]">) {
  if (!(await getCurrentActor())) {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "A task update is required" }, { status: 400 });
  }

  const updates: Record<string, number | TaskStatus> = {};
  const hasExplicitStatus = TASK_STATUSES.includes(body.status);
  if (hasExplicitStatus) {
    updates.status = body.status;
  }
  if (Number.isInteger(body.quantity_done) && body.quantity_done >= 0) {
    updates.quantity_done = body.quantity_done;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid task fields were provided" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: task, error: taskError } = await supabase.from("tasks")
    .select("quantity_required, quantity_done, status, is_pool_task, pool_target_total")
    .eq("id", id)
    .single();
  if (taskError || !task) return NextResponse.json({ error: taskError?.message ?? "Task was not found" }, { status: 400 });

  const nextQuantityDone = typeof updates.quantity_done === "number" ? updates.quantity_done : task.quantity_done;
  const targetQuantity = task.is_pool_task ? task.pool_target_total : task.quantity_required;
  if (typeof updates.quantity_done === "number" && !isValidQuantityDone(nextQuantityDone, targetQuantity)) {
      return NextResponse.json({ error: "Progress cannot exceed the required quantity" }, { status: 400 });
  }
  if (typeof updates.quantity_done === "number" && !hasExplicitStatus) {
    if (targetQuantity !== null && nextQuantityDone === targetQuantity) {
      updates.status = "done";
    } else if (nextQuantityDone > 0 && task.status === "not_started") {
      updates.status = "in_progress";
    }
  }
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select("id, status, quantity_done")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Task was not found" }, { status: 400 });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(_request: Request, { params }: RouteContext<"/api/tasks/[id]">) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") return NextResponse.json({ error: "Only admins can delete tasks" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const { data: task, error: taskError } = await admin.from("tasks").select("id, task_proofs(file_url)").eq("id", id).maybeSingle();
  if (taskError || !task) return NextResponse.json({ error: taskError?.message ?? "Task was not found" }, { status: 404 });

  const proofPaths = ((task.task_proofs ?? []) as Array<{ file_url: string }>).map((proof) => proof.file_url);
  if (proofPaths.length) {
    const { error: storageError } = await admin.storage.from("task-proofs").remove(proofPaths);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 400 });
  }
  const { error } = await admin.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
