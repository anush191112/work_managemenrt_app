import { NextResponse } from "next/server";
import { parseArchitectCsv, prepareCleanImport } from "@/lib/architects/import-validation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["text/csv", "text/plain", "application/vnd.ms-excel", ""]);

export async function POST(request: Request) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "Authentication is required" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size === 0 || file.size > MAX_FILE_SIZE || !ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Upload a non-empty CSV file up to 10 MB" }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${actor.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.csv`;
  const { error: uploadError } = await admin.storage.from("architect-imports").upload(path, file, { contentType: file.type || "text/csv", upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: download, error: downloadError } = await admin.storage.from("architect-imports").download(path);
  if (downloadError || !download) return NextResponse.json({ error: downloadError?.message ?? "Could not retrieve uploaded CSV" }, { status: 500 });
  const csv = await download.text();
  const parsed = parseArchitectCsv(csv);
  if ("error" in parsed) return NextResponse.json({ rejected: true, reason: parsed.error, rejectedRows: [], skipped: [], imported: 0 }, { status: 400 });

  const states = [...new Set(parsed.records.map((row) => row.state))];
  const { data: stateRows, error: stateError } = await admin.from("architects").select("state, serial_no").in("state", states);
  if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 });
  const phones = [...new Set(parsed.records.flatMap((row) => row.phone ? [row.phone] : []))];
  const { data: phoneRows, error: phoneError } = phones.length ? await admin.from("architects").select("name, phone").in("phone", phones) : { data: [], error: null };
  if (phoneError) return NextResponse.json({ error: phoneError.message }, { status: 500 });

  const result = prepareCleanImport(csv, stateRows ?? [], phoneRows ?? []);
  if (result.rejected) return NextResponse.json({ rejected: true, reason: result.reason, rejectedRows: result.rejectedRows, skipped: [], imported: 0 }, { status: 409 });
  if (result.rows.length) {
    const { error } = await admin.from("architects").insert(result.rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ rejected: false, imported: result.rows.length, skipped: result.skipped, rejectedRows: [], stored: true });
}
