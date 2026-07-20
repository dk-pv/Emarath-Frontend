"use client";

import { Content } from "../Content";
import { Navbar } from "../Navbar";
import { Sidebar } from "../Sidebar";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { SIDEBAR_COLLAPSED_KEY } from "@/constants/storage";

/**
 * The frame every module renders inside.
 *
 * `h-dvh` + `overflow-hidden` makes the shell exactly viewport-height and hands the
 * only scrollbar to Content, so the sidebar and navbar are effectively fixed while
 * remaining in flow — no overlap, and no layout shift when content grows.
 *
 * `children` is passed through from a Server Component layout, so pages stay server
 * components even though the shell needs client state for the collapse toggle.
 *
 * The sidebar is a compact rail by default and expands on the toggle; the choice
 * persists per browser. The default renders on the server and the first client
 * paint (the persistent store reads `null` there), so markup agrees before the
 * stored value is adopted.
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = usePersistentState(
    SIDEBAR_COLLAPSED_KEY,
    true,
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <Content>{children}</Content>
      </div>
    </div>
  );
}
