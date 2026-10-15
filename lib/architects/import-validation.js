function normalizePhone(value) {
  const source = typeof value === "number" && Number.isInteger(value) ? String(value) : String(value ?? "").replace(/\.0+$/, "");
  const digits = source.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) && !/^(\d)\1{9}$/.test(digits) ? digits : null;
}

function normalizeEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function csvRows(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { value += character; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { row.push(value.trim()); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = "";
    } else value += character;
  }
  row.push(value.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizedHeader(value) { return value.trim().toLowerCase().replace(/[ _-]/g, ""); }
function field(row, ...names) { return names.map((name) => row[name]).find((value) => value !== undefined) ?? ""; }

function normalizeBirthdate(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
  if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCFullYear() === 2000 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `2000-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null;
}

function parseArchitectCsv(text) {
  const rows = csvRows(text);
  if (rows.length < 2) return { error: "CSV must have a header and at least one data row." };
  const headers = rows[0].map(normalizedHeader);
  const source = rows.slice(1).map((row, index) => Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]).concat([["line", index + 2]])));
  const records = source.map((row) => ({
    line: Number(row.line), state: String(field(row, "state")).trim(), serial_no: Number(field(row, "serialno", "serialnumber", "serial")), name: String(field(row, "fullname", "name")).trim(),
    phone: normalizePhone(field(row, "phone", "phonenumber", "mobile", "mobilenumber")), email: normalizeEmail(field(row, "email", "emailaddress")),
    address: String(field(row, "address")).trim() || null, birthdate: normalizeBirthdate(field(row, "birthday", "birthdate", "dob")),
  }));
  const invalidRows = records.filter((row) => !row.state || !Number.isInteger(row.serial_no) || row.serial_no < 1 || !row.name).map((row) => ({ line: row.line, reason: "State, positive serial number, and name are required" }));
  const seenPairs = new Set(); const duplicatePairs = [];
  for (const row of records) {
    const key = `${row.state}\u0000${row.serial_no}`;
    if (seenPairs.has(key)) duplicatePairs.push({ line: row.line, state: row.state, serial_no: row.serial_no });
    seenPairs.add(key);
  }
  return { records, invalidRows, duplicatePairs };
}

function prepareCleanImport(text, existingPairs, existingPhones) {
  const parsed = parseArchitectCsv(text);
  if (parsed.error) return { rejected: true, reason: parsed.error, rejectedRows: [], rows: [], skipped: [] };
  if (parsed.invalidRows.length || parsed.duplicatePairs.length) return {
    rejected: true,
    reason: "The file has invalid required fields or duplicate state/serial pairs.",
    rejectedRows: [...parsed.invalidRows, ...parsed.duplicatePairs.map((row) => ({ line: row.line, reason: `Duplicate state/serial: ${row.state}/${row.serial_no}` }))], rows: [], skipped: [],
  };
  const requestedPairs = new Set(parsed.records.map((row) => `${row.state}\u0000${row.serial_no}`));
  const existing = existingPairs.filter((row) => requestedPairs.has(`${row.state}\u0000${row.serial_no}`));
  if (existing.length) return {
    rejected: true, reason: "The file contains state/serial pairs already in the database.",
    rejectedRows: existing.map((row) => ({ line: null, reason: `Already exists: ${row.state}/${row.serial_no}` })), rows: [], skipped: [],
  };
  const knownPairs = new Set(existingPhones.filter((row) => row.phone).map((row) => `${row.name}\u0000${row.phone}`)); const seenPairs = new Set(); const rows = []; const skipped = [];
  for (const record of parsed.records) {
    let phone = record.phone;
    if (phone && (knownPairs.has(`${record.name}\u0000${phone}`) || seenPairs.has(`${record.name}\u0000${phone}`))) { skipped.push({ line: record.line, reason: "Duplicate name and phone pair" }); continue; }
    if (phone) seenPairs.add(`${record.name}\u0000${phone}`);
    if (!phone && !record.email) { skipped.push({ line: record.line, reason: "No valid phone or email after cleaning" }); continue; }
    rows.push({ state: record.state, serial_no: record.serial_no, name: record.name, phone, email: record.email, address: record.address, birthdate: record.birthdate || null });
  }
  return { rejected: false, reason: null, rejectedRows: [], rows, skipped };
}

function parseBirthdayContactsCsv(text) {
  const rows = csvRows(text);
  if (rows.length < 2) return { error: "CSV must have a header and at least one data row." };
  const headers = rows[0].map(normalizedHeader);
  const records = rows.slice(1).map((row, index) => {
    const source = Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]));
    return { line: index + 2, name: String(field(source, "fullname", "name")).trim(), phone: normalizePhone(field(source, "phone", "phonenumber", "mobile", "mobilenumber")), email: normalizeEmail(field(source, "email", "emailaddress")), address: String(field(source, "address")).trim() || null, birthdate: normalizeBirthdate(field(source, "birthday", "birthdate", "dob")) };
  });
  return { records };
}

function prepareBirthdayContactsImport(text, existingPhones) {
  const parsed = parseBirthdayContactsCsv(text);
  if (parsed.error) return { rejected: true, reason: parsed.error, rejectedRows: [], rows: [], skipped: [] };
  const knownPhones = new Set(existingPhones.filter(Boolean)); const seen = new Set(); const rows = []; const skipped = [];
  for (const record of parsed.records) {
    if (!record.name || !record.phone || !record.birthdate) { skipped.push({ line: record.line, reason: "Name, valid phone, and valid birthday are required" }); continue; }
    if (knownPhones.has(record.phone) || seen.has(record.phone)) { skipped.push({ line: record.line, reason: "Duplicate phone in birthday contacts" }); continue; }
    seen.add(record.phone); rows.push({ name: record.name, phone: record.phone, email: record.email, address: record.address, birthdate: record.birthdate });
  }
  return { rejected: false, reason: null, rejectedRows: [], rows, skipped };
}

module.exports = { normalizePhone, normalizeEmail, csvRows, parseArchitectCsv, prepareCleanImport, parseBirthdayContactsCsv, prepareBirthdayContactsImport, normalizeBirthdate };
