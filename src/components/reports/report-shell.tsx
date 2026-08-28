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
  viewMode: ReportViewMode;
  onViewModeChange: (mode: ReportViewMode) => void;
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
}: Pick<ReportShellProps, "viewMode" | "onViewModeChange">) {
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

  // The hub this report belongs to — `/reports` or `/analytics` — from the first href segment,
  // so the back button returns to the correct hub for either module.
  const hubHref = `/${report.href.split("/")[1]}`;

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
  onExport,
  exporting = false,
  state,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "No data matches the current filters.",
  errorMessage,
  onRetry,
  children,
}: ReportShellProps) {
  return (
    <div className="flex flex-col gap-4">
      <ReportHeader report={report} category={category} />

      <Card className="flex flex-col overflow-hidden">
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
              <ReportViewToggle
                viewMode={viewMode}
                onViewModeChange={onViewModeChange}
              />
              {trailingActions}
            </>
          }
        />

        {chart ? (
          <div className="border-t border-hairline p-4">{chart}</div>
        ) : null}

        <div className="flex min-h-96 flex-col border-t border-hairline">
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
      </Card>
    </div>
  );
}
