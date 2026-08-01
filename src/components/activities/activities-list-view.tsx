"use client";

import { useEffect, useMemo, useState } from "react";
import { IconCalendarEvent, IconColumns } from "@tabler/icons-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { FilterPanel } from "@/components/filters/filter-panel";
import { Table } from "@/components/ui/Table";
import { Tabs } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_PAGE_SIZE } from "@/constants/table";
import { useFilters } from "@/hooks/use-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  activityColumns,
  ActivityRowProvider,
} from "@/components/activities/activity-columns";
import { ActivityFormDrawer } from "@/components/activities/activity-form-drawer";
import {
  LeadManageColumnsDrawer,
  type ManageableColumn,
} from "@/components/leads/lead-manage-columns-drawer";
import { useActivitiesList } from "@/components/activities/use-activities-list";
import { fetchAssignableAgents, fetchLookup } from "@/services/lookups-service";
import {
  ACTIVITIES_VIEW_KEY,
  fetchColumnLayout,
  reconcileLayout,
  saveColumnLayout,
} from "@/services/view-preferences-service";
import {
  ACTIVITY_BUCKETS,
  completeActivity,
  deleteActivity,
  duplicateActivity,
  type ActivitiesQuery,
  type ActivityBucket,
  type ActivityListItem,
} from "@/services/activities-service";
import { ApiError } from "@/lib/api-client";
import { dayBoundaries } from "@/lib/day-boundaries";
import type { FilterField, SelectOption } from "@/types";

/** A pause after the last keystroke before the server search runs (LEAD-03.3). */
const SEARCH_DEBOUNCE_MS = 300;

const NO_OPTIONS: {
  agents: SelectOption[];
  statuses: SelectOption[];
  pipelines: SelectOption[];
} = { agents: [], statuses: [], pipelines: [] };

const BUCKET_LABEL: Record<ActivityBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  completed: "Completed",
  all: "All",
};

/**
 * The Activities worklist (ACT-02.2 + ACT-07.1): tabs by due window, a
 * server-paginated lead-joined table with per-tab counts, plus search, the
 * assignee/status/pipeline filter panel and Manage Columns — all reusing the
 * shared Leads toolbar controls and the same search + filter + column-layout
 * plumbing. Add/Edit (ACT-03.2/05.1), Complete (ACT-04.1) and row actions
 * (ACT-08.1) are elsewhere.
 */
export function ActivitiesListView() {
  const boundaries = useMemo(() => dayBoundaries(), []);
  const [bucket, setBucket] = useState<ActivityBucket>("overdue");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);

  // Filter options. Assignees come from the same picker the drawer uses; lead
  // status + pipeline from the shared lookups. A failure just leaves a menu empty
  // — the list still works.
  const [options, setOptions] = useState(NO_OPTIONS);

  useEffect(() => {
    const controller = new AbortController();
    const ignoreAbort = (error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
    };
    Promise.all([
      fetchAssignableAgents(controller.signal),
      fetchLookup("leadStatus", controller.signal),
      fetchLookup("pipelines", controller.signal),
    ])
      .then(([agents, statuses, pipelines]) =>
        setOptions({
          agents: agents.map((a) => ({ value: a.id, label: a.name })),
          statuses: statuses.map((s) => ({ value: s.value, label: s.label })),
          pipelines: pipelines.map((p) => ({ value: p.value, label: p.label })),
        }),
      )
      .catch(ignoreAbort);
    return () => controller.abort();
  }, []);

  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        key: "assignedAgent",
        label: "Assigned",
        type: "multi",
        options: options.agents,
      },
      {
        key: "status",
        label: "Lead Status",
        type: "multi",
        options: options.statuses,
      },
      {
        key: "pipeline",
        label: "Lead Pipeline",
        type: "multi",
        options: options.pipelines,
      },
    ],
    [options],
  );

  const filters = useFilters(filterFields);
  const manageColumns = useDisclosure();

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(
    filters.state.search,
    SEARCH_DEBOUNCE_MS,
  );

  const query = useMemo<ActivitiesQuery>(() => {
    const pick = (key: string) => {
      const condition = filters.state.conditions.find((c) => c.key === key);
      return Array.isArray(condition?.value) && condition.value.length > 0
        ? (condition.value as string[])
        : undefined;
    };
    return {
      bucket,
      page,
      size,
      ...boundaries,
      search: debouncedSearch.trim() || undefined,
      assignedAgent: pick("assignedAgent"),
      status: pick("status"),
      pipeline: pick("pipeline"),
    };
  }, [
    bucket,
    page,
    size,
    boundaries,
    debouncedSearch,
    filters.state.conditions,
  ]);

  const { rows, total, counts, isLoading, isError, refetch } =
    useActivitiesList(query);
  const pageCount = Math.max(1, Math.ceil(total / size));

  const { toast } = useToast();
  const [completeTarget, setCompleteTarget] = useState<ActivityListItem | null>(
    null,
  );
  const [editTarget, setEditTarget] = useState<ActivityListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityListItem | null>(
    null,
  );
  const [pending, setPending] = useState<{
    id: string;
    action: "complete" | "duplicate" | "delete";
  } | null>(null);

  // Optimistic row patches (completion + edit field overrides, delete removals),
  // tied to the current `rows` identity so they drop automatically on the next
  // fetch (the Leads row-patch pattern): a fresh page — including the one a
  // post-write refetch loads — makes the server's data win and clears the overlay.
  const [patch, setPatch] = useState<{
    base: readonly ActivityListItem[];
    overrides: ReadonlyMap<string, Partial<ActivityListItem>>;
    removed: ReadonlySet<string>;
  }>(() => ({ base: rows, overrides: new Map(), removed: new Set() }));

  const active = patch.base === rows ? patch : null;
  const displayRows = useMemo<readonly ActivityListItem[]>(() => {
    if (!active || (active.overrides.size === 0 && active.removed.size === 0))
      return rows;
    return rows
      .filter((row) => !active.removed.has(row.id))
      .map((row) => {
        const override = active.overrides.get(row.id);
        return override ? { ...row, ...override } : row;
      });
  }, [rows, active]);

  // The prior overlay if its base is still the current `rows`, else a fresh one —
  // so a page that has since re-fetched starts the overlay clean.
  const onCurrentRows = (prev: typeof patch) =>
    prev.base === rows
      ? prev
      : {
          base: rows,
          overrides: new Map<string, Partial<ActivityListItem>>(),
          removed: new Set<string>(),
        };

  const applyOverride = (id: string, override: Partial<ActivityListItem>) =>
    setPatch((prev) => {
      const b = onCurrentRows(prev);
      const overrides = new Map(b.overrides);
      overrides.set(id, { ...overrides.get(id), ...override });
      return { base: rows, overrides, removed: b.removed };
    });

  const clearOverride = (id: string) =>
    setPatch((prev) => {
      if (prev.base !== rows || !prev.overrides.has(id)) return prev;
      const overrides = new Map(prev.overrides);
      overrides.delete(id);
      return { ...prev, overrides };
    });

  const markRemoved = (id: string) =>
    setPatch((prev) => {
      const b = onCurrentRows(prev);
      const removed = new Set(b.removed);
      removed.add(id);
      return { base: rows, overrides: b.overrides, removed };
    });

  const clearRemoved = (id: string) =>
    setPatch((prev) => {
      if (prev.base !== rows || !prev.removed.has(id)) return prev;
      const removed = new Set(prev.removed);
      removed.delete(id);
      return { ...prev, removed };
    });

  const changeBucket = (id: string) => {
    setBucket(id as ActivityBucket);
    setPage(1);
  };

  const changeSize = (next: number) => {
    setSize(next);
    setPage(1);
  };

  // Complete flow: confirm → optimistic check → API → refetch (silent, since the
  // query is unchanged) to refresh the bucket counts and drop the row from an
  // open bucket, all on the same page and tab. On failure the overlay reverts.
  const confirmComplete = async () => {
    const target = completeTarget;
    if (!target) return;
    setCompleteTarget(null);
    setPending({ id: target.id, action: "complete" });
    applyOverride(target.id, { completedAt: new Date().toISOString() });
    try {
      await completeActivity(target.id);
      refetch();
    } catch (error) {
      clearOverride(target.id);
      // ACT-10.1: the API returns 409 when the activity is location-tied and
      // no valid GPS check-in exists. Surface the blueprint-specified message
      // (§10: "Check in on site to complete this activity") so the user knows
      // why completion was blocked (AC3). All other failures fall through to
      // the generic error toast.
      if (error instanceof ApiError && error.status === 409) {
        toast({
          title: "Check in on site to complete this activity",
          tone: "danger",
        });
      } else {
        toast({ title: "Couldn't complete the activity", tone: "danger" });
      }
    } finally {
      setPending(null);
    }
  };

  // Duplicate (ACT-08.1 AC2): the server copies the scoped row into a fresh
  // follow-up; its sorted position depends on the due date, so the new row is
  // picked up by a refetch rather than inserted optimistically.
  const handleDuplicate = async (row: ActivityListItem) => {
    setPending({ id: row.id, action: "duplicate" });
    try {
      await duplicateActivity(row.id);
      refetch();
      toast({ title: "Follow-up duplicated", tone: "success" });
    } catch {
      toast({ title: "Couldn’t duplicate the activity", tone: "danger" });
    } finally {
      setPending(null);
    }
  };

  // Edit save: the drawer hands back the optimistic row patch; apply it, then
  // refetch (silent — query unchanged) to reconcile authoritatively.
  const handleSaved = (id: string, override: Partial<ActivityListItem>) => {
    applyOverride(id, override);
    setEditTarget(null);
    refetch();
    toast({ title: "Follow-up updated", tone: "success" });
  };

  // Delete flow: confirm → optimistically drop the row → API → refetch (silent)
  // to refresh the bucket counts, on the same page and tab. On failure the row
  // is restored.
  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    markRemoved(target.id);
    try {
      await deleteActivity(target.id);
      refetch();
      toast({ title: "Follow-up deleted", tone: "success" });
    } catch {
      clearRemoved(target.id);
      toast({ title: "Couldn’t delete the activity", tone: "danger" });
    }
  };

  // Custom columns (ACT-07.1 AC4). The activity's own first cell is the frozen
  // identifier (like Customer Name on Leads) and stays; every other column can be
  // reordered and shown or hidden, persisted per user via view-preferences.
  const manageableColumns = useMemo<ManageableColumn[]>(
    () =>
      activityColumns
        .filter(
          (column) => column.key !== "activity" && column.key !== "actions",
        )
        .map((column) => ({ key: column.key, label: String(column.header) })),
    [],
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    manageableColumns.map((column) => column.key),
  );
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchColumnLayout(ACTIVITIES_VIEW_KEY, controller.signal)
      .then((saved) => {
        const layout = reconcileLayout(
          saved,
          manageableColumns.map((column) => column.key),
        );
        setColumnOrder(layout.order);
        setHiddenColumns(layout.hidden);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, [manageableColumns]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(
      activityColumns.map((column) => [column.key, column]),
    );
    const hidden = new Set(hiddenColumns);
    // Frozen identifier first, the reorderable/hideable set, then the fixed
    // right-edge actions column.
    const keys = [
      "activity",
      ...columnOrder.filter((key) => !hidden.has(key)),
      "actions",
    ];
    return keys
      .map((key) => byKey.get(key))
      .filter((column): column is (typeof activityColumns)[number] =>
        Boolean(column),
      );
  }, [columnOrder, hiddenColumns]);

  // One table node shared by every tab, so switching buckets re-fetches in place
  // rather than remounting the table.
  const panel = (
    <>
      <ResponsiveTableContainer label="Activities table">
        <ActivityRowProvider
          value={{
            onRequestComplete: setCompleteTarget,
            onRequestEdit: setEditTarget,
            onRequestDelete: setDeleteTarget,
            onRequestDuplicate: (row) => void handleDuplicate(row),
            pendingId: pending?.id ?? null,
            pendingAction: pending?.action ?? null,
          }}
        >
          <Table
            columns={visibleColumns}
            rows={displayRows}
            getRowId={(row) => row.id}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                icon={IconCalendarEvent}
                title="No activities"
                description="There are no activities in this view."
              />
            }
            errorState={
              isError ? (
                <ErrorState
                  title="Couldn’t load activities"
                  description="Something went wrong while loading activities. Check your connection and try again."
                  onRetry={refetch}
                />
              ) : undefined
            }
          />
        </ActivityRowProvider>
      </ResponsiveTableContainer>

      {total > 0 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          total={total}
          onPageChange={setPage}
          pageSize={size}
          onPageSizeChange={changeSize}
        />
      )}
    </>
  );

  const tabs = ACTIVITY_BUCKETS.map((id) => ({
    id,
    label: counts ? `${BUCKET_LABEL[id]} (${counts[id]})` : BUCKET_LABEL[id],
    content: panel,
  }));

  return (
    <PageContainer>
      {/* Shared Workpex toolbar controls: Search · Filter · Manage Columns.
          Each resets the page and combines with the active tab (AC5). */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ToolbarSearch
          value={filters.state.search}
          onChange={(value) => {
            filters.setSearch(value);
            setPage(1);
          }}
          placeholder="Search name or title"
        />
        <FilterPanel
          fields={filterFields}
          activeCount={filters.activeCount}
          valueOf={filters.valueOf}
          onChange={(key, value) => {
            filters.setCondition(key, value);
            setPage(1);
          }}
          onClear={() => {
            filters.clearAll();
            setPage(1);
          }}
        />
        <button
          type="button"
          onClick={manageColumns.open}
          className={TOOLBAR_BUTTON_CLASS}
        >
          <IconColumns size={18} stroke={1.75} />
          Manage Columns
        </button>
      </div>

      <Tabs value={bucket} onValueChange={changeBucket} tabs={tabs} />

      <ConfirmDialog
        open={completeTarget !== null}
        onCancel={() => setCompleteTarget(null)}
        onConfirm={() => void confirmComplete()}
        title="Mark as complete"
        description="Would you like to mark this activity as completed?"
        confirmLabel="Yes"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete follow-up"
        description="Would you like to delete this activity? This cannot be undone."
        confirmLabel="Delete"
        tone="danger"
      />

      {/* Mounted per-open (keyed) so each edit prefills from its own row. */}
      {editTarget && (
        <ActivityFormDrawer
          key={editTarget.id}
          activity={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(override) => handleSaved(editTarget.id, override)}
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
            // Persist per user (AC4). Optimistic: the table already reflects the
            // change, so a failed save only means it won't survive a reload.
            void saveColumnLayout(ACTIVITIES_VIEW_KEY, { order, hidden }).catch(
              () => {},
            );
          }}
        />
      )}
    </PageContainer>
  );
}
