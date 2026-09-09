import { NextResponse } from "next/server";
import { canManageTasks, getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import type { TaskCategory } from "@/lib/task-engine/types";

const CATEGORIES: TaskCategory[] = [
  "whatsapp_campaign", "email_campaign", "inbox_check", "instagram_post",
  "content_research", "lead_sheet", "catalog_revamp", "other",
];

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const actor = await getCurrentActor();
  if (!actor || !canManageTasks(actor)) {
    return NextResponse.json({ error: "Only admins and managers can manage templates" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title || !CATEGORIES.includes(body?.category) || !Number.isInteger(body?.day_of_week) || body.day_of_week < 0 || body.day_of_week > 6 || typeof body?.assigned_to !== "string") {
    return NextResponse.json({ error: "Complete all required template fields" }, { status: 400 });
  }

  const quantity = body.quantity === "" || body.quantity === null ? null : Number(body.quantity);
  const minutes = body.time_allotted_minutes === "" || body.time_allotted_minutes === null ? null : Number(body.time_allotted_minutes);
  if ((quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) || (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0))) {
    return NextResponse.json({ error: "Quantity must be zero or more and time must be positive" }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_templates").update({
    title,
    category: body.category,
    day_of_week: body.day_of_week,
    assigned_to: body.assigned_to,
    quantity,
    time_allotted_minutes: minutes,
    is_mandatory: body.is_mandatory !== false,
    requires_proof: body.requires_proof === true,
  }).eq("id", id).select("id").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Template not found or unavailable" }, { status: 404 });
  return NextResponse.json({ template: data });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const actor = await getCurrentActor();
  if (!actor || !canManageTasks(actor)) {
    return NextResponse.json({ error: "Only admins and managers can manage templates" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.from("task_templates").delete().eq("id", id).select("id").maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Template not found or unavailable" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}
