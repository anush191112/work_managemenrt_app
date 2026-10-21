import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/task-engine/types";

const ROLES: UserRole[] = ["admin", "manager", "employee"];

function isExistingEmailError(message: string | undefined) {
  return /already.*(?:registered|exists)|duplicate/i.test(message ?? "");
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return { user: null, error };

    const users = data.users;
    const user = users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user) return { user, error: null };
    if (users.length < 1000) return { user: null, error: null };

    page += 1;
  }
}

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (actor?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can create users" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = typeof body?.role === "string" && ROLES.includes(body.role as UserRole) ? body.role as UserRole : "employee";
  if (!email || !name || password.length < 8) {
    return NextResponse.json({ error: "Enter a name, a valid email, and a password of at least 8 characters" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (!error && data.user) {
    const { data: profile, error: profileError } = await admin.from("users").update({ role }).eq("id", data.user.id).select("id").maybeSingle();
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
    if (!profile) {
      const { error: insertError } = await admin.from("users").insert({ id: data.user.id, name, email, role });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
    return NextResponse.json({ user: { id: data.user.id, email: data.user.email } }, { status: 201 });
  }

  if (!isExistingEmailError(error?.message)) {
    return NextResponse.json({ error: error?.message ?? "Could not create user" }, { status: 400 });
  }

  const existing = await findAuthUserByEmail(admin, email);
  if (existing.error) {
    return NextResponse.json({ error: existing.error.message }, { status: 400 });
  }
  if (!existing.user) {
    return NextResponse.json({ error: error?.message ?? "Could not create user" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id")
    .eq("id", existing.user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }
  if (profile) {
    return NextResponse.json({ error: "A user with this email address has already been registered" }, { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...existing.user.user_metadata, name },
  });
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { error: restoreError } = await admin
    .from("users")
    .insert({ id: existing.user.id, name, email, role });
  if (restoreError) {
    return NextResponse.json({ error: restoreError.message }, { status: 400 });
  }

  return NextResponse.json(
    { user: { id: existing.user.id, email: existing.user.email }, restored: true },
    { status: 201 },
  );
}
