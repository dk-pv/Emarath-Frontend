"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconLayoutList,
  IconReportAnalytics,
  IconTable,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/SegmentedControl";
import { Toolbar } from "@/components/layout/Toolbar";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import type { ReportCategory, ReportDefinition } from "./report-registry";

export type ReportViewMode = "summary" | "detailed";
export type ReportState = "loading" | "empty" | "error" | "ready";

/**
 * The shared Report View shell (RPT-01.2). Every report (RPT-02/03/04) renders inside this:
 * it owns the chrome — header (back, category switcher, report title), toolbar (filter-bar slot
 * + Summary/Detailed toggle + Export), an optional chart region, and the loading/empty/error/
 * ready states — while the report supplies the filters, chart, table and data. Traced from
 * `reports-no-activity-leads-summary-*.png` and `-detailed-*.png`.
 *
 * The shell holds NO business logic: it renders what it is handed and reports state changes
 * through callbacks. `onExport` must run the same role-scoped backend query as the visible
 * report (never a client-side dump of unscoped data). The Workpex kebab (Schedule / Report
 * Scheduler List) is opt-in through `trailingActions`, so a report only shows it when its
 * task asks for it — see `ReportMoreMenu`.
 */
export interface ReportShellProps {
  report: ReportDefinition;
  category: ReportCategory;
  /** Omit both view props for a single-view report — the toggle then never renders. */
  viewMode?: ReportViewMode;
  onViewModeChange?: (mode: ReportViewMode) => void;
  /** Report-supplied filter controls (the shell renders the bar region around them). */
  filterBar?: React.ReactNode;
  /** Extra toolbar controls, e.g. Manage Columns in the detailed view. */
  toolbarActions?: React.ReactNode;
  /**
   * Controls rendered after the Summary/Detailed toggle — the far right of the toolbar.
   * Opt-in so a report that has no kebab menu is visually unchanged.
   */
  trailingActions?: React.ReactNode;
  /** Optional chart region; the area is hidden entirely when a report has no chart. */
  chart?: React.ReactNode;
  /**
   * A side panel beside the results, under the full-width toolbar (Leads By Status' donut
   * and legend). Opt-in: without it the shell is the single column every other report renders.
   */
  aside?: React.ReactNode;
  /** Runs the export for the current view. Omit to disable the Export control. */
  onExport?: () => void;
  exporting?: boolean;
  state: ReportState;
  emptyTitle?: string;
  emptyDescription?: string;
  errorMessage?: string;
  onRetry?: () => void;
  /** The results (table) rendered when `state` is "ready". */
  children?: React.ReactNode;
}

const VIEW_MODES: SegmentedOption<ReportViewMode>[] = [
  { value: "summary", label: "Summary View", icon: IconLayoutList },
  { value: "detailed", label: "Detailed View", icon: IconTable },
];

function ReportViewToggle({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ReportViewMode;
  onViewModeChange: (mode: ReportViewMode) => void;
}) {
  return (
    <SegmentedControl
      aria-label="Report view mode"
      options={VIEW_MODES}
      value={viewMode}
      onChange={onViewModeChange}
      iconOnly
    />
  );
}

function ReportHeader({
  report,
  category,
}: Pick<ReportShellProps, "report" | "category">) {
  const router = useRouter();
  const others = category.reports.length - 1;

  // Every report — Sales included — lives under /reports, so back always returns to that hub.
  const hubHref = "/reports";

  const items: DropdownItem[] = category.reports.map((entry) => ({
    type: "item",
    id: entry.slug,
    label: entry.title,
    selected: entry.slug === report.slug,
    onSelect: () => router.push(entry.href),
  }));

  return (
    <div className="flex items-center gap-3">
      <Link
        href={hubHref}
        aria-label="Back to reports"
        className="flex size-control-md shrink-0 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring"
      >
        <IconArrowLeft size={20} stroke={1.75} aria-hidden="true" />
      </Link>

      <Dropdown
        align="start"
        trigger={
          <span className="flex flex-col text-left">
            <span className="flex items-center gap-1 text-xl font-semibold text-ink">
              {category.title}
              <IconChevronDown size={18} stroke={2} aria-hidden="true" />
            </span>
            <span className="text-xs text-ink-muted">
              {others} More Report{others === 1 ? "" : "s"}
            </span>
          </span>
        }
        items={items}
      />

      <IconChevronRight
        size={20}
        stroke={1.75}
        className="shrink-0 text-ink-subtle"
        aria-hidden="true"
      />
      <h2 className="min-w-0 truncate text-xl font-semibold text-ink">
        {report.title}
      </h2>
    </div>
  );
}

export function ReportShell({
  report,
  category,
  viewMode,
  onViewModeChange,
  filterBar,
  toolbarActions,
  trailingActions,
  chart,
  aside,
  onExport,
  exporting = false,
  state,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "No data matches the current filters.",
  errorMessage,
  onRetry,
  children,
}: ReportShellProps) {
  const results = (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <Toolbar
        className="p-4"
        left={filterBar}
        right={
          <>
            {toolbarActions}
            <button
              type="button"
              onClick={onExport}
              disabled={!onExport || exporting}
              className={cn(
                TOOLBAR_BUTTON_CLASS,
                "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
              )}
            >
              <IconDownload size={18} stroke={1.75} aria-hidden="true" />
              Export
            </button>
            {/* One flex item, so the kebab stays glued to the toggle's right (the reference)
                when the cluster wraps — e.g. Detailed view's extra Manage Columns pill would
                otherwise push it onto a row of its own. */}
            <div className="flex items-center gap-2">
              {viewMode !== undefined && onViewModeChange !== undefined && (
                <ReportViewToggle
                  viewMode={viewMode}
                  onViewModeChange={onViewModeChange}
                />
              )}
              {trailingActions}
            </div>
          </>
        }
      />

      {chart ? (
        <div className="border-t border-hairline p-4">{chart}</div>
      ) : null}

      {/* The reference sits the chart panel beside the results, under a toolbar that spans
          the whole card — the only way its eight controls stay on one row beside an 18rem
          panel. Below lg the panel stacks above the table so the table keeps its width. */}
      <div
        className={cn(
          "border-t border-hairline",
          aside &&
            "grid grid-cols-1 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]",
        )}
      >
        {aside && (
          <section className="min-w-0 border-b border-hairline lg:border-r lg:border-b-0">
            {aside}
          </section>
        )}
        <div className="flex min-h-96 min-w-0 flex-col">
          {state === "loading" && <Loading label="Loading report" />}
          {state === "empty" && (
            <EmptyState
              icon={IconReportAnalytics}
              title={emptyTitle}
              description={emptyDescription}
            />
          )}
          {state === "error" && (
            <ErrorState
              title="Couldn’t load the report"
              description={
                errorMessage ?? "Something went wrong. Please try again."
              }
              onRetry={onRetry ?? (() => {})}
            />
          )}
          {state === "ready" && children}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col gap-4">
      <ReportHeader report={report} category={category} />
      {results}
    </div>
  );
}
