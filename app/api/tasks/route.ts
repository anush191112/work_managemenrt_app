import { NextResponse } from "next/server";
import { canManageTasks, getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { currentIstDate, isIstDate } from "@/lib/task-engine/ist-date";
import type { TaskCategory, TaskPriority } from "@/lib/task-engine/types";

const CATEGORIES: TaskCategory[] = ["whatsapp_campaign", "email_campaign", "inbox_check", "instagram_post", "content_research", "lead_sheet", "catalog_revamp", "other"];
const PRIORITIES: TaskPriority[] = ["high", "medium", "low", "flexible"];

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor || !canManageTasks(actor)) {
    return NextResponse.json({ error: "Only admins and managers can add tasks" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const date = body?.scheduled_date;
  const quantity = body?.quantity_required === "" || body?.quantity_required === null ? null : Number(body?.quantity_required);
  const minutes = body?.time_allotted_minutes === "" || body?.time_allotted_minutes === null ? null : Number(body?.time_allotted_minutes);
  if (!title || !isIstDate(date) || date < currentIstDate() || !CATEGORIES.includes(body?.category) || !PRIORITIES.includes(body?.priority) || typeof body?.assigned_to !== "string") {
    return NextResponse.json({ error: "Complete all required task fields" }, { status: 400 });
  }
  if ((quantity !== null && (!Number.isInteger(quantity) || quantity < 0)) || (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0))) {
    return NextResponse.json({ error: "Quantity must be zero or more and time must be positive" }, { status: 400 });
  }
  const deadline = typeof body?.deadline_time === "string" && /^\d{2}:\d{2}$/.test(body.deadline_time) ? body.deadline_time : null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").insert({
    assigned_to: body.assigned_to, assigned_by: actor.id, title, category: body.category,
    scheduled_date: date, quantity_required: quantity, time_allotted_minutes: minutes,
    deadline_time: deadline, priority: body.priority, requires_proof: body.requires_proof === true,
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ task: data }, { status: 201 });
}
