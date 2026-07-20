"use client";

import { useEffect, useMemo, useState } from "react";
import { IconFileSearch, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadSortMenu } from "@/components/leads/lead-sort-menu";
import { leadColumns } from "@/components/leads/lead-columns";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useFilters } from "@/hooks/use-filters";
import { useListData } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import {
  fetchLeadFilterOptions,
  fetchLeads,
  type LeadFilterOptions,
} from "@/services/leads-service";
import type { FilterField, FilterState } from "@/types";

const NO_OPTIONS: LeadFilterOptions = { sources: [], statuses: [], agents: [] };

/** A pause after the last keystroke before the server search runs (LEAD-03.3). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The real Leads list (LEAD-02.2) with search, filter and sort wired in
 * (LEAD-03.3). Everything is a composition of the Foundation: the toolbar,
 * SearchInput and FilterPanel come from TablePageLayout, filter state from
 * useFilters, paging/sort from useListQuery, and fetching from useListData — no
 * bespoke toolbar, popup or search component is introduced.
 *
 * Search is debounced so a 15,000+ row query does not run per keystroke, while
 * the box stays controlled by the live value. Filter options are faceted from
 * the caller's scoped leads, so an agent is only ever offered sources, statuses
 * and agents that appear on leads they may open.
 */
export function LeadsListView() {
  const [options, setOptions] = useState<LeadFilterOptions>(NO_OPTIONS);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch((error: unknown) => {
        // A superseded request aborts; that is expected. Any other failure just
        // leaves the filter menu empty — the list itself still works.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, []);

  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        key: "source",
        label: "Source",
        type: "multi",
        options: options.sources.map((value) => ({ label: value, value })),
      },
      {
        key: "status",
        label: "Lead Status",
        type: "multi",
        options: options.statuses.map((value) => ({ label: value, value })),
      },
      {
        key: "assignedAgent",
        label: "Assigned Agent",
        type: "multi",
        options: options.agents.map((agent) => ({
          label: agent.name,
          value: agent.id,
        })),
      },
    ],
    [options],
  );

  const filters = useFilters(filterFields);

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(
    filters.state.search,
    SEARCH_DEBOUNCE_MS,
  );
  const queryState = useMemo<FilterState>(
    () => ({ search: debouncedSearch, conditions: filters.state.conditions }),
    [debouncedSearch, filters.state.conditions],
  );

  const list = useListQuery({ filters: queryState });
  const { rows, total, isLoading, isError, refetch } = useListData(
    fetchLeads,
    list.query,
  );

  const newLead = useDisclosure();
  const pageCount = Math.max(1, Math.ceil(total / list.size));

  return (
    <>
      <TablePageLayout
        title="Leads"
        tableLabel="Leads table"
        search={{
          value: filters.state.search,
          onChange: (value) => {
            filters.setSearch(value);
            list.resetPage();
          },
          placeholder: "Search name or phone",
        }}
        filters={{
          fields: filterFields,
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
            <Button onClick={newLead.open}>
              <IconPlus size={18} stroke={2} />
              New Lead
            </Button>
            <LeadSortMenu sort={list.sort} onSortChange={list.setSort} />
          </>
        }
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

      {/* Mounted only while open, so every New Lead starts from a clean form. */}
      {newLead.isOpen && (
        <LeadFormDrawer
          open
          onClose={newLead.close}
          onCreated={() => {
            newLead.close();
            refetch();
          }}
        />
      )}
    </>
  );
}
