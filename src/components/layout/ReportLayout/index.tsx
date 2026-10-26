"use client";

import { useState } from "react";
import { ReportSidebar } from "./report-sidebar";

/**
 * The frame the Analytics reports open in — Workpex's second shell, which a report gets in its
 * own browser tab: the report sidebar and the report itself on white, with no app navbar (the
 * report header is the page's top bar). Viewport-high with Content as the only scroller, as in
 * `AppLayout`. Like Workpex, every report tab opens with the sidebar hidden behind its handle;
 * the state is per tab and not stored, so expanding it in one tab never opens the next one wide.
 */
export function ReportLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="flex h-dvh overflow-hidden">
      <ReportSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
      />
      {/* data-app-main: overlays such as the date panel clamp themselves inside this column. */}
      <main
        data-app-main
        className="min-h-0 min-w-0 flex-1 overflow-auto bg-surface"
      >
        {children}
      </main>
    </div>
  );
}
