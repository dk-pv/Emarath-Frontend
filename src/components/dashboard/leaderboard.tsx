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
import { useFilters } from "@/hooks/use-filters";
import { useListQuery } from "@/hooks/use-list-query";
import { createMemorySource } from "@/lib/list-source";
import type { FilterField, LeaderboardRow, TableColumn } from "@/types";

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

/** The rate select is a bespoke predicate, not a field condition — nothing to declare. */
const NO_FIELDS: readonly FilterField[] = [];

const PAGE_SIZE = 5;

const getValue = (row: LeaderboardRow, key: string) =>
  (row[key as keyof LeaderboardRow] ?? null) as string | number | null;

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
  const filters = useFilters(NO_FIELDS);
  const list = useListQuery({ size: PAGE_SIZE, filters: filters.state });

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
        render: (row) => row.leads.toLocaleString("en-AE"),
      },
      {
        key: "calls",
        header: "Calls",
        align: "right",
        sortable: true,
        render: (row) => row.calls.toLocaleString("en-AE"),
      },
      {
        key: "convertedAmount",
        header: "Converted Amount",
        align: "right",
        sortable: true,
        render: (row) => AED.format(row.convertedAmount),
      },
      {
        key: "conversionRate",
        header: "Total Conversion Rate",
        align: "right",
        sortable: true,
        render: (row) => `${PERCENT.format(row.conversionRate)}%`,
      },
    ],
    [],
  );

  // These rows are already in the browser — the dashboard ships them with the page — but
  // they still go through the list contract so the table has one way of being driven.
  const source = useMemo(
    () =>
      createMemorySource({
        rows: filteredByRate,
        getValue,
        searchFields: ["agent"],
      }),
    [filteredByRate],
  );

  const page = useMemo(() => source(list.query), [source, list.query]);
  const pageCount = Math.max(1, Math.ceil(page.total / list.size));

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
              value={filters.state.search}
              onChange={(e) => {
                filters.setSearch(e.target.value);
                list.resetPage();
              }}
              placeholder="Search agents"
              aria-label="Search agents"
            />
          }
          right={
            <Select
              aria-label="Filter by conversion rate"
              value={rateFilter}
              onChange={(e) => {
                setRateFilter(e.target.value);
                list.resetPage();
              }}
              options={RATE_FILTERS}
            />
          }
        />
      </FilterBar>

      <ResponsiveTableContainer>
        <Table
          columns={columns}
          rows={page.rows}
          getRowId={(row) => row.id}
          sort={list.sort}
          onSortChange={list.setSort}
          isLoading={isLoading}
          emptyState={
            filters.state.search ? (
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

      {pageCount > 1 && (
        <div className="border-t border-hairline px-4 py-3">
          <Pagination
            page={list.page}
            pageCount={pageCount}
            total={page.total}
            onPageChange={list.setPage}
          />
        </div>
      )}
    </section>
  );
}
