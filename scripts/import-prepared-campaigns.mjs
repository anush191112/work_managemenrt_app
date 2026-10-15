#!/usr/bin/env node
import process from "node:process";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import validation from "../lib/architects/import-validation.js";

const INTEGER_COLUMNS = new Set([
  "serial_start", "serial_end", "total_attempted", "total_delivered_first", "retarget_attempted",
  "retarget_delivered", "total_delivered_final", "total_failed", "total_replies", "total_instagram_clicks",
  "total_whatsapp_channel_clicks", "total_catalog_requests", "total_inquiries", "total_leads",
]);
const DECIMAL_COLUMNS = new Set(["percentage"]);
const BOOLEAN_COLUMNS = new Set(["is_shared"]);

function option(name) { const index = process.argv.indexOf(name); return index === -1 ? null : process.argv[index + 1] ?? null; }
function usage(message) { if (message) console.error(message); console.error("Usage: node scripts/import-prepared-campaigns.mjs --file prepared-imports/campaigns_whatsapp.csv"); process.exit(1); }
function nullable(value, column) {
  if (value === "") return null;
  if (INTEGER_COLUMNS.has(column)) return Number.parseInt(value, 10);
  if (DECIMAL_COLUMNS.has(column)) return Number.parseFloat(value);
  if (BOOLEAN_COLUMNS.has(column)) return value === "true";
  return value;
}

const file = option("--file"); if (!file) usage();
try { process.loadEnvFile(".env.local"); } catch { /* Credentials can instead be supplied by the shell. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) usage("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const rows = validation.csvRows(await readFile(file, "utf8"));
if (rows.length < 2) usage("The campaign CSV must have a header and at least one row.");
const headers = rows[0];
const records = rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, nullable(row[index] ?? "", header)])));
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const existingKeys = new Set();
for (let index = 0; index < records.length; index += 100) {
  const names = records.slice(index, index + 100).map((record) => record.name);
  const { data, error } = await supabase.from("campaigns").select("name, campaign_type, account, campaign_date").in("name", names);
  if (error) throw error;
  for (const row of data ?? []) existingKeys.add(`${row.name}\u0000${row.campaign_type}\u0000${row.account}\u0000${row.campaign_date}`);
}
const pending = records.filter((record) => !existingKeys.has(`${record.name}\u0000${record.campaign_type}\u0000${record.account}\u0000${record.campaign_date}`));
for (let index = 0; index < pending.length; index += 100) {
  const { error } = await supabase.from("campaigns").insert(pending.slice(index, index + 100));
  if (error) throw new Error(`Pending rows ${index + 1}-${Math.min(index + 100, pending.length)}: ${error.message}`);
}
console.log(JSON.stringify({ imported: pending.length, skippedExisting: records.length - pending.length, file }, null, 2));
