"use client";

import { useMemo } from "react";
import { IconFileExport, IconSearchOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { ManageColumns } from "@/components/table/manage-columns";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard } from "@/components/ui/StatCard";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useFilters } from "@/hooks/use-filters";
import { useListQuery } from "@/hooks/use-list-query";
import { useRowSelection } from "@/hooks/use-row-selection";
import {
  LEAD_FILTER_FIELDS,
  queryDemoLeads,
  type DemoLead,
} from "@/constants/demo-leads";
import { SUMMARY_CARDS } from "@/constants/dashboard";
import { SUMMARY_ICONS } from "./summary-cards";
import type { TableColumn, Tone } from "@/types";

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

const MODULE_ID = "demo-leads";

/** Small enough that paging, sorting and select-all are all visible on one screen. */
const PAGE_SIZE = 10;

/**
 * Demo composition proving the shared table system end to end against a 15,000-row source
 * (FND-03.1 AC5): server-shaped paging and sorting, row selection, and column management.
 *
 * Mock data only. This is not the Leads module — it exists to exercise the shared pieces
 * and is replaced by the real list at LEAD-01.1.
 */
export function DemoTableView() {
  const filters = useFilters(LEAD_FILTER_FIELDS);
  const list = useListQuery({ size: PAGE_SIZE, filters: filters.state });
  const selection = useRowSelection();

  const columns: TableColumn<DemoLead>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Lead",
        sortable: true,
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
        render: (row) => (
          <Tag tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Tag>
        ),
      },
      {
        key: "source",
        header: "Source",
        sortable: true,
        render: (row) => row.source,
      },
      {
        key: "agent",
        header: "Assigned Agent",
        sortable: true,
        render: (row) => row.agent,
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        render: (row) => AED.format(row.amount),
      },
    ],
    [],
  );

  const { prefs, setPrefs, visibleColumns } = useColumnPrefs(
    MODULE_ID,
    columns,
  );

  // Where a real module awaits its API client. The source resolves synchronously here, so
  // the query is the only dependency — exactly what the fetch would key on.
  const { rows, total } = useMemo(
    () => queryDemoLeads(list.query),
    [list.query],
  );

  const pageCount = Math.max(1, Math.ceil(total / list.size));

  return (
    <TablePageLayout
      title="Dashboard"
      description="Layout system demo — metric cards, toolbar, table and pagination."
      actions={<Button>Add Lead</Button>}
      search={{
        value: filters.state.search,
        onChange: (value) => {
          filters.setSearch(value);
          list.resetPage();
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
          list.resetPage();
        },
        onRemove: (key) => {
          filters.removeCondition(key);
          list.resetPage();
        },
        onClear: () => {
          filters.clearAll();
          list.resetPage();
        },
      }}
      toolbarActions={
        <>
          <ManageColumns columns={columns} prefs={prefs} onChange={setPrefs} />
          <Button variant="secondary" size="md">
            <IconFileExport size={18} stroke={1.75} />
            Export
          </Button>
        </>
      }
      pagination={{
        page: list.page,
        pageCount,
        total,
        onPageChange: list.setPage,
        pageSize: list.size,
        onPageSizeChange: list.setSize,
      }}
    >
      <Table
        columns={visibleColumns}
        rows={rows}
        getRowId={(row) => row.id}
        sort={list.sort}
        onSortChange={list.setSort}
        selection={{
          selectedIds: selection.selectedIds,
          onToggleRow: selection.toggleRow,
          onToggleAll: selection.toggleAll,
          rowLabel: (row) => `Select ${row.name}`,
        }}
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
