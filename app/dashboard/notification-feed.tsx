"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Notification {
  id: string;
  type: "deadline_approaching" | "deadline_missed" | "at_risk" | "blocker_raised" | "task_assigned";
  message: string;
  is_read: boolean;
}

export function NotificationFeed({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const unread = notifications.filter((notification) => !notification.is_read);

  async function markAllRead() {
    if (!unread.length) return;
    setBusy(true);
    await fetch("/api/notifications/read", { method: "PATCH" });
    setBusy(false);
    router.refresh();
  }

  return <details className="notification-feed">
    <summary className="icon-button" title="Notifications" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}>
      <Bell size={17} aria-hidden="true" />
      {unread.length ? <span className="notification-count">{unread.length}</span> : null}
    </summary>
    <div className="notification-panel">
      <div className="notification-heading"><strong>Notifications</strong>{unread.length ? <button className="icon-button" type="button" title="Mark all as read" aria-label="Mark all as read" onClick={markAllRead} disabled={busy}><CheckCheck size={17} aria-hidden="true" /></button> : null}</div>
      {notifications.length ? <div className="notification-list">{notifications.map((notification) => <p className={notification.is_read ? "notification-read" : ""} key={notification.id}>{notification.message}</p>)}</div> : <p className="notification-empty">No notifications yet.</p>}
    </div>
  </details>;
}
