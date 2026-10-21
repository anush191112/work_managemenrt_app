import { getCurrentActor } from "@/lib/auth/current-actor";
import { AppNavigation } from "./app-navigation";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) return children;
  return <div className="app-shell"><AppNavigation actor={{ name: actor.name, role: actor.role }} /><div id="main-content" className="app-content" tabIndex={-1}>{children}</div></div>;
}
