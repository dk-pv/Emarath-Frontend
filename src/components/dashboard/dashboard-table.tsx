import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { cn } from "@/lib/cn";
import type { TableColumn } from "@/types";

/**
 * Every Workpex Dashboard widget draws its table the same way, and none of them
 * lets it grow: the body is height-capped and scrolls **inside** the card, under a
 * header that stays put, above a pagination footer that stays visible. Both
 * captures show it directly — the Activities table in
 * dashboard-quick-add-plus-menu-open.png is mid-scroll, with a row clipped at the
 * top edge and another at the bottom, and no scrollbar drawn anywhere.
 *
 * That is what this component is: the one place those four behaviours live, so the
 * four widgets cannot drift apart.
 *
 *   • **Capped height** — `bodyClassName` carries the widget's own measured cap
 *     (each is traced to its screenshot at the widget's call site). The cap is on
 *     the scroll container, so a widget's height is the same whether the API
 *     returns 5 rows or 500.
 *   • **Internal scroll** — `ResponsiveTableContainer` is `overflow-auto`; the
 *     card never grows and the page never lengthens.
 *   • **Hidden scrollbar** — `scrollbars="none"` hides the track only
 *     (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`), never
 *     the overflow: wheel, trackpad, touch and keyboard all still scroll, and the
 *     container is a labelled, focusable region so a keyboard user can reach it.
 *   • **Stable header and footer** — `Table` already marks its `thead`
 *     `sticky top-0`, which is inert until a container bounds the height and takes
 *     effect here; the pager sits outside the scroll region, so it never scrolls
 *     away.
 *
 * `total` is the API's own role-scoped count, never `rows.length` — the rows are
 * one server-side page, so deriving the total from them would under-report.
 */
type DashboardTableProps<TRow> = {
  /** Names the scroll region for assistive tech and makes it keyboard reachable. */
  label: string;
  columns: readonly TableColumn<TRow>[];
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  /** The measured height cap for this widget's body, e.g. `max-h-[423px]`. */
  bodyClassName: string;
  /** A background refetch while rows stay on screen — dims the body, no skeleton. */
  isFetching?: boolean;
  /** Extra classes per row — the widgets set their measured row pitch here. */
  rowClassName?: (row: TRow) => string | undefined;
  emptyTitle?: string;
  emptyDescription?: string;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  /** The API's role-scoped total for the current selection. */
  total: number;
};

export function DashboardTable<TRow>({
  label,
  columns,
  rows,
  getRowId,
  bodyClassName,
  isFetching,
  rowClassName,
  emptyTitle = "No data available",
  emptyDescription = "There's currently no data to display here.",
  page,
  pageCount,
  onPageChange,
  pageSize,
  onPageSizeChange,
  total,
}: DashboardTableProps<TRow>) {
  return (
    <div className="flex flex-col gap-4">
      <ResponsiveTableContainer
        label={label}
        scrollbars="none"
        className={cn("rounded-surface border border-hairline", bodyClassName)}
      >
        <Table
          columns={columns}
          rows={rows}
          getRowId={getRowId}
          isFetching={isFetching}
          rowClassName={rowClassName}
          emptyState={
            <EmptyState title={emptyTitle} description={emptyDescription} />
          }
        />
      </ResponsiveTableContainer>

      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        pageSize={pageSize}
        onPageSizeChange={onPageSizeChange}
        total={total}
        hideNavWhenSingle
      />
    </div>
  );
}
