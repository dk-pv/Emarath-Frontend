"use client";

import { IconFileSearch } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { useListData } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { fetchLeads } from "@/services/leads-service";
import { leadColumns } from "@/components/leads/lead-columns";

/**
 * The real Leads list (LEAD-02.2), wired to GET /api/leads. No mock data.
 *
 * Every table state is driven from `useListData`:
 * - loading  → the shared table's skeleton rows
 * - error    → the shared ErrorState with a retry that refetches
 * - empty    → the application-wide empty-table pattern (matches GPS Map,
 *              Dashboard, Analytics, Integrations)
 * - populated→ the sticky-first-column table with pagination
 *
 * Responsive behaviour is horizontal scroll at every width with Customer Name
 * frozen (see lead-columns): all columns stay reachable — nothing is dropped —
 * and the frozen identifier keeps the scroll usable down to mobile.
 */
export function LeadsListView() {
  const list = useListQuery();
  const { rows, total, isLoading, isError, refetch } = useListData(
    fetchLeads,
    list.query,
  );

  const pageCount = Math.max(1, Math.ceil(total / list.size));

  return (
    <TablePageLayout
      title="Leads"
      tableLabel="Leads table"
      // The footer only belongs on a populated list: during loading, an error,
      // or a genuinely empty result there is nothing to page, and a "0 results"
      // footer would read as a wrong answer rather than a pending one.
      pagination={
        total > 0
          ? {
              page: list.page,
              pageCount,
              total,
              onPageChange: list.setPage,
              pageSize: list.size,
              onPageSizeChange: list.setSize,
            }
          : undefined
      }
    >
      <Table
        columns={leadColumns}
        rows={rows}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={IconFileSearch}
            title="No data available"
            description="There's no data for the selected date range or filters. Try adjusting your filters to see more results."
          />
        }
        errorState={
          isError ? (
            <ErrorState
              title="Couldn’t load leads"
              description="Something went wrong while loading leads. Check your connection and try again."
              onRetry={refetch}
            />
          ) : undefined
        }
      />
    </TablePageLayout>
  );
}
