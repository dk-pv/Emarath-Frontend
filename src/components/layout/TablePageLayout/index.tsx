"use client";

import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { Toolbar } from "@/components/layout/Toolbar";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { AppliedFilterChips } from "@/components/filters/applied-filter-chips";
import type { FilterCondition, FilterField } from "@/types";

export type TablePageLayoutProps = {
  title: string;
  description?: string;
  /** Rendered on the right of the page header, e.g. an "Add Lead" button. */
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;

  /** Omit to hide the search box entirely. */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };

  /** Omit to hide the filter control entirely. */
  filters?: {
    fields: readonly FilterField[];
    conditions: readonly FilterCondition[];
    activeCount: number;
    valueOf: (key: string) => FilterCondition["value"];
    fieldOf: (key: string) => FilterField | undefined;
    onChange: (key: string, value: FilterCondition["value"]) => void;
    onRemove: (key: string) => void;
    onClear: () => void;
  };

  /** Extra toolbar controls (export, manage columns, view switchers). */
  toolbarActions?: React.ReactNode;

  /**
   * Rendered at the left of the toolbar row, opposite `toolbarActions` — the
   * Activities worklist puts its tab strip here, matching Workpex's single row of
   * tabs-left / controls-right above the table.
   */
  toolbarLeft?: React.ReactNode;

  /** The table itself — already scrolls horizontally via ResponsiveTableContainer. */
  children: React.ReactNode;

  /** Omit to hide pagination (e.g. a list that never pages). */
  pagination?: {
    page: number;
    pageCount: number;
    total?: number;
    onPageChange: (page: number) => void;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
  };

  /** Announced to screen readers as the label of the horizontal scroll region. */
  tableLabel?: string;
};

/**
 * The frame every list module composes: header, toolbar (search + filters + actions),
 * applied-filter chips, a scrollable table, and pagination.
 *
 * The frame fills the content area's height (`h-full`) and only the table region
 * scrolls: the header, toolbar and chips stay pinned at the top and the pagination
 * footer stays pinned at the bottom of the table card, so — like Workpex — the row
 * count and page controls never disappear below a long table. The scroll region and
 * that footer share one card (`flex-1 min-h-0`); the region is itself `flex-1 min-h-0`
 * inside it so it takes the leftover height and its own body scrolls (vertically and
 * horizontally), while the footer, a sibling of the region, stays put. The table's own
 * header sticks to the top of that scroll (see Table). This holds for every page size
 * and dataset length because the footer is never the last thing after the scroll.
 *
 * Deliberately module-agnostic — it knows nothing about Leads, Activities or Documents.
 * Each section is optional so a module opts in to what it has.
 */
export function TablePageLayout({
  title,
  description,
  actions,
  breadcrumb,
  search,
  filters,
  toolbarActions,
  toolbarLeft,
  children,
  pagination,
  tableLabel,
}: TablePageLayoutProps) {
  // The Navbar already renders the page <h1> for every route, and Workpex shows
  // the title only once — in that top bar, with the toolbar directly beneath it.
  // So the page header is rendered only when it carries something the navbar does
  // not (a description, actions, or a breadcrumb); a title-only header would be a
  // duplicate heading Workpex never shows.
  const hasPageHeader = Boolean(description || actions || breadcrumb);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
      {hasPageHeader && (
        <PageHeader
          title={title}
          description={description}
          actions={actions}
          breadcrumb={breadcrumb}
        />
      )}

      {/* Workpex's toolbar is one right-aligned cluster; the module composes it in
          order (New Lead · Search · Filter · Sort · …) and passes it whole, so the
          search and filter controls sit inside the cluster rather than pinned left. */}
      {(toolbarActions || toolbarLeft) && (
        <Toolbar left={toolbarLeft} right={toolbarActions} />
      )}

      {filters && search && (
        <AppliedFilterChips
          conditions={filters.conditions}
          search={search.value}
          fieldOf={filters.fieldOf}
          onRemove={filters.onRemove}
          onClearSearch={() => search.onChange("")}
        />
      )}

      {/* The table card (Workpex parity): the scroll region, its horizontal
          scrollbar and the pagination footer share one rounded, hairline-bordered
          white surface, so the list reads as a contained card on the canvas rather
          than an edge-to-edge sheet. `overflow-hidden` clips the sticky header and
          the scroll region to the card's radius; `flex-1 min-h-0` gives the card the
          leftover height so the region scrolls and the footer stays pinned to the
          card's bottom. */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* The one region that scrolls — `min-h-0 flex-1` so it takes the leftover
            height and its own body scrolls, keeping the footer below it on screen. */}
        <ResponsiveTableContainer
          label={tableLabel ?? `${title} table`}
          className="min-h-0 flex-1"
        >
          {children}
        </ResponsiveTableContainer>

        {/* Workpex keeps the row count and page-size control on screen even for a
            single page, so the footer tracks `pagination` being supplied rather than
            page count. A `border-t` separates it from the rows and its `px-4` aligns
            with the table cells, so it reads as the card's own footer. */}
        {pagination && (
          <div className="border-t border-hairline px-4 py-3">
            <Pagination
              page={pagination.page}
              pageCount={pagination.pageCount}
              total={pagination.total}
              onPageChange={pagination.onPageChange}
              pageSize={pagination.pageSize}
              onPageSizeChange={pagination.onPageSizeChange}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
