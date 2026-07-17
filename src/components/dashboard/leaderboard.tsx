"use client";

import { useMemo, useState } from "react";
import { IconTrophy, IconUsersGroup } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Table } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { FilterBar } from "@/components/layout/FilterBar";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { Toolbar } from "@/components/layout/Toolbar";
import { useTableControls } from "@/hooks/use-table-controls";
import type { LeaderboardRow, TableColumn } from "@/types";

const AED = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 2,
});

/** Conversion rates may legitimately exceed 100%, so this must never be clamped. */
const PERCENT = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 });

const RATE_FILTERS = [
  { label: "All agents", value: "all" },
  { label: "Above 60%", value: "high" },
  { label: "Below 60%", value: "low" },
];

type LeaderboardProps = {
  rows: readonly LeaderboardRow[];
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

export function Leaderboard({
  rows,
  isLoading = false,
  error,
  onRetry,
}: LeaderboardProps) {
  const [rateFilter, setRateFilter] = useState("all");

  const filteredByRate = useMemo(() => {
    if (rateFilter === "high")
      return rows.filter((r) => r.conversionRate >= 60);
    if (rateFilter === "low") return rows.filter((r) => r.conversionRate < 60);
    return rows;
  }, [rows, rateFilter]);

  const columns: TableColumn<LeaderboardRow>[] = useMemo(
    () => [
      {
        key: "agent",
        header: "Agent",
        sortable: true,
        sortValue: (row) => row.agent,
        render: (row) => (
          <span className="flex items-center gap-3">
            <Avatar name={row.agent} size="sm" />
            <span className="truncate font-medium text-ink">{row.agent}</span>
          </span>
        ),
      },
      {
        key: "leads",
        header: "Leads",
        align: "right",
        sortable: true,
        sortValue: (row) => row.leads,
        render: (row) => row.leads.toLocaleString("en-AE"),
      },
      {
        key: "calls",
        header: "Calls",
        align: "right",
        sortable: true,
        sortValue: (row) => row.calls,
        render: (row) => row.calls.toLocaleString("en-AE"),
      },
      {
        key: "convertedAmount",
        header: "Converted Amount",
        align: "right",
        sortable: true,
        sortValue: (row) => row.convertedAmount,
        render: (row) => AED.format(row.convertedAmount),
      },
      {
        key: "conversionRate",
        header: "Total Conversion Rate",
        align: "right",
        sortable: true,
        sortValue: (row) => row.conversionRate,
        render: (row) => `${PERCENT.format(row.conversionRate)}%`,
      },
    ],
    [],
  );

  const table = useTableControls({
    rows: filteredByRate,
    columns,
    pageSize: 5,
    searchFields: (row) => [row.agent],
  });

  if (error) {
    return (
      <ErrorState
        title="Couldn’t load the leaderboard"
        description={error}
        onRetry={onRetry ?? (() => {})}
      />
    );
  }

  return (
    <section className="rounded-surface border border-hairline bg-surface">
      <SectionHeader
        title="Leaderboard"
        description="Agent performance across leads, calls and conversion."
      />

      <FilterBar>
        <Toolbar
          left={
            <SearchInput
              value={table.query}
              onChange={(e) => table.setQuery(e.target.value)}
              placeholder="Search agents"
              aria-label="Search agents"
            />
          }
          right={
            <Select
              aria-label="Filter by conversion rate"
              value={rateFilter}
              onChange={(e) => setRateFilter(e.target.value)}
              options={RATE_FILTERS}
            />
          }
        />
      </FilterBar>

      <ResponsiveTableContainer>
        <Table
          columns={columns}
          rows={table.rows}
          getRowId={(row) => row.id}
          sort={table.sort}
          onSortChange={table.setSort}
          isLoading={isLoading}
          emptyState={
            table.query ? (
              <EmptyState
                icon={IconUsersGroup}
                title="No agents match your search"
                description="Try a different name or clear the search."
              />
            ) : (
              <EmptyState
                icon={IconTrophy}
                title="No agent activity yet"
                description="Leaderboard standings appear once agents log leads and calls."
              />
            )
          }
        />
      </ResponsiveTableContainer>

      {table.pageCount > 1 && (
        <div className="border-t border-hairline px-4 py-3">
          <Pagination
            page={table.page}
            pageCount={table.pageCount}
            total={table.total}
            onPageChange={table.setPage}
          />
        </div>
      )}
    </section>
  );
}
