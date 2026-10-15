import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { selectArchitects, type ExportRequest } from "@/lib/server/architect-exports";

export async function POST(request: Request) {
  if (!await getCurrentActor()) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });
  try {
    const selected = await selectArchitects(await request.json() as ExportRequest);
    return NextResponse.json({ contactCount: selected.rows.length, filename: selected.filename, duplicateExports: selected.duplicates, contacts: selected.rows.map(({ id, name, state, serial_no }) => ({ id, name, state, serial_no })) });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Could not prepare export" }, { status: 400 });
  }
}
