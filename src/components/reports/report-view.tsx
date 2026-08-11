"use client";

import { useCallback } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { findReport } from "./report-registry";
import { ReportFilterBar } from "./report-toolbar";
import {
  ReportShell,
  type ReportState,
  type ReportViewMode,
} from "./report-shell";

const VIEW_MODES: ReportViewMode[] = ["summary", "detailed"];
const PREVIEW_STATES: ReportState[] = ["empty", "loading", "error", "ready"];

/**
 * Host for a report route (RPT-01.2). Resolves the report from the registry and renders it in
 * the shared shell. This is the placeholder every not-yet-built report shows: the shell chrome
 * is fully live (header, category switcher, filter bar, Summary/Detailed toggle, Export slot,
 * states) but there is NO data — the results region shows the empty state, never fabricated
 * rows. Each report task (RPT-02/03/04) replaces this body with its scoped query, chart and table.
 *
 * `view` and `state` live in the URL: `view` is the real Summary/Detailed toggle; `state` is a
 * shell-state preview so the loading/empty/error chrome can be reviewed before any report exists
 * (it only swaps the placeholder chrome — it never invents data).
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

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params);
      next.set(key, value);
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

  const stateParam = params.get("state");
  const state: ReportState = PREVIEW_STATES.includes(stateParam as ReportState)
    ? (stateParam as ReportState)
    : "empty";

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      viewMode={viewMode}
      onViewModeChange={(mode) => setParam("view", mode)}
      filterBar={<ReportFilterBar />}
      state={state}
      emptyTitle="Report coming soon"
      emptyDescription="This report’s data will appear here once the report is built. The view, filters and export activate with it."
      errorMessage="This is a preview of the shell’s error state."
      onRetry={() => setParam("state", "empty")}
    >
      {/* state === "ready" is only reachable via the ?state preview; a built report supplies its
          own table here. */}
      <p className="p-6 text-sm text-ink-muted">
        Results table renders here once the report is built.
      </p>
    </ReportShell>
  );
}
