"use client";

import { useState } from "react";
import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  ROWS_PER_PAGE_OPTIONS,
  RowsPerPage,
} from "@/components/ui/RowsPerPage";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

export type LeadDetailColumn = {
  key: string;
  header: string;
  align?: "left" | "right";
};

export type LeadDetailRow = { id: string; cells: React.ReactNode[] };

type LeadDetailSectionProps = {
  title: string;
  columns: LeadDetailColumn[];
  rows: LeadDetailRow[];
  /** Workpex's shared empty copy: "Records will appear here once they are added." */
  emptyDescription: string;
  action?: React.ReactNode;
  loading?: boolean;
  errored?: boolean;
  onRetry?: () => void;
  /**
   * Shows the reference's "Rows per page" footer and pages the rows here. The rows are
   * already in hand (a section holds one lead's records, not a server page), so this is
   * display paging — it never fetches.
   */
  pageSize?: number;
};

/**
 * One Details-column section on the Lead Detail page (traced from the supplied
 * Workpex screenshots): a titled card with an optional green add control, a fixed
 * column header row, and a body that is one of loading / error / empty / rows.
 *
 * Shared by every section (File Attachments, Notes, Email/WhatsApp/Call logs) so the
 * card chrome and the "No records yet" empty state are identical across them, exactly
 * as Workpex renders them. Sections with no backing data (everything but Notes) never
 * pass rows, so they rest on the empty state — an honest empty, not fabricated data.
 */
export function LeadDetailSection({
  title,
  columns,
  rows,
  emptyDescription,
  action,
  loading = false,
  errored = false,
  onRetry,
  pageSize,
}: LeadDetailSectionProps) {
  const [size, setSize] = useState(pageSize ?? ROWS_PER_PAGE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  const paged = pageSize !== undefined;
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pageCount);
  const visibleRows = paged
    ? rows.slice((current - 1) * size, current * size)
    : rows;

  return (
    <Card as="section">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {action}
      </div>
      <div className="overflow-x-auto scrollbar-slim">
        <table className="w-full min-w-[36rem] border-t border-hairline text-sm">
          <thead>
            <tr className="border-b border-hairline text-left align-middle text-xs text-ink-muted">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-5 py-3 font-medium",
                    column.align === "right" && "text-right",
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10">
                  <div className="flex items-center justify-center text-ink-muted">
                    <IconLoader2
                      size={20}
                      className="animate-spin"
                      aria-label="Loading"
                    />
                  </div>
                </td>
              </tr>
            ) : errored ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-8">
                  <ErrorState
                    title="Couldn’t load"
                    description="Something went wrong. Check your connection and try again."
                    onRetry={onRetry ?? (() => {})}
                  />
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10">
                  <EmptyState
                    title="No records yet"
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-hairline last:border-0"
                >
                  {row.cells.map((cell, index) => (
                    <td
                      key={columns[index].key}
                      className={cn(
                        "px-5 py-3 align-top text-ink",
                        columns[index].align === "right" && "text-right",
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paged && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3">
          <RowsPerPage
            value={size}
            onChange={(next) => {
              setSize(next);
              setPage(1);
            }}
            aria-label={`Rows per page, ${title}`}
          />

          {pageCount > 1 && (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current <= 1}
                className="focus-ring rounded-control px-2 py-1 transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
              >
                Previous
              </button>
              <span className="whitespace-nowrap">
                {current} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current >= pageCount}
                className="focus-ring rounded-control px-2 py-1 transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * The small green "+" add control Workpex puts at the top-right of each section.
 * Functional where a flow exists (Add Note), present-but-disabled with a tooltip
 * where the create flow isn't built (File Attachments, Follow-up) — never a
 * fabricated form.
 */
export function LeadDetailAddButton({
  label,
  onClick,
  disabled = false,
  tooltip,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-ring flex size-8 items-center justify-center rounded-control bg-brand text-white transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-brand"
    >
      <IconPlus size={16} stroke={2.5} aria-hidden="true" />
    </button>
  );
  return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button;
}
