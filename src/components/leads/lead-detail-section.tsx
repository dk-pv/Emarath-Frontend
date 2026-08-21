import { IconLoader2, IconPlus } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
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
}: LeadDetailSectionProps) {
  return (
    <section className="rounded-surface border border-hairline bg-surface">
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-10">
                  <EmptyState
                    title="No records yet"
                    description={emptyDescription}
                  />
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
    </section>
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
