"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { Toolbar } from "@/components/layout/Toolbar";
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
 * applied-filter chips, a horizontally scrollable table, and pagination.
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
    <PageContainer>
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
      {toolbarActions && <Toolbar right={toolbarActions} />}

      {filters && search && (
        <AppliedFilterChips
          conditions={filters.conditions}
          search={search.value}
          fieldOf={filters.fieldOf}
          onRemove={filters.onRemove}
          onClearSearch={() => search.onChange("")}
        />
      )}

      <ResponsiveTableContainer label={tableLabel ?? `${title} table`}>
        {children}
      </ResponsiveTableContainer>

      {/* Workpex keeps the row count and page-size control on screen even for a single
          page, so the footer tracks `pagination` being supplied rather than page count. */}
      {pagination && (
        <Pagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          pageSize={pagination.pageSize}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </PageContainer>
  );
}
