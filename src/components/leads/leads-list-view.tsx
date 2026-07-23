"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconColumns,
  IconFileImport,
  IconFileSearch,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { FilterPanel } from "@/components/filters/filter-panel";
import { LeadAddColumnMenu } from "@/components/leads/lead-add-column-menu";
import { LeadBulkBar } from "@/components/leads/lead-bulk-bar";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadReassignDrawer } from "@/components/leads/lead-reassign-drawer";
import {
  LeadManageColumnsDrawer,
  type ManageableColumn,
} from "@/components/leads/lead-manage-columns-drawer";
import { LeadExportMenu } from "@/components/leads/lead-export-menu";
import { LeadQuickFilterMenu } from "@/components/leads/lead-quick-filter-menu";
import { presetConditions } from "@/components/leads/lead-quick-filters";
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
  type LeadListItem,
} from "@/services/leads-service";
import { LeadRowActionsProvider } from "@/components/leads/lead-row-actions";
import { LeadStatusProvider } from "@/components/leads/lead-status-badge";
import {
  LeadTagsProvider,
  type TagOption,
} from "@/components/leads/lead-tags-cell";
import {
  deleteLead,
  reassignLead,
  setLeadStatus,
} from "@/services/leads-row-actions-service";
import { addLeadTag, removeLeadTag } from "@/services/leads-tags-service";
import { fetchLookup } from "@/services/lookups-service";
import {
  downloadLeadsExport,
  type ExportFormat,
  type ExportScope,
} from "@/services/leads-export-service";
import {
  type BulkActionResponse,
  deleteLeads,
  reassignLeads,
} from "@/services/leads-bulk-service";
import {
  fetchColumnLayout,
  LEADS_VIEW_KEY,
  reconcileLayout,
  saveColumnLayout,
} from "@/services/view-preferences-service";
import type { FilterCondition, FilterField, FilterState } from "@/types";

const NO_OPTIONS: LeadFilterOptions = {
  sources: [],
  statuses: [],
  agents: [],
  tags: [],
};

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

  // The full existing-tag catalogue the row Tags picker offers (LEAD-12.1 AC1).
  // Unlike the filter's `options.tags` — faceted to tags already on visible leads
  // — the picker must offer every tag, since a lead with none can still take any.
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLookup("tags", controller.signal)
      .then((opts) =>
        setTagOptions(opts.map((o) => ({ id: o.value, name: o.label }))),
      )
      .catch((error: unknown) => {
        // Aborted on unmount; expected. Otherwise the picker just has no options
        // to add — the existing chips and the list still work.
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
      {
        key: "tag",
        label: "Tags",
        type: "multi",
        options: options.tags.map((tag) => ({
          label: tag.name,
          value: tag.id,
        })),
      },
    ],
    [options],
  );

  const filters = useFilters(filterFields);

  // Quick Filter preset (LEAD-04.1). One preset at a time; its conditions ride the
  // same list query as the field filters, so no new filter path exists. Kept in its
  // own state (not the panel's) so the active preset can be indicated and cleared
  // independently.
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetFilters, setPresetFilters] = useState<FilterCondition[]>([]);

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(
    filters.state.search,
    SEARCH_DEBOUNCE_MS,
  );
  const queryState = useMemo<FilterState>(
    () => ({
      search: debouncedSearch,
      conditions: [...filters.state.conditions, ...presetFilters],
    }),
    [debouncedSearch, filters.state.conditions, presetFilters],
  );

  const list = useListQuery({ filters: queryState });

  // Apply a preset (or clear with null); the menu resolves a re-select to null.
  const applyQuickFilter = (id: string | null) => {
    setActivePreset(id);
    setPresetFilters(id ? presetConditions(id) : []);
    list.resetPage();
  };
  const { rows, total, isLoading, isError, refetch } = useListData(
    fetchLeads,
    list.query,
  );

  const newLead = useDisclosure();
  const pageCount = Math.max(1, Math.ceil(total / list.size));

  // Bulk selection (LEAD-09.2). Ids accumulate across pages, so a select-all on
  // one page adds only that page's rows and the count carries over, matching
  // Workpex's persistent "N Lead Selected" bar.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (ids: string[]) =>
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  // Bulk actions (LEAD-09.2). "Assignee" opens the reassign drawer, "Delete" opens
  // a confirmation — both call the LEAD-09.1 API and report the per-item result via
  // toast, then clear the selection (AC5) and refetch so the list reflects the change.
  const { toast } = useToast();
  const reassignDrawer = useDisclosure();
  const confirmDelete = useDisclosure();
  const [bulkBusy, setBulkBusy] = useState(false);

  const reportBulk = (verb: string, result: BulkActionResponse) => {
    const { success, failed } = result.summary;
    if (failed === 0) {
      toast({
        title: `${success} lead${success === 1 ? "" : "s"} ${verb}`,
        tone: "success",
      });
    } else {
      // The backend only fails an id it could not act on (out of the caller's
      // scope); surface that rather than claiming a clean success.
      toast({
        title: `${success} ${verb}, ${failed} skipped`,
        description: "Some leads were outside your access and left unchanged.",
        tone: "warning",
      });
    }
    setSelectedIds(new Set());
    refetch();
  };

  const handleReassign = async (agentId: string) => {
    setBulkBusy(true);
    try {
      const result = await reassignLeads([...selectedIds], agentId);
      reassignDrawer.close();
      reportBulk("reassigned", result);
    } catch {
      toast({ title: "Couldn’t reassign leads", tone: "danger" });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = async () => {
    confirmDelete.close();
    setBulkBusy(true);
    try {
      const result = await deleteLeads([...selectedIds]);
      reportBulk("deleted", result);
    } catch {
      toast({ title: "Couldn’t delete leads", tone: "danger" });
    } finally {
      setBulkBusy(false);
    }
  };

  // Row quick actions (LEAD-10.2). WhatsApp is a client deep-link handled in the
  // row itself; Reassign and Delete open a drawer/confirm here and call the
  // LEAD-10.1 single-lead API. Only the affected row changes — no full refetch.
  const [rowReassignTarget, setRowReassignTarget] =
    useState<LeadListItem | null>(null);
  const [rowDeleteTarget, setRowDeleteTarget] = useState<LeadListItem | null>(
    null,
  );
  const [rowPending, setRowPending] = useState<{
    id: string;
    action: "reassign" | "delete";
  } | null>(null);

  // A per-row overlay on the fetched page: id → updated row, or null for a
  // removed row. It is tied to the current `rows` array identity, so any fresh
  // fetch (page change, filter, or a bulk refetch) drops the overlay and the
  // server's data wins — the overlay never outlives the data it patches.
  const [rowPatch, setRowPatch] = useState<{
    base: readonly LeadListItem[];
    map: Map<string, LeadListItem | null>;
  }>(() => ({ base: rows, map: new Map<string, LeadListItem | null>() }));

  const activePatch = rowPatch.base === rows ? rowPatch.map : null;
  const displayedRows = useMemo<readonly LeadListItem[]>(() => {
    if (!activePatch || activePatch.size === 0) return rows;
    return rows
      .map((row) => (activePatch.has(row.id) ? activePatch.get(row.id) : row))
      .filter((row): row is LeadListItem => row != null);
  }, [rows, activePatch]);

  const patchRow = (id: string, value: LeadListItem | null) =>
    setRowPatch((prev) => {
      // If the page has been refetched since the last patch, start clean against
      // the current rows rather than layering onto a stale base.
      const base =
        prev.base === rows ? prev.map : new Map<string, LeadListItem | null>();
      const next = new Map(base);
      next.set(id, value);
      return { base: rows, map: next };
    });

  const handleRowReassign = async (agentId: string) => {
    const lead = rowReassignTarget;
    if (!lead) return;
    setRowPending({ id: lead.id, action: "reassign" });
    try {
      const updated = await reassignLead(lead.id, agentId);
      setRowReassignTarget(null);
      patchRow(lead.id, updated);
      toast({ title: `${lead.name} reassigned`, tone: "success" });
    } catch {
      toast({ title: "Couldn’t reassign lead", tone: "danger" });
    } finally {
      setRowPending(null);
    }
  };

  const handleRowDelete = async () => {
    const lead = rowDeleteTarget;
    if (!lead) return;
    setRowDeleteTarget(null);
    setRowPending({ id: lead.id, action: "delete" });
    try {
      await deleteLead(lead.id);
      patchRow(lead.id, null);
      toast({ title: `${lead.name} deleted`, tone: "success" });
    } catch {
      toast({ title: "Couldn’t delete lead", tone: "danger" });
    } finally {
      setRowPending(null);
    }
  };

  const rowActionsValue = useMemo(
    () => ({
      onReassign: (lead: LeadListItem) => setRowReassignTarget(lead),
      onDelete: (lead: LeadListItem) => setRowDeleteTarget(lead),
      pendingId: rowPending?.id ?? null,
      pendingAction: rowPending?.action ?? null,
    }),
    [rowPending],
  );

  // Inline status change (LEAD-11.1, from lead-status.mp4). The badge dropdown picks
  // a status; the save flow is uncaptured, so this is a documented fallback (ADR-0015):
  // update the affected row optimistically, call the LEAD-10.1 set-status API, and
  // toast — reverting the row if the server rejects it.
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);

  const handleStatusChange = async (lead: LeadListItem, status: string) => {
    setStatusPendingId(lead.id);
    patchRow(lead.id, { ...lead, status });
    try {
      const updated = await setLeadStatus(lead.id, status);
      patchRow(lead.id, updated);
      toast({ title: `${lead.name} set to ${status}`, tone: "success" });
    } catch {
      patchRow(lead.id, lead);
      toast({ title: "Couldn’t update status", tone: "danger" });
    } finally {
      setStatusPendingId(null);
    }
  };

  const statusValue = {
    onChange: (lead: LeadListItem, status: string) =>
      void handleStatusChange(lead, status),
    pendingId: statusPendingId,
  };

  // Row tag add/remove (LEAD-12.1). The affected row updates optimistically, the
  // LEAD-12.1 API persists it, and only that row changes — no full refetch. The
  // added tag is known from the picker, so the optimistic chip carries its name;
  // the row reverts if the server rejects the change.
  const [tagPendingId, setTagPendingId] = useState<string | null>(null);

  const handleAddTag = async (lead: LeadListItem, tag: TagOption) => {
    setTagPendingId(lead.id);
    patchRow(lead.id, { ...lead, tags: [...lead.tags, tag] });
    try {
      const updated = await addLeadTag(lead.id, tag.id);
      patchRow(lead.id, updated);
      toast({ title: `Tagged “${tag.name}”`, tone: "success" });
    } catch {
      patchRow(lead.id, lead);
      toast({ title: "Couldn’t add tag", tone: "danger" });
    } finally {
      setTagPendingId(null);
    }
  };

  const handleRemoveTag = async (lead: LeadListItem, tagId: string) => {
    setTagPendingId(lead.id);
    patchRow(lead.id, {
      ...lead,
      tags: lead.tags.filter((tag) => tag.id !== tagId),
    });
    try {
      const updated = await removeLeadTag(lead.id, tagId);
      patchRow(lead.id, updated);
      toast({ title: "Tag removed", tone: "success" });
    } catch {
      patchRow(lead.id, lead);
      toast({ title: "Couldn’t remove tag", tone: "danger" });
    } finally {
      setTagPendingId(null);
    }
  };

  const tagsValue = {
    onAdd: (lead: LeadListItem, tag: TagOption) => void handleAddTag(lead, tag),
    onRemove: (lead: LeadListItem, tagId: string) =>
      void handleRemoveTag(lead, tagId),
    options: tagOptions,
    pendingId: tagPendingId,
  };

  // Custom columns (LEAD-05.1). Customer Name (the frozen identifier) and the row
  // actions are fixed; every other column can be reordered and shown or hidden.
  const manageableColumns = useMemo<ManageableColumn[]>(
    () =>
      leadColumns
        .filter((column) => column.key !== "name" && column.key !== "actions")
        .map((column) => ({ key: column.key, label: String(column.header) })),
    [],
  );

  // The layout starts at the default and is replaced once the caller's saved
  // layout loads (AC3). Order and the hidden set persist per user server-side.
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    manageableColumns.map((column) => column.key),
  );
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const manageColumns = useDisclosure();

  useEffect(() => {
    const controller = new AbortController();
    fetchColumnLayout(LEADS_VIEW_KEY, controller.signal)
      .then((saved) => {
        const layout = reconcileLayout(
          saved,
          manageableColumns.map((column) => column.key),
        );
        setColumnOrder(layout.order);
        setHiddenColumns(layout.hidden);
      })
      .catch((error: unknown) => {
        // A superseded request aborts; expected. Any other failure just leaves
        // the default layout in place — the table still renders.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, [manageableColumns]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(leadColumns.map((column) => [column.key, column]));
    const hidden = new Set(hiddenColumns);
    const orderedKeys = [
      "name",
      ...columnOrder.filter((key) => !hidden.has(key)),
      "actions",
    ];
    return orderedKeys
      .map((key) => byKey.get(key))
      .filter((column): column is (typeof leadColumns)[number] =>
        Boolean(column),
      );
  }, [columnOrder, hiddenColumns]);

  // Export (LEAD-08.1). Downloads the current view — the same query the list runs
  // (search/filter/sort/scope) — in the chosen format. "My Default" sends the
  // visible data columns in order; Actions is a control, not data, so it is dropped.
  const handleExport = (format: ExportFormat, scope: ExportScope) => {
    const columnKeys = visibleColumns
      .map((column) => column.key)
      .filter((key) => key !== "actions");
    downloadLeadsExport(format, scope, list.query, columnKeys);
  };

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
          // Workpex's exact toolbar order (leads-list-default-scroll-left-…png),
          // one right-aligned cluster of compact controls: New Lead · Search ·
          // Filter · Sort · Quick Filter · Add Column · Manage Columns · Import ·
          // Export. Import History is not a Workpex toolbar control (still routable
          // at /leads/import/history), so it is not shown here.
          <>
            <Button size="sm" onClick={newLead.open}>
              <IconPlus size={18} stroke={2} />
              New Lead
            </Button>
            <ToolbarSearch
              value={filters.state.search}
              onChange={(value) => {
                filters.setSearch(value);
                list.resetPage();
              }}
              placeholder="Search name or phone"
            />
            <FilterPanel
              fields={filterFields}
              activeCount={filters.activeCount}
              valueOf={filters.valueOf}
              onChange={(key, value) => {
                filters.setCondition(key, value);
                list.resetPage();
              }}
              onClear={() => {
                filters.clearAll();
                list.resetPage();
              }}
            />
            <LeadSortMenu sort={list.sort} onSortChange={list.setSort} />
            <LeadQuickFilterMenu
              active={activePreset}
              onChange={applyQuickFilter}
            />
            <LeadAddColumnMenu />
            <button
              type="button"
              onClick={manageColumns.open}
              className={TOOLBAR_BUTTON_CLASS}
            >
              <IconColumns size={18} stroke={1.75} />
              Manage Columns
            </button>
            <Link href="/leads/import" className={TOOLBAR_BUTTON_CLASS}>
              <IconFileImport size={18} stroke={1.75} />
              Import
            </Link>
            <LeadExportMenu onExport={handleExport} />
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
        <LeadRowActionsProvider value={rowActionsValue}>
          <LeadStatusProvider value={statusValue}>
            <LeadTagsProvider value={tagsValue}>
              <Table
                columns={visibleColumns}
                rows={displayedRows}
                getRowId={(row) => row.id}
                selection={{
                  selectedIds,
                  onToggleRow: toggleRow,
                  onToggleAll: toggleAll,
                  rowLabel: (row) => `Select ${row.name}`,
                  allLabel: "Select all leads on this page",
                }}
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
            </LeadTagsProvider>
          </LeadStatusProvider>
        </LeadRowActionsProvider>
      </TablePageLayout>

      {selectedIds.size > 0 && (
        <LeadBulkBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onReassign={reassignDrawer.open}
          onDelete={confirmDelete.open}
          busy={bulkBusy}
        />
      )}

      {/* Mounted per-open so the agent choice always starts empty (LEAD-09.2). */}
      {reassignDrawer.isOpen && (
        <LeadReassignDrawer
          open
          count={selectedIds.size}
          submitting={bulkBusy}
          onClose={reassignDrawer.close}
          onReassign={(agentId) => void handleReassign(agentId)}
        />
      )}

      <ConfirmDialog
        open={confirmDelete.isOpen}
        onCancel={confirmDelete.close}
        onConfirm={() => void handleDelete()}
        title="Delete leads"
        description={`Permanently delete ${selectedIds.size} selected lead${
          selectedIds.size === 1 ? "" : "s"
        }? This can't be undone.`}
        confirmLabel="Delete"
        tone="danger"
      />

      {/* Row "Reassign" (LEAD-10.2). Reuses the reassign drawer for a single lead;
          mounted per-open so the agent choice always starts empty. */}
      {rowReassignTarget && (
        <LeadReassignDrawer
          open
          count={1}
          submitting={
            rowPending?.id === rowReassignTarget.id &&
            rowPending.action === "reassign"
          }
          onClose={() => setRowReassignTarget(null)}
          onReassign={(agentId) => void handleRowReassign(agentId)}
        />
      )}

      {/* Row "Delete" (LEAD-10.2) — names the lead being removed. */}
      <ConfirmDialog
        open={rowDeleteTarget !== null}
        onCancel={() => setRowDeleteTarget(null)}
        onConfirm={() => void handleRowDelete()}
        title="Delete lead"
        description={
          rowDeleteTarget
            ? `Permanently delete “${rowDeleteTarget.name}”? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
      />

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

      {/* Mounted per-open so the draft always starts from the applied columns. */}
      {manageColumns.isOpen && (
        <LeadManageColumnsDrawer
          open
          columns={manageableColumns}
          order={columnOrder}
          hidden={hiddenColumns}
          onClose={manageColumns.close}
          onApply={(order, hidden) => {
            setColumnOrder(order);
            setHiddenColumns(hidden);
            // Persist per user (AC3). Optimistic: the table already reflects the
            // change, so a failed save only means it won't survive a reload.
            void saveColumnLayout(LEADS_VIEW_KEY, { order, hidden }).catch(
              () => {},
            );
          }}
        />
      )}
    </>
  );
}
