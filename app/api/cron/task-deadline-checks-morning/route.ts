import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/server/cron-auth";
import { refreshDeadlineAlerts } from "@/lib/server/refresh-deadline-alerts";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await refreshDeadlineAlerts();
  return NextResponse.json({ ok: true });
}
