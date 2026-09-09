import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { createClient } from "@/lib/supabase/server";
import { currentIstDate } from "@/lib/task-engine/ist-date";
import { HolidayDeleteButton, HolidayForm, OffDayRequestForm, OffDayRequests, type OffDayItem } from "./calendar-client";

export default async function CalendarPage() {
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");
  const canApprove = actor.role !== "employee";
  const today = currentIstDate();
  const supabase = await createClient();
  const [{ data: requestRows }, { data: holidayRows }, { data: users }] = await Promise.all([
    supabase.from("off_day_requests").select("id, user_id, date, reason, status").gte("date", today).order("date").limit(30),
    supabase.from("holidays").select("id, date, label, applies_to").gte("date", today).order("date").limit(30),
    supabase.from("users").select("id, name"),
  ]);
  const names = new Map((users ?? []).map((user) => [user.id, user.name]));
  const requests: OffDayItem[] = (requestRows ?? []).map((request) => ({ ...request, name: names.get(request.user_id) ?? "Team member" })) as OffDayItem[];

  return <main className="dashboard-shell">
    <header className="dashboard-header"><div><p className="eyebrow">Availability</p><h1>Calendar</h1></div><Link className="back-link" href="/dashboard">Back to today</Link></header>
    <div className="calendar-layout">
      <section><h2>Request an off-day</h2><OffDayRequestForm /></section>
      <section>{canApprove ? <><h2>Add holiday</h2><HolidayForm users={users ?? []} canCreateCompanyHoliday={actor.role === "admin"} /></> : <><h2>Upcoming holidays</h2>{holidayRows?.length ? <div className="holiday-list">{holidayRows.map((holiday) => <div key={holiday.id}><strong>{holiday.date}</strong><span>{holiday.label}</span></div>)}</div> : <p className="empty-state">No upcoming holidays added.</p>}</>}</section>
    </div>
    {canApprove ? <section className="holidays-section"><h2>Upcoming holidays</h2>{holidayRows?.length ? <div className="holiday-list">{holidayRows.map((holiday) => <div key={holiday.id}><strong>{holiday.date}</strong><span>{holiday.label}{holiday.applies_to ? ` · ${holiday.applies_to.map((id: string) => names.get(id) ?? "Team member").join(", ")}` : " · Everyone"}</span><HolidayDeleteButton id={holiday.id} /></div>)}</div> : <p className="empty-state">No upcoming holidays added.</p>}</section> : null}
    <section className="requests-section"><h2>{canApprove ? "Off-day requests" : "My off-day requests"}</h2><OffDayRequests items={requests} canApprove={canApprove} currentUserId={actor.id} /></section>
  </main>;
}
