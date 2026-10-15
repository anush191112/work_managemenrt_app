"use client";
import { FormEvent, useState } from "react";
import { CAMPAIGN_ACCOUNTS } from "@/lib/campaigns/logic";

type Mode = "state_wise" | "birthday";
export function ArchitectExportClient({ states }: { states: string[] }) {
  const [mode, setMode] = useState<Mode>("state_wise"); const [campaignType, setCampaignType] = useState<"whatsapp" | "email">("whatsapp");
  const [message, setMessage] = useState<string | null>(null); const [warning, setWarning] = useState<string | null>(null); const [payload, setPayload] = useState<Record<string, unknown> | null>(null); const [busy, setBusy] = useState(false);
  const accounts = CAMPAIGN_ACCOUNTS.filter((account) => account.type === (mode === "birthday" ? "whatsapp" : campaignType));
  async function submit(event: FormEvent<HTMLFormElement>, acknowledge = false) {
    event.preventDefault(); setBusy(true); setMessage(null); setWarning(null);
    const fields = new FormData(event.currentTarget);
    const pickedBirthday = String(fields.get("targetDate") ?? ""); const birthdayDate = /^\d{4}-(\d{2})-(\d{2})$/.exec(pickedBirthday);
    const body: Record<string, unknown> = mode === "birthday" ? { mode, targetDate: birthdayDate ? `${birthdayDate[2]}-${birthdayDate[1]}` : "", account: fields.get("account") } : { mode, campaignType, state: fields.get("state"), startingSerial: Number(fields.get("startingSerial")), count: Number(fields.get("count")), campaignDate: fields.get("campaignDate"), account: fields.get("account") };
    if (acknowledge && payload) Object.assign(body, payload, { acknowledgeDuplicate: true, acknowledgePastDate: true });
    const response = await fetch("/api/architect-exports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); setBusy(false);
    if (response.status === 409) { setPayload(body); const firstDate = result.duplicateExports?.[0]?.exportedAt ? new Date(result.duplicateExports[0].exportedAt).toLocaleDateString() : null; setWarning(result.warning === "duplicate" ? `${result.duplicateExports?.length ?? 0} selected contacts were exported for this channel within 30 days${firstDate ? `, including on ${firstDate}` : ""}.` : "You've selected a past date."); return; }
    if (!response.ok) { setMessage(result.error ?? "Could not export"); return; }
    const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); URL.revokeObjectURL(url); setMessage(`${result.contactCount} contacts exported and campaign created.`);
  }
  return <section className="tool-panel"><div className="segmented-control"><button type="button" className={mode === "state_wise" ? "selected" : ""} onClick={() => setMode("state_wise")}>State-wise</button><button type="button" className={mode === "birthday" ? "selected" : ""} onClick={() => setMode("birthday")}>Birthday</button></div><form className="standard-form" onSubmit={submit}>
    {mode === "state_wise" ? <><div className="segmented-control"><button type="button" className={campaignType === "whatsapp" ? "selected" : ""} onClick={() => setCampaignType("whatsapp")}>WhatsApp</button><button type="button" className={campaignType === "email" ? "selected" : ""} onClick={() => setCampaignType("email")}>Email</button></div><label>State<select name="state" required><option value="">Choose state</option>{states.map((state) => <option key={state}>{state}</option>)}</select></label><label>Starting serial number<input name="startingSerial" type="number" min="1" required /></label><label>Count needed<input name="count" type="number" min="1" required /></label><label>Campaign date<input name="campaignDate" type="date" required /></label></> : <label>Birthday date<input name="targetDate" type="date" required /></label>}
    <label>Account<select name="account" required>{accounts.map((account) => <option value={account.value} key={account.value}>{account.label}</option>)}</select></label><button className="primary-action" disabled={busy}>{busy ? "Exporting" : "Create CSV export"}</button>{message ? <p className="action-message">{message}</p> : null}</form>
    {warning ? <div className="warning-box"><p>{warning}</p><button type="button" onClick={(event) => { const form = event.currentTarget.closest("section")?.querySelector("form"); if (form) submit({ preventDefault() {}, currentTarget: form } as unknown as FormEvent<HTMLFormElement>, true); }}>Acknowledge and continue</button></div> : null}
  </section>;
}
