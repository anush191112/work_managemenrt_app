import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createLeadExport } from "@/lib/server/lead-exports";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });

  try {
    const result = await createLeadExport(actor.id, await request.json().catch(() => ({})));
    return NextResponse.json(result);
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not export leads" }, { status: 400 });
  }
}
