#!/usr/bin/env node
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import validation from "../lib/architects/import-validation.js";

function option(name) { const index = process.argv.indexOf(name); return index === -1 ? null : process.argv[index + 1] ?? null; }
function usage(message) { if (message) console.error(message); console.error("Usage: node scripts/import-architects.mjs --mode strict|clean --file architects.csv"); process.exit(1); }
function csvRows(text) { const rows = []; let row = []; let value = ""; let quoted = false; for (let i = 0; i < text.length; i += 1) { const char = text[i]; if (char === '"') { if (quoted && text[i + 1] === '"') { value += char; i += 1; } else quoted = !quoted; } else if (char === "," && !quoted) { row.push(value.trim()); value = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && text[i + 1] === "\n") i += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ""; } else value += char; } row.push(value.trim()); if (row.some(Boolean)) rows.push(row); return rows; }
function normalizePhone(value) { const digits = String(value ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, ""); return /^[6-9]\d{9}$/.test(digits) && !/^(\d)\1{9}$/.test(digits) ? digits : null; }
function normalizeEmail(value) { const email = String(value ?? "").trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
function normalizedHeader(value) { return value.trim().toLowerCase().replace(/[ _-]/g, ""); }
function rowObject(headers, row) { return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])); }
function field(row, ...names) { return names.map((name) => row[name]).find((value) => value !== undefined) ?? ""; }

const mode = option("--mode"); const file = option("--file"); if ((mode !== "strict" && mode !== "clean") || !file) usage();
try { process.loadEnvFile(".env.local"); } catch { /* Vercel credentials may instead be in the shell. */ }
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) usage("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const text = await (await import("node:fs/promises")).readFile(file, "utf8"); const rows = csvRows(text); if (rows.length < 2) usage("CSV must have a header and at least one data row.");
if (mode === "clean") {
  const parsed = validation.parseArchitectCsv(text);
  if ("error" in parsed) usage(parsed.error);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const states = [...new Set(parsed.records.map((row) => row.state))];
  const { data: stateRows, error: pairsError } = await supabase.from("architects").select("state, serial_no").in("state", states);
  if (pairsError) throw pairsError;
  const phones = [...new Set(parsed.records.flatMap((row) => row.phone ? [row.phone] : []))];
  const { data: phoneRows, error: phonesError } = phones.length ? await supabase.from("architects").select("name, phone").in("phone", phones) : { data: [], error: null };
  if (phonesError) throw phonesError;
  const result = validation.prepareCleanImport(text, stateRows ?? [], phoneRows ?? []);
  if (result.rejected) usage(`${result.reason} ${result.rejectedRows.map((row) => `line ${row.line ?? "existing record"}: ${row.reason}`).join("; ")}`);
  if (result.rows.length) { const { error } = await supabase.from("architects").insert(result.rows); if (error) throw error; }
  console.log(JSON.stringify({ inserted: result.rows.length, skippedLines: result.skipped.map((row) => row.line), mode }, null, 2));
  process.exit(0);
}
const headers = rows[0].map(normalizedHeader); const source = rows.slice(1).map((row, index) => ({ line: index + 2, ...rowObject(headers, row) }));
const records = source.map((row) => ({ line: row.line, state: String(field(row, "state")).trim(), serial_no: Number(field(row, "serialno", "serialnumber", "serial")), name: String(field(row, "name")).trim(), phone: normalizePhone(field(row, "phone", "phonenumber", "mobile", "mobilenumber")), email: normalizeEmail(field(row, "email", "emailaddress")), address: String(field(row, "address")).trim() || null, birthdate: String(field(row, "birthdate", "dob")).trim() || null }));
const invalidBasics = records.filter((row) => !row.state || !Number.isInteger(row.serial_no) || row.serial_no < 1 || !row.name || (mode === "strict" && (!row.phone && !row.email)) || (mode === "strict" && !row.phone && String(field(source[row.line - 2], "phone", "phonenumber", "mobile", "mobilenumber")).trim()));
const duplicatesInFile = records.filter((row, index) => records.findIndex((other) => other.state === row.state && other.serial_no === row.serial_no) !== index);
if (invalidBasics.length || duplicatesInFile.length) usage(`Invalid rows: ${invalidBasics.map((row) => row.line).join(", ") || "none"}; duplicate state/serial rows: ${duplicatesInFile.map((row) => row.line).join(", ") || "none"}`);
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const states = [...new Set(records.map((row) => row.state))];
const { data: stateRows, error: pairsError } = await supabase.from("architects").select("state, serial_no").in("state", states);
if (pairsError) throw pairsError; const requestedPairs = new Set(records.map((row) => `${row.state}\u0000${row.serial_no}`)); const existingPairs = (stateRows ?? []).filter((row) => requestedPairs.has(`${row.state}\u0000${row.serial_no}`)); if (existingPairs.length) usage(`File rejected: state/serial pairs already exist: ${existingPairs.map((row) => `${row.state}/${row.serial_no}`).join(", ")}`);
const phones = [...new Set(records.flatMap((row) => row.phone ? [row.phone] : []))]; const { data: existingPhones, error: phonesError } = phones.length ? await supabase.from("architects").select("phone").in("phone", phones) : { data: [], error: null }; if (phonesError) throw phonesError;
const phoneSet = new Set((existingPhones ?? []).flatMap((row) => row.phone ? [row.phone] : [])); const seenPhones = new Set(); const toInsert = []; const skipped = [];
for (const row of records) { let phone = row.phone; if (mode === "clean" && phone && (phoneSet.has(phone) || seenPhones.has(phone))) phone = null; if (phone) seenPhones.add(phone); if (!phone && !row.email) { if (mode === "strict") usage(`Invalid contact at line ${row.line}`); skipped.push(row.line); continue; } toInsert.push({ state: row.state, serial_no: row.serial_no, name: row.name, phone, email: row.email, address: row.address, birthdate: row.birthdate || null }); }
if (!toInsert.length) usage("No valid rows remain to import."); const { error: insertError } = await supabase.from("architects").insert(toInsert); if (insertError) throw insertError;
console.log(JSON.stringify({ inserted: toInsert.length, skippedLines: skipped, mode }, null, 2));
