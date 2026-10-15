import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createExport, selectArchitects, type ExportRequest } from "@/lib/server/architect-exports";

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  try {
    const body = await request.json() as ExportRequest & { acknowledgeDuplicate?: boolean; acknowledgePastDate?: boolean };
    const selected = await selectArchitects(body);
    if (selected.duplicates.length && !body.acknowledgeDuplicate) return NextResponse.json({ warning: "duplicate", duplicateExports: selected.duplicates }, { status: 409 });
    if (body.mode === "birthday" && selected.birthdayCampaignDate && selected.birthdayCampaignDate < new Date().toISOString().slice(0, 10) && !body.acknowledgePastDate) return NextResponse.json({ warning: "past_date" }, { status: 409 });
    const result = await createExport(actor.id, body);
    return NextResponse.json({ campaignId: result.campaignId, filename: result.filename, csv: result.csv, contactCount: result.rows.length });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not export architects" }, { status: 400 });
  }
}
