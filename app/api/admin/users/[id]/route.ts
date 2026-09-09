import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/task-engine/types";

const ROLES: UserRole[] = ["admin", "manager", "employee"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can update users" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    role?: unknown;
    manager_id?: unknown;
    work_days?: unknown;
  } | null;
  const updates: { role?: UserRole; manager_id?: string | null; work_days?: number[] } = {};
  const role = body?.role;
  if (typeof role === "string" && ROLES.includes(role as UserRole)) updates.role = role as UserRole;
  if (body?.manager_id === null || typeof body?.manager_id === "string") updates.manager_id = body.manager_id;
  if (Array.isArray(body?.work_days) && body.work_days.length > 0 && body.work_days.every((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6)) updates.work_days = body.work_days;
  if (Object.keys(updates).length === 0 || id === actor.id && updates.role && updates.role !== "admin") {
    return NextResponse.json({ error: "No valid user changes were provided" }, { status: 400 });
  }

  const { data, error } = await createAdminClient().from("users").update(updates).eq("id", id).select("id").single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Could not update user" }, { status: 400 });
  return NextResponse.json({ user: data });
}
