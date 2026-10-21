"use client";

import { FormEvent, useState } from "react";
import { CAMPAIGN_ACCOUNTS } from "@/lib/campaigns/logic";

export function LeadExportClient() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const accounts = CAMPAIGN_ACCOUNTS.filter((account) => account.type === "whatsapp");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const fields = new FormData(event.currentTarget);
    const response = await fetch("/api/lead-exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ startDate: fields.get("startDate"), endDate: fields.get("endDate"), account: fields.get("account") }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setMessage(result.error ?? "Could not export leads"); return; }
    const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url);
    setMessage(`${result.contactCount} leads exported and campaign ${result.filename.replace(".csv", "")} created.`);
  }

  return <form className="tool-panel lead-export-form" onSubmit={submit}>
    <p className="field-helper">Leave the start date blank to export every lead marked up to the selected end date.</p>
    <label>Start date (optional)<input name="startDate" type="date" /></label>
    <label>End date<input name="endDate" type="date" required /></label>
    <label>WhatsApp account<select name="account" required>{accounts.map((account) => <option key={account.value} value={account.value}>{account.label}</option>)}</select></label>
    <button className="primary-action" disabled={busy}>{busy ? "Preparing export" : "Export leads"}</button>
    {message ? <p className={message.includes("exported") ? "success-message" : "error"} role="status">{message}</p> : null}
  </form>;
}
