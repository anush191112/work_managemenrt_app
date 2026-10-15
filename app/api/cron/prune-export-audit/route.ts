import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/server/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await createAdminClient().from("architect_export_logs").delete().lt("exported_at", new Date(Date.now() - 30 * 86400_000).toISOString());
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true });
}
