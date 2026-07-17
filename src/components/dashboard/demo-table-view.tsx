"use client";

import { useMemo, useState } from "react";
import { IconFileExport, IconSearchOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard } from "@/components/ui/StatCard";
import { matchesFilters, useFilters } from "@/hooks/use-filters";
import {
  DEMO_LEADS,
  LEAD_FILTER_FIELDS,
  type DemoLead,
} from "@/constants/demo-leads";
import { SUMMARY_CARDS } from "@/constants/dashboard";
import { SUMMARY_ICONS } from "./summary-cards";
import type { SortState, TableColumn, Tone } from "@/types";

const AED = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

const STATUS_TONE: Record<string, Tone> = {
  New: "info",
  Qualified: "success",
  Hot: "danger",
  "Follow-up": "warning",
  Cancelled: "neutral",
};

const PAGE_SIZE = 6;

const SEARCH_FIELDS = ["name", "phone"] as const;

const getValue = (row: DemoLead, key: string) =>
  (row[key as keyof DemoLead] ?? null) as string | number | null;

/**
 * Demo composition proving the shared layout system end to end: metric cards, page
 * header, toolbar with search + filters, applied chips, table, pagination.
 *
 * Mock data only. This is not the Leads module — it exists to verify the layout.
 */
export function DemoTableView() {
  const filters = useFilters(LEAD_FILTER_FIELDS);
  const [sort, setSort] = useState<SortState | undefined>();
  const [page, setPage] = useState(1);

  const columns: TableColumn<DemoLead>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Lead",
        sortable: true,
        sortValue: (row) => row.name,
        render: (row) => (
          <span className="flex flex-col">
            <span className="font-medium text-ink">{row.name}</span>
            <span className="text-xs text-ink-muted">{row.phone}</span>
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortable: true,
        sortValue: (row) => row.status,
        render: (row) => (
          <Tag tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Tag>
        ),
      },
      {
        key: "source",
        header: "Source",
        sortable: true,
        sortValue: (row) => row.source,
        render: (row) => row.source,
      },
      {
        key: "agent",
        header: "Assigned Agent",
        sortable: true,
        sortValue: (row) => row.agent,
        render: (row) => row.agent,
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        sortValue: (row) => row.amount,
        render: (row) => AED.format(row.amount),
      },
    ],
    [],
  );

  const filtered = useMemo(
    () =>
      DEMO_LEADS.filter((row) =>
        matchesFilters(
          row,
          filters.state,
          LEAD_FILTER_FIELDS,
          getValue,
          SEARCH_FIELDS,
        ),
      ),
    [filters.state],
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <TablePageLayout
      title="Dashboard"
      description="Layout system demo — metric cards, toolbar, table and pagination."
      actions={<Button>Add Lead</Button>}
      search={{
        value: filters.state.search,
        onChange: (value) => {
          filters.setSearch(value);
          setPage(1);
        },
        placeholder: "Search name or phone",
      }}
      filters={{
        fields: LEAD_FILTER_FIELDS,
        conditions: filters.active,
        activeCount: filters.activeCount,
        valueOf: filters.valueOf,
        fieldOf: filters.fieldOf,
        onChange: (key, value) => {
          filters.setCondition(key, value);
          setPage(1);
        },
        onRemove: filters.removeCondition,
        onClear: () => {
          filters.clearAll();
          setPage(1);
        },
      }}
      toolbarActions={
        <Button variant="secondary" size="md">
          <IconFileExport size={18} stroke={1.75} />
          Export
        </Button>
      }
      pagination={{
        page: safePage,
        pageCount,
        total: sorted.length,
        onPageChange: setPage,
      }}
    >
      <Table
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
        emptyState={
          <EmptyState
            icon={IconSearchOff}
            title="No leads match your filters"
            description="Adjust or clear the filters to see more results."
          />
        }
      />
    </TablePageLayout>
  );
}

/** Metric cards sit above the table frame, matching the Workpex dashboard. */
export function DemoMetrics() {
  return (
    <MetricCardsRow>
      {SUMMARY_CARDS.map((card) => (
        <StatCard
          key={card.id}
          label={card.label}
          value={card.value}
          caption={card.caption}
          tone={card.tone}
          icon={SUMMARY_ICONS[card.id]}
        />
      ))}
    </MetricCardsRow>
  );
}
