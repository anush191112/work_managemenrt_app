"use client";

import { Activity, CalendarDays, FileDown, FileUp, LayoutDashboard, LogOut, Menu, Moon, ShieldBan, Users, X, ClipboardList, ContactRound, BarChart3 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { BrandLogo } from "./brand-logo";

type Role = "admin" | "manager" | "employee";
type NavigationActor = { name: string; role: Role };
type Item = { href: string; label: string; icon: typeof LayoutDashboard; roles?: Role[] };

const groups: Array<{ label: string; items: Item[] }> = [
  { label: "Work", items: [{ href: "/dashboard", label: "Today", icon: LayoutDashboard }, { href: "/templates", label: "Templates", icon: ClipboardList, roles: ["admin", "manager"] }, { href: "/calendar", label: "Calendar", icon: CalendarDays }] },
  { label: "Campaigns", items: [{ href: "/campaigns", label: "Campaigns", icon: ContactRound }, { href: "/leads", label: "Leads", icon: ContactRound }, { href: "/lead-export", label: "Lead CSV export", icon: FileDown }, { href: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] }, { href: "/activity", label: "Activity", icon: Activity, roles: ["admin", "manager"] }] },
  { label: "Architect database", items: [{ href: "/architect-import", label: "Import architects", icon: FileUp }, { href: "/architect-export", label: "CSV export", icon: FileDown }, { href: "/contact-preferences", label: "Do not contact", icon: ShieldBan }, { href: "/export-audit", label: "Export audit", icon: ClipboardList, roles: ["admin", "manager"] }] },
  { label: "Admin", items: [{ href: "/users", label: "Users", icon: Users, roles: ["admin"] }] },
];

function allowed(item: Item, role: Role) { return !item.roles || item.roles.includes(role); }

export function AppNavigation({ actor }: { actor: NavigationActor }) {
  const path = usePathname(); const [open, setOpen] = useState(false); const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  useEffect(() => { if (!open) toggle.current?.focus(); }, [open]);
  return <>
    <header className="mobile-topbar"><button ref={toggle} className="secondary-button" type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="app-navigation"><Menu size={18} aria-hidden="true" />Menu</button><strong>Outreach Desk</strong><ThemeToggle /></header>
    {open ? <button className="drawer-backdrop" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
    <aside id="app-navigation" className={`app-sidebar ${open ? "is-open" : ""}`} aria-label="Primary navigation">
      <div className="sidebar-brand"><BrandLogo compact /><button className="icon-button close-menu" type="button" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} aria-hidden="true" /></button></div>
      <nav>{groups.map((group) => { const items = group.items.filter((item) => allowed(item, actor.role)); return items.length ? <section className="nav-group" key={group.label}><p>{group.label}</p>{items.map((item) => { const Icon = item.icon; const current = path === item.href || (item.href !== "/dashboard" && path.startsWith(`${item.href}/`)); return <Link key={item.href} href={item.href} className={current ? "active" : ""} aria-current={current ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={18} aria-hidden="true" />{item.label}</Link>; })}</section> : null; })}</nav>
      <div className="sidebar-footer"><div><strong>{actor.name}</strong><span>{actor.role}</span></div><ThemeToggle /><form action="/auth/signout" method="post"><button className="secondary-button" type="submit"><LogOut size={17} aria-hidden="true" />Log out</button></form></div>
    </aside>
  </>;
}
