"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteTaskButton({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function removeTask() {
    if (!window.confirm(`Delete “${taskTitle}”? This cannot be undone.`)) return;
    setBusy(true);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      window.alert(result?.error ?? "Could not delete task");
      return;
    }
    router.refresh();
  }

  return <button type="button" className="icon-button lead-delete" title={`Delete ${taskTitle}`} aria-label={`Delete ${taskTitle}`} onClick={removeTask} disabled={busy}><Trash2 size={17} aria-hidden="true" /></button>;
}
