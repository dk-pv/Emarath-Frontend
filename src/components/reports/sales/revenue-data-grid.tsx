"use client";

import { IconReportMoney } from "@tabler/icons-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { cn } from "@/lib/cn";
import { formatAED, formatDate } from "@/lib/format";
import { formatCount } from "@/lib/sales-reports";
import { stageColorClasses } from "@/lib/stage-palette";
import type {
  RevenueDealRow,
  RevenueGroup,
} from "@/services/revenue-report-service";
import type { SortState, TableColumn } from "@/types";
import { SalesPanelEmpty } from "./sales-report-parts";

/** A deal as the grid draws it: its place in the whole result and its group heading. */
export type RevenueGridRow = RevenueDealRow & {
  position: number;
  heading: { key: string; label: string } | null;
};

export const GROUP_OPTIONS: readonly { value: RevenueGroup; label: string }[] =
  [
    { value: "none", label: "None" },
    { value: "pipeline", label: "Pipeline" },
    { value: "agent", label: "Agent" },
    { value: "role", label: "Role" },
    { value: "status", label: "Status" },
    { value: "source", label: "Lead Source" },
  ];

/** Workpex sorts the grid by Lead Status ascending when it opens (both grid captures). */
export const DEFAULT_GRID_SORT: SortState = { key: "status", direction: "asc" };

/** Off until turned on in Manage Columns, so the grid opens with exactly the capture's columns. */
export const DEFAULT_HIDDEN_GRID_COLUMNS: string[] = [
  "convertedAt",
  "source",
  "primaryPhone",
  "createdAt",
];

/** The capture's ten equal 203-px columns at this density, ruled apart, on its 28px rows. */
const COLUMN =
  "w-[162px] min-w-[162px] max-w-[162px] border-r border-hairline py-1 text-[11.5px]";
const HEAD = "py-1.5 text-[11.5px] font-semibold";

function Text({ value }: { value: string | null }) {
  return value && value.trim() !== "" ? (
    <span className="block truncate" title={value}>
      {value}
    </span>
  ) : (
    <span className="text-ink-subtle">—</span>
  );
}

const column = (
  key: string,
  header: string,
  render: (row: RevenueGridRow) => React.ReactNode,
  options: Partial<TableColumn<RevenueGridRow>> = {},
): TableColumn<RevenueGridRow> => ({
  key,
  header,
  render,
  className: COLUMN,
  headerClassName: HEAD,
  ...options,
});

/**
 * The Data Grid's columns (`analytics-revenue-report-data-grid-2026-10.png`) in its order, the
 * nine after # sortable on the server, then the extras Manage Columns can add. Names print as the
 * capture prints them — plain text, cut to the column — and an empty value dashes.
 */
export const GRID_COLUMNS: readonly TableColumn<RevenueGridRow>[] = [
  column(
    "position",
    "#",
    (row) => <span className="text-ink-subtle">{row.position}</span>,
    {
      className:
        "w-9 min-w-9 border-r border-hairline px-1 py-1 text-center text-[11.5px] text-ink-subtle",
      headerClassName:
        "py-1.5 text-center text-[11.5px] font-normal text-ink-subtle",
    },
  ),
  column("name", "Customer Name", (row) => <Text value={row.name} />, {
    sortable: true,
  }),
  column("pipeline", "Lead Pipeline", (row) => <Text value={row.pipeline} />, {
    sortable: true,
  }),
  column(
    "assigned",
    "Assigned",
    (row) => (
      <Text
        value={
          row.assignedAgents.length > 0
            ? row.assignedAgents
                .map((agent) => agent.name)
                .sort((a, b) => a.localeCompare(b))
                .join(", ")
            : null
        }
      />
    ),
    { sortable: true },
  ),
  column(
    "status",
    "Lead Status",
    (row) => (
      // The stage's own colour, in its pale tint as the capture draws "Converted" here.
      <span
        className={cn(
          "inline-flex w-[100px] max-w-full items-center justify-center truncate rounded-md px-2 text-[11.5px] leading-[18px] text-ink",
          stageColorClasses(row.statusColor).tint,
        )}
      >
        {row.status}
      </span>
    ),
    { sortable: true },
  ),
  column(
    "actualAmount",
    "Actual Amount",
    (row) => <bdi dir="ltr">{formatAED(row.actualAmount)}</bdi>,
    { sortable: true, align: "right" },
  ),
  column(
    "secondaryPhone",
    "Secondary Phone",
    (row) => <Text value={row.secondaryPhone} />,
    { sortable: true },
  ),
  column("product", "Product", (row) => <Text value={row.product} />, {
    sortable: true,
  }),
  column("language", "Language", (row) => <Text value={row.language} />, {
    sortable: true,
  }),
  column("country", "Country", (row) => <Text value={row.country} />, {
    sortable: true,
  }),
  column("convertedAt", "Converted Date", (row) => formatDate(row.convertedAt)),
  column("source", "Lead Source", (row) => <Text value={row.source} />),
  column("primaryPhone", "Primary Phone", (row) => (
    <Text value={row.primaryPhone} />
  )),
  column("createdAt", "Created Date", (row) => formatDate(row.createdAt)),
];

/**
 * "Group by: None Pipeline Agent Role Status Lead Source" (`…data-grid-2026-10.png`): plain words,
 * the chosen one on a green pill.
 */
export function GroupByControl({
  value,
  onChange,
}: {
  value: RevenueGroup;
  onChange: (group: RevenueGroup) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Group by"
      className="flex flex-wrap items-center gap-x-1 gap-y-1"
    >
      <span className="mr-1 text-[13px] text-ink">Group by:</span>
      {GROUP_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "focus-ring h-6 rounded-full px-2.5 text-[13px] transition-colors duration-(--duration-shell) ease-shell",
            option.value === value
              ? "bg-brand text-white"
              : "text-ink-soft hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The Data Grid (`…data-grid-2026-10.png`, grouped: `…data-grid-group-agent-2026-10.png`): the
 * period's deals sorted, grouped and paged on the server, in a ruled box whose header stays put
 * while the rows scroll, over "Rows: 100" and the page controls. A group's heading carries its
 * count across every page, as the capture's "OTHER (572)" does.
 */
export function RevenueDataGrid({
  columns,
  rows,
  total,
  sort,
  onSortChange,
  page,
  size,
  onPageChange,
  onSizeChange,
  isLoading,
  isFetching,
  isError,
  onRetry,
}: {
  columns: readonly TableColumn<RevenueGridRow>[];
  rows: readonly RevenueGridRow[];
  total: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  page: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    // Exactly the room under the tabs (100cqh less the body's own 1.5rem padding), so the body
    // never scrolls: switching tabs can't leave the grid scrolled from where Overview was.
    <div className="flex h-[calc(100cqh-1.5rem)] min-h-96 flex-col pt-1.5 pb-1">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border border-hairline">
        <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
          <Table<RevenueGridRow>
            columns={columns}
            rows={rows}
            getRowId={(row) => row.id}
            sort={sort}
            onSortChange={onSortChange}
            isLoading={isLoading}
            isFetching={isFetching}
            groupHeading={(row) =>
              row.heading
                ? {
                    key: row.heading.key,
                    label: row.heading.label,
                  }
                : undefined
            }
            errorState={
              isError ? (
                <ErrorState
                  title="Couldn’t load the deals"
                  description="Something went wrong. Please try again."
                  onRetry={onRetry}
                />
              ) : undefined
            }
            emptyState={
              <SalesPanelEmpty
                icon={IconReportMoney}
                title="No deals closed in this period"
                description="No lead became WON in the selected period with these filters. Try another period or clear a filter."
              />
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-3 pb-1">
        <p className="text-[13px] text-ink-soft">
          Rows:{" "}
          <span className="font-semibold text-ink">
            {formatCount(rows.length)}
          </span>
          {total > rows.length && (
            <span className="text-ink-subtle"> of {formatCount(total)}</span>
          )}
        </p>
        <div className="w-auto">
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / size))}
            pageSize={size}
            onPageChange={onPageChange}
            onPageSizeChange={onSizeChange}
          />
        </div>
      </div>
    </div>
  );
}
