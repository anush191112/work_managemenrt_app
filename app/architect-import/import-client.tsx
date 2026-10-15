"use client";
import { ChangeEvent, useState } from "react";

type Issue = { line: number | null; reason: string };
type Result = { imported: number; skipped: Issue[]; rejectedRows: Issue[]; reason?: string | null; rejected?: boolean };

export function ArchitectImportClient() {
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [result, setResult] = useState<Result | null>(null);
  function chooseFile(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0] ?? null); setError(null); setResult(null); }
  async function upload() {
    if (!file) { setError("Choose a CSV file first"); return; }
    setBusy(true); setError(null); setResult(null);
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/architect-imports", { method: "POST", body: form }); const body = await response.json(); setBusy(false);
    if (body.rejected) { setResult(body); return; }
    if (!response.ok) { setError(body.error ?? "Could not import architects"); return; }
    setResult(body);
  }
  return <section className="tool-panel"><div className="standard-form"><label className="file-drop-zone">Architect CSV<input type="file" accept=".csv,text/csv" onChange={chooseFile} /><span>{file ? file.name : "Choose a CSV file"}</span></label><button type="button" className="primary-action" onClick={upload} disabled={busy}>{busy ? "Uploading and validating" : "Upload and import"}</button>{error ? <p className="error" role="alert">{error}</p> : null}</div>{result ? <section className={result.rejected ? "import-result rejected" : "import-result"} role="status"><h2>{result.rejected ? "Import rejected" : "Import complete"}</h2>{result.reason ? <p>{result.reason}</p> : null}{!result.rejected ? <p>{result.imported} row{result.imported === 1 ? "" : "s"} imported.</p> : null}{result.skipped.length ? <IssueList title="Skipped rows" issues={result.skipped} /> : null}{result.rejectedRows.length ? <IssueList title="Rejected rows" issues={result.rejectedRows} /> : null}</section> : null}</section>;
}
function IssueList({ title, issues }: { title: string; issues: Issue[] }) { return <div className="import-issues"><h3>{title}</h3><ul>{issues.map((issue, index) => <li key={`${issue.line}-${index}`}>{issue.line === null ? "Existing record" : `Line ${issue.line}`}: {issue.reason}</li>)}</ul></div>; }
