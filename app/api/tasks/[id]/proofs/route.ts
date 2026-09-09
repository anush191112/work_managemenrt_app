import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(request: Request, { params }: RouteContext<"/api/tasks/[id]/proofs">) {
  const actor = await getCurrentActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Upload a JPEG, PNG, WebP, or GIF image up to 5 MB" }, { status: 400 });
  }

  const { id } = await params;
  const scopedClient = await createClient();
  const { data: task, error: taskError } = await scopedClient
    .from("tasks")
    .select("id, assigned_to")
    .eq("id", id)
    .single();
  if (taskError || !task || task.assigned_to !== actor.id) {
    return NextResponse.json({ error: "You can only upload proof for your own tasks" }, { status: 403 });
  }

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "image";
  const path = `${actor.id}/${id}/${crypto.randomUUID()}.${extension}`;
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage.from("task-proofs").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { error: proofError } = await admin.from("task_proofs").insert({
    task_id: id,
    file_url: path,
    uploaded_by: actor.id,
  });
  if (proofError) {
    await admin.storage.from("task-proofs").remove([path]);
    return NextResponse.json({ error: proofError.message }, { status: 500 });
  }

  return NextResponse.json({ path }, { status: 201 });
}
