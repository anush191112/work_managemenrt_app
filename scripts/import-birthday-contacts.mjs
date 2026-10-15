#!/usr/bin/env node
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import validation from "../lib/architects/import-validation.js";

function option(name) { const index = process.argv.indexOf(name); return index === -1 ? null : process.argv[index + 1] ?? null; }
function usage(message) { if (message) console.error(message); console.error("Usage: node scripts/import-birthday-contacts.mjs --file birthday-contacts.csv"); process.exit(1); }

const file = option("--file"); if (!file) usage();
try { process.loadEnvFile(".env.local"); } catch { /* Credentials can be supplied by the shell. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) usage("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const text = await (await import("node:fs/promises")).readFile(file, "utf8");
const parsed = validation.parseBirthdayContactsCsv(text); if ("error" in parsed) usage(parsed.error);
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const phones = [...new Set(parsed.records.flatMap((row) => row.phone ? [row.phone] : []))];
const { data: existing, error: existingError } = phones.length ? await supabase.from("birthday_contacts").select("phone").in("phone", phones) : { data: [], error: null };
if (existingError) throw existingError;
const result = validation.prepareBirthdayContactsImport(text, (existing ?? []).map((row) => row.phone));
if (result.rows.length) { const { error } = await supabase.from("birthday_contacts").insert(result.rows); if (error) throw error; }
console.log(JSON.stringify({ inserted: result.rows.length, skipped: result.skipped, mode: "birthday-contacts" }, null, 2));
