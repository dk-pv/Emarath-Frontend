"use client";

import { useCallback } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { findReport } from "./report-registry";
import { ReportShell, type ReportViewMode } from "./report-shell";

const VIEW_MODES: ReportViewMode[] = ["summary", "detailed"];

/**
 * Host for a report route whose body is not built yet (RPT-01.2). Resolves the report from the
 * registry and renders it in the shared shell: the chrome is fully live (header, category
 * switcher, Summary/Detailed toggle, Export slot) and the results region shows the empty state —
 * never fabricated rows, filters or states. Each report task (RPT-02/03/04) replaces this body
 * with its scoped query, filters, chart and table.
 *
 * `view` lives in the URL so the toggle behaves exactly as it does on a built report.
 */
export function ReportView({
  category,
  slug,
}: {
  category: string;
  slug: string;
}) {
  const resolved = findReport(category, slug);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setView = useCallback(
    (mode: ReportViewMode) => {
      const next = new URLSearchParams(params);
      next.set("view", mode);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  if (!resolved) notFound();

  const viewParam = params.get("view");
  const viewMode: ReportViewMode = VIEW_MODES.includes(
    viewParam as ReportViewMode,
  )
    ? (viewParam as ReportViewMode)
    : "summary";

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      viewMode={viewMode}
      onViewModeChange={setView}
      state="empty"
      emptyTitle="Report coming soon"
      emptyDescription="This report’s data will appear here once the report is built. The filters and export activate with it."
    />
  );
}
