"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconCalendarEvent,
  IconColumns,
  IconListCheck,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import {
  ActivityFilterPanel,
  EMPTY_ACTIVITY_FILTERS,
  type ActivityFilterState,
} from "@/components/activities/activity-filter-panel";
import { Table } from "@/components/ui/Table";
import { TabStrip } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import {
  activityColumns,
  ActivityRowProvider,
} from "@/components/activities/activity-columns";
import { ActivityFormDrawer } from "@/components/activities/activity-form-drawer";
import { LeadFollowUpFormDrawer } from "@/components/leads/lead-followup-form-drawer";
import { ActivityTimelineDrawer } from "@/components/activities/activity-timeline-drawer";
import {
  LeadManageColumnsDrawer,
  type ManageableColumn,
} from "@/components/leads/lead-manage-columns-drawer";
import { LeadStatusProvider } from "@/components/leads/lead-status-badge";
import { LeadDetailProvider } from "@/components/leads/lead-detail-context";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadNoteDrawer } from "@/components/leads/lead-note-drawer";
import { LeadReassignDrawer } from "@/components/leads/lead-reassign-drawer";
import { useAuth } from "@/components/auth/auth-context";
import { can } from "@/constants/permissions";
import { fetchLeadForEdit } from "@/services/leads-service";
import {
  fetchLeadCustomFields,
  type LeadCustomField,
} from "@/services/leads-custom-fields-service";
import { LeadEmailDrawer } from "@/components/leads/lead-email-drawer";
import { LeadWhatsappDrawer } from "@/components/leads/lead-whatsapp-drawer";
import {
  deleteLead,
  pinLead,
  reassignLead,
  setLeadStatus,
  unpinLead,
} from "@/services/leads-row-actions-service";
import type { LeadListItem } from "@/services/leads-service";
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
  updateActivity,
  type ActivitiesQuery,
  type ActivityBucket,
  type ActivityDateWindow,
  type ActivityListItem,
  type ActivityType,
} from "@/services/activities-service";
import { TYPE_OPTIONS } from "@/components/activities/activity-form-parts";
import { ApiError } from "@/lib/api-client";
import { dayBoundaries, windowEdges } from "@/lib/day-boundaries";
import { whatsappUrl } from "@/lib/whatsapp";
import type { SelectOption } from "@/types";
import {
  CANCELLED,
  LOST_STATUS,
  useLostReasonPrompt,
} from "@/components/leads/lost-reason-prompt";

const NO_OPTIONS: {
  agents: SelectOption[];
  statuses: SelectOption[];
  pipelines: SelectOption[];
} = { agents: [], statuses: [], pipelines: [] };

/** Local midnight of the picked day — the From edge the server compares `>=` against. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The next local midnight, so a picked To date is included by a `<` comparison. */
function nextDay(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

/**
 * The columns Workpex's Activities worklist opens with. Everything else the table
 * can render — the activity's own dates and note, and the linked lead's fields — is
 * offered in Manage Columns but starts hidden, so the default view stays exactly as
 * the reference shows it.
 */
const DEFAULT_VISIBLE_COLUMNS = [
  "assigned",
  "customerName",
  "pipeline",
  "callStatus",
  "leadStatus",
];

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

  // A link may open the worklist on a particular tab and assignee — the Overdue Follow Ups
  // report's per-agent counts do exactly that, so the number opens the follow-ups it counted.
  // Read once as the initial state, never synced back: navigating inside the page afterwards
  // works exactly as it always has, and a plain /activities visit is unchanged.
  const params = useSearchParams();
  const [bucket, setBucket] = useState<ActivityBucket>(() => {
    const requested = params.get("bucket");
    return ACTIVITY_BUCKETS.includes(requested as ActivityBucket)
      ? (requested as ActivityBucket)
      : "overdue";
  });
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

  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActivityFilterState>(
    () => {
      const agent = params.get("agent");
      const type = params.get("type");
      return {
        ...EMPTY_ACTIVITY_FILTERS,
        assignedAgent: agent || null,
        type: TYPE_OPTIONS.some((option) => option.value === type)
          ? (type as ActivityType)
          : null,
      };
    },
  );
  const manageColumns = useDisclosure();
  const addFollowUp = useDisclosure();

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const query = useMemo<ActivitiesQuery>(() => {
    const { windows, from, to, type, assignedAgent } = activeFilters;
    // The wider window edges only matter when their checkbox is ticked, so they are
    // computed here and spread in only for the ticked ones — an unticked window
    // sends nothing and the request URL stays as small as the selection.
    const edges = windowEdges();
    const needs = (window: ActivityDateWindow) => windows.includes(window);
    return {
      bucket,
      page,
      size,
      ...boundaries,
      search: debouncedSearch.trim() || undefined,
      assignedAgent: assignedAgent ? [assignedAgent] : undefined,
      type: type ? [type] : undefined,
      dateWindow: windows.length > 0 ? windows : undefined,
      ...(needs("yesterday")
        ? { yesterdayStart: edges.yesterdayStart }
        : undefined),
      ...(needs("thisWeek")
        ? { weekStart: edges.weekStart, weekEnd: edges.weekEnd }
        : undefined),
      ...(needs("thisMonth")
        ? { monthStart: edges.monthStart, monthEnd: edges.monthEnd }
        : undefined),
      dueFrom: from ? startOfDay(from).toISOString() : undefined,
      // `To` is inclusive of the chosen day, and the server compares `< dueTo`, so
      // send the start of the following day.
      dueTo: to ? nextDay(to).toISOString() : undefined,
    };
  }, [bucket, page, size, boundaries, debouncedSearch, activeFilters]);

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
    action: "complete" | "delete";
  } | null>(null);
  // Row selection (the leading checkbox column Workpex shows) and the lead-status
  // + email targets, all reusing the shared Table/badge/drawer wiring.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  // The bulk action bar's two flows, each behind its own confirmation.
  const [bulkAction, setBulkAction] = useState<"complete" | "delete" | null>(
    null,
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const [emailTarget, setEmailTarget] = useState<ActivityListItem | null>(null);
  // The activity whose lead the WhatsApp composer is open for (the same drawer the
  // Leads row action opens — see the drawer render below).
  const [whatsappTarget, setWhatsappTarget] = useState<ActivityListItem | null>(
    null,
  );
  // The lead whose activity timeline the ↗ beside its name opened.
  const [timelineLead, setTimelineLead] = useState<LeadListItem | null>(null);

  // The Lead Details panel a Customer-Name click opens here, replacing the navigation to
  // /leads/{id}: the same drawer the Leads list opens, so the panel, its timeline feed and
  // every header action are the existing implementations rather than a second copy. Its
  // sub-drawers below are the shared Leads ones too — the worklist already mounts the mail
  // and WhatsApp composers for its row actions.
  const { user } = useAuth();
  const canReassign = can(user?.role, "reassignLeads");
  const [detailLead, setDetailLead] = useState<LeadListItem | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [leadEmail, setLeadEmail] = useState<LeadListItem | null>(null);
  const [leadWhatsapp, setLeadWhatsapp] = useState<LeadListItem | null>(null);
  const [noteTarget, setNoteTarget] = useState<LeadListItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<LeadListItem | null>(
    null,
  );
  const [deleteLeadTarget, setDeleteLeadTarget] = useState<LeadListItem | null>(
    null,
  );
  const [editLead, setEditLead] = useState<Awaited<
    ReturnType<typeof fetchLeadForEdit>
  > | null>(null);
  /**
   * The custom-field definitions the edit form needs. Not optional: on update the backend
   * full-replaces a lead's custom values with what the form sends, so opening the form
   * without the definitions would submit an empty set and wipe them.
   */
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomField[]>([]);
  const [leadBusy, setLeadBusy] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<LeadListItem | null>(
    null,
  );

  /**
   * Completes the panel's Next Follow-up through the same `completeActivity` call the
   * worklist's own circle uses, then refreshes both the list and the open panel. A 409 is
   * the location gate (ACT-10.1 / GPS-09.1); its message says which check-in is missing.
   */
  const handleCompleteFollowUp = async (id: string) => {
    try {
      await completeActivity(id);
      setDetailRefresh((token) => token + 1);
      refetch();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast({
          title:
            error.messages.join(" · ") ||
            error.message ||
            "Check in on site to complete this activity",
          tone: "danger",
        });
        return;
      }
      toast({ title: "Couldn’t complete the follow-up", tone: "danger" });
    }
  };

  /** Keeps the open panel's header in step with a change made from inside it. */
  const patchDetail = (next: LeadListItem) =>
    setDetailLead((current) =>
      current && current.id === next.id ? next : current,
    );

  const handleTogglePin = async (lead: LeadListItem) => {
    const isPinned = !lead.isPinned;
    patchDetail({ ...lead, isPinned });
    try {
      await (isPinned ? pinLead(lead.id) : unpinLead(lead.id));
      toast({
        title: `${lead.name} ${isPinned ? "pinned" : "unpinned"}`,
        tone: "success",
      });
    } catch {
      patchDetail(lead);
      toast({
        title: isPinned ? "Couldn’t pin lead" : "Couldn’t unpin lead",
        tone: "danger",
      });
    }
  };

  const handleEditLead = async (lead: LeadListItem) => {
    try {
      // Load the definitions alongside the lead, so the form can never submit an empty
      // custom-field set (which the backend would take as "clear them all").
      const [data, fields] = await Promise.all([
        fetchLeadForEdit(lead.id),
        fetchLeadCustomFields(),
      ]);
      setCustomFieldDefs(fields);
      setEditLead(data);
    } catch (error) {
      const gone = error instanceof ApiError && error.status === 404;
      toast({
        title: gone ? "This lead no longer exists" : "Couldn’t open the lead",
        tone: "danger",
      });
    }
  };

  const handleReassignLead = async (agentId: string) => {
    const lead = reassignTarget;
    if (!lead) return;
    setLeadBusy(true);
    try {
      await reassignLead(lead.id, agentId);
      setReassignTarget(null);
      setDetailRefresh((token) => token + 1);
      refetch();
      toast({ title: `${lead.name} reassigned`, tone: "success" });
    } catch {
      toast({ title: "Couldn’t reassign the lead", tone: "danger" });
    } finally {
      setLeadBusy(false);
    }
  };

  const handleDeleteLead = async () => {
    const lead = deleteLeadTarget;
    if (!lead) return;
    setLeadBusy(true);
    try {
      await deleteLead(lead.id);
      setDeleteLeadTarget(null);
      // The lead is gone, so its panel must close and the worklist drop its follow-ups.
      setDetailLead(null);
      refetch();
      toast({ title: `${lead.name} deleted`, tone: "success" });
    } catch {
      toast({ title: "Couldn’t delete the lead", tone: "danger" });
    } finally {
      setLeadBusy(false);
    }
  };

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

  const { ask: askLostReason, modal: lostReasonModal } = useLostReasonPrompt();
  /**
   * Lead Status is editable from the worklist, as it is on the Leads list: the same
   * `LeadStatusProvider` + `setLeadStatus` API, so both pages share one status
   * catalogue, one set of colours and one write path. Only this row's lead changes —
   * the optimistic override reverts if the server rejects it.
   */
  const handleStatusChange = async (row: ActivityListItem, status: string) => {
    // A move to LOST asks why first; skipping still sets LOST (no reason recorded),
    // cancelling abandons the change.
    let lostReason: string | undefined;
    if (status === LOST_STATUS) {
      const answer = await askLostReason(row.lead);
      if (answer === CANCELLED) return;
      lostReason = answer;
    }
    setStatusPendingId(row.lead.id);
    applyOverride(row.id, { lead: { ...row.lead, status } });
    try {
      const updated = await setLeadStatus(row.lead.id, status, lostReason);
      applyOverride(row.id, {
        lead: { ...updated, isPinned: row.lead.isPinned },
      });
      toast({ title: `${row.lead.name} set to ${status}`, tone: "success" });
    } catch {
      applyOverride(row.id, { lead: row.lead });
      toast({ title: "Couldn’t update status", tone: "danger" });
    } finally {
      setStatusPendingId(null);
    }
  };

  // The badge reads its lead from the row, so map the lead the provider hands back
  // to the activity row that carries it.
  const statusValue = {
    onChange: (lead: LeadListItem, status: string) => {
      const row = displayRows.find((r) => r.lead.id === lead.id);
      if (row) void handleStatusChange(row, status);
    },
    pendingId: statusPendingId,
  };

  /**
   * Bulk Mark as Complete / Delete from the selection bar.
   *
   * Reuses the per-activity APIs (ACT-04.1 / ACT-06.1) one call per row rather than
   * adding a bulk endpoint: each call keeps its own scope check and its own
   * location gate, so a row the caller may not complete still fails on its own and
   * the rest succeed. `allSettled`, so one rejection cannot abandon the others.
   */
  const runBulk = async (action: "complete" | "delete") => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) =>
        action === "complete" ? completeActivity(id) : deleteActivity(id),
      ),
    );
    const done = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - done;
    setBulkBusy(false);
    setBulkAction(null);

    if (done > 0) {
      // Only the rows that actually succeeded leave the selection; a failed one
      // stays selected so it can be retried.
      const failedIds = new Set(
        ids.filter((_, index) => results[index]?.status === "rejected"),
      );
      setSelectedIds(failedIds);
      refetch();
      const noun = done === 1 ? "activity" : "activities";
      toast({
        title:
          action === "complete"
            ? `${done} ${noun} marked as completed`
            : `${done} ${noun} deleted`,
        tone: "success",
      });
    }
    if (failed > 0) {
      const noun = failed === 1 ? "activity" : "activities";
      toast({
        title: `Couldn’t ${action === "complete" ? "complete" : "delete"} ${failed} ${noun}`,
        tone: "danger",
      });
    }
  };

  const changeBucket = (id: string) => {
    setBucket(id as ActivityBucket);
    setPage(1);
    setSelectedIds(new Set());
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
      // ACT-10.1 / GPS-09.1: the API returns 409 when the activity is location-tied
      // and no valid on-site check-in exists. The server now distinguishes "you never
      // checked in" from "your check-in was 182 m away", so show its message rather
      // than a fixed string — otherwise the specific reason is thrown away.
      if (error instanceof ApiError && error.status === 409) {
        toast({
          title:
            error.messages.join(" · ") ||
            error.message ||
            "Check in on site to complete this activity",
          tone: "danger",
        });
      } else {
        toast({ title: "Couldn't complete the activity", tone: "danger" });
      }
    } finally {
      setPending(null);
    }
  };

  /**
   * An in-place due date/time change from the row (Workpex edits the date on the
   * worklist, not only in the drawer). Reuses the existing `PATCH /activities/:id`
   * (ACT-05.1) — that endpoint is a full replace of the editable fields, so the row's
   * own current values are sent back alongside the new instant; no second API and no
   * sparse-patch variant. Optimistic, and reverted if the server rejects it.
   */
  const handleSaveDueDate = async (row: ActivityListItem, dueAt: string) => {
    if (row.description === null) {
      // The API requires a description on update, so a note-less row cannot be
      // saved from here without inventing one — send the user to the drawer.
      setEditTarget(row);
      return;
    }
    applyOverride(row.id, { dueAt });
    try {
      await updateActivity(row.id, {
        type: row.type,
        description: row.description,
        dueAt,
        endAt: row.endAt ?? undefined,
        locationId: row.locationId ?? undefined,
        assigneeIds: row.assignees.map((assignee) => assignee.id),
      });
      refetch();
      toast({ title: "Follow-up date updated", tone: "success" });
    } catch {
      clearOverride(row.id);
      toast({ title: "Couldn't update the date", tone: "danger" });
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

  const defaultHidden = useMemo(
    () =>
      manageableColumns
        .map((column) => column.key)
        .filter((key) => !DEFAULT_VISIBLE_COLUMNS.includes(key)),
    [manageableColumns],
  );

  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    manageableColumns.map((column) => column.key),
  );
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(
    () => defaultHidden,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchColumnLayout(ACTIVITIES_VIEW_KEY, controller.signal)
      .then((saved) => {
        const layout = reconcileLayout(
          saved,
          manageableColumns.map((column) => column.key),
          defaultHidden,
        );
        setColumnOrder(layout.order);
        setHiddenColumns(layout.hidden);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, [manageableColumns, defaultHidden]);

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
  // rather than remounting the table. The scroll region, sticky header and pinned
  // pagination footer around it are `TablePageLayout`'s — the same frame the Leads
  // list uses, so the two tables match without a second implementation.
  const table = (
    <ActivityRowProvider
      value={{
        onRequestComplete: setCompleteTarget,
        onRequestEdit: setEditTarget,
        onRequestDelete: setDeleteTarget,
        onRequestEmail: setEmailTarget,
        onRequestWhatsapp: setWhatsappTarget,
        onRequestTimeline: (row) => setTimelineLead(row.lead),
        onSaveDueDate: (row, dueAt) => void handleSaveDueDate(row, dueAt),
        overdueBefore: boundaries.todayStart,
        pendingId: pending?.id ?? null,
        pendingAction: pending?.action ?? null,
      }}
    >
      <LeadDetailProvider value={{ onOpen: setDetailLead }}>
        <LeadStatusProvider value={statusValue}>
          <Table
            columns={visibleColumns}
            rows={displayRows}
            getRowId={(row) => row.id}
            selection={{
              selectedIds,
              onToggleRow: (id) =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                }),
              onToggleAll: (ids) =>
                setSelectedIds((prev) => {
                  const allOn = ids.every((id) => prev.has(id));
                  const next = new Set(prev);
                  ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
                  return next;
                }),
              rowLabel: (row) => `Select ${row.title}`,
              allLabel: "Select all activities on this page",
            }}
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
        </LeadStatusProvider>
      </LeadDetailProvider>
      {lostReasonModal}
    </ActivityRowProvider>
  );

  const tabs = ACTIVITY_BUCKETS.map((id) => ({
    id,
    label: counts ? `${BUCKET_LABEL[id]} (${counts[id]})` : BUCKET_LABEL[id],
  }));

  return (
    <TablePageLayout
      title="Activities"
      tableLabel="Activities table"
      // Workpex puts the tabs and the toolbar on one row above the table.
      toolbarLeft={
        <TabStrip tabs={tabs} value={bucket} onValueChange={changeBucket} />
      }
      toolbarActions={
        <>
          <ToolbarSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name or title"
          />
          <ActivityFilterPanel
            value={activeFilters}
            agents={options.agents}
            onApply={(next) => {
              setActiveFilters(next);
              setPage(1);
              setSelectedIds(new Set());
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
          <button
            type="button"
            onClick={addFollowUp.open}
            className={TOOLBAR_BUTTON_CLASS}
          >
            <IconPlus size={18} stroke={1.75} />
            Add Follow-up
          </button>
        </>
      }
      pagination={{
        page,
        pageCount,
        total,
        onPageChange: setPage,
        pageSize: size,
        onPageSizeChange: changeSize,
      }}
    >
      {table}

      {/* Workpex's floating selection bar — the shared `BulkActionBar` the Leads
          list uses, with this module's two actions. */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          label={
            selectedIds.size === 1 ? "Activity Selected" : "Activities Selected"
          }
          busy={bulkBusy}
          onClear={() => setSelectedIds(new Set())}
          actions={[
            {
              key: "complete",
              label: "Mark as Complete",
              Icon: IconListCheck,
              onClick: () => setBulkAction("complete"),
            },
            {
              key: "delete",
              label: "Delete",
              Icon: IconTrash,
              onClick: () => setBulkAction("delete"),
            },
          ]}
        />
      )}

      <ConfirmDialog
        open={bulkAction === "complete"}
        onCancel={() => setBulkAction(null)}
        onConfirm={() => void runBulk("complete")}
        title="Confirmation"
        description={`Are you sure you want to mark ${selectedIds.size} ${
          selectedIds.size === 1 ? "activity" : "activities"
        } as completed? This action cannot be undone`}
        confirmLabel="Yes"
        cancelLabel="No"
        tone="brand"
        busy={bulkBusy}
      />

      <ConfirmDialog
        open={bulkAction === "delete"}
        onCancel={() => setBulkAction(null)}
        onConfirm={() => void runBulk("delete")}
        title="Confirmation"
        description={`Are you sure you want to delete ${selectedIds.size} ${
          selectedIds.size === 1 ? "activity" : "activities"
        }? This action cannot be undone`}
        confirmLabel="Yes"
        cancelLabel="No"
        busy={bulkBusy}
      />

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

      {/* The Lead Details panel: the same drawer the Leads list opens on a Customer-Name
          click, fetching this lead's own timeline and follow-ups. Its header actions delegate
          to the shared Leads flows below — no second implementation of any of them. */}
      {detailLead && (
        <LeadDetailDrawer
          open
          lead={detailLead}
          refreshToken={detailRefresh}
          onClose={() => setDetailLead(null)}
          actions={{
            onPin: (lead) => void handleTogglePin(lead),
            onWhatsapp: (lead) => setLeadWhatsapp(lead),
            onEmail: (lead) => setLeadEmail(lead),
            onEdit: (lead) => void handleEditLead(lead),
            onReassign: (lead) => setReassignTarget(lead),
            onDelete: (lead) => setDeleteLeadTarget(lead),
            onAddNote: (lead) => setNoteTarget(lead),
            onNewFollowUp: (lead) => setFollowUpTarget(lead),
            onCompleteFollowUp: (activity) =>
              void handleCompleteFollowUp(activity.id),
            canReassign,
          }}
        />
      )}

      {leadEmail && (
        <LeadEmailDrawer
          open
          lead={leadEmail}
          onClose={() => setLeadEmail(null)}
          onSent={() => {
            setLeadEmail(null);
            toast({ title: "Email sent", tone: "success" });
          }}
        />
      )}

      {leadWhatsapp && (
        <LeadWhatsappDrawer
          open
          lead={leadWhatsapp}
          onClose={() => setLeadWhatsapp(null)}
          onSend={({ phone, message }) => {
            const base = whatsappUrl(phone);
            if (base) {
              window.open(
                `${base}?text=${encodeURIComponent(message)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }
            setLeadWhatsapp(null);
          }}
        />
      )}

      {noteTarget && (
        <LeadNoteDrawer
          open
          lead={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSaved={() => {
            setNoteTarget(null);
            // A note is a timeline event: refresh the open panel so Recent Notes and the
            // Timeline pick it up without reopening.
            setDetailRefresh((token) => token + 1);
            toast({ title: "Note added", tone: "success" });
          }}
        />
      )}

      {reassignTarget && (
        <LeadReassignDrawer
          open
          count={1}
          submitting={leadBusy}
          onClose={() => setReassignTarget(null)}
          onReassign={(agentId) => void handleReassignLead(agentId)}
        />
      )}

      <ConfirmDialog
        open={deleteLeadTarget !== null}
        title="Delete lead"
        description={
          deleteLeadTarget
            ? `Delete ${deleteLeadTarget.name}? This also removes their follow-ups.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={leadBusy}
        onCancel={() => setDeleteLeadTarget(null)}
        onConfirm={() => void handleDeleteLead()}
      />

      {editLead && (
        <LeadFormDrawer
          open
          lead={editLead}
          customFields={customFieldDefs}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => {
            patchDetail(updated);
            setEditLead(null);
            refetch();
            toast({ title: `${updated.name} updated`, tone: "success" });
          }}
        />
      )}

      {/* The lead's email composer, reused from the Leads row action (LEAD-10.2) so
          the worklist's Mail icon opens the same drawer rather than a second one. */}
      {emailTarget && (
        <LeadEmailDrawer
          open
          lead={emailTarget.lead}
          onClose={() => setEmailTarget(null)}
          onSent={() => {
            setEmailTarget(null);
            toast({ title: "Email sent", tone: "success" });
          }}
        />
      )}

      {/* The lead's WhatsApp composer, reused from the Leads row action (LEAD-10.2):
          the same drawer, the same template list and the same `wa.me` hand-off, so the
          worklist gains the composer rather than a second WhatsApp implementation. The
          recipient prefills from the linked lead's own primary phone. */}
      {whatsappTarget && (
        <LeadWhatsappDrawer
          open
          lead={whatsappTarget.lead}
          onClose={() => setWhatsappTarget(null)}
          onSend={({ phone, message }) => {
            // The same hand-off the Leads row uses: the composer's Send opens the
            // existing wa.me deep-link with the composed template prefilled.
            const base = whatsappUrl(phone);
            if (base) {
              window.open(
                `${base}?text=${encodeURIComponent(message)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }
            setWhatsappTarget(null);
          }}
        />
      )}

      {/* New Follow-up from the Lead Details panel — the same create drawer, with the
          panel's lead fixed so its Lead field is prefilled rather than searched for. */}
      {followUpTarget && (
        <LeadFollowUpFormDrawer
          lead={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onCreated={() => {
            setFollowUpTarget(null);
            setDetailRefresh((token) => token + 1);
            refetch();
            toast({ title: "Follow-up created", tone: "success" });
          }}
        />
      )}

      {/* Add Follow-up (ACT-03.2): the same create drawer the Lead Detail panel opens,
          with no lead fixed, so it renders its "Search Leads" picker instead. */}
      {addFollowUp.isOpen && (
        <LeadFollowUpFormDrawer
          onClose={addFollowUp.close}
          onCreated={() => {
            addFollowUp.close();
            // A refetch is what places the new follow-up: it reloads the active tab
            // and every bucket count, so the row surfaces in whichever tab its due
            // date puts it in rather than being guessed into the current one.
            refetch();
            toast({ title: "Follow-up created", tone: "success" });
          }}
        />
      )}

      {/* The lead's activity timeline (the ↗ beside a customer name) — the same
          `LeadTimeline` feed the Lead Detail drawer renders, in a drawer shell. */}
      {timelineLead && (
        <ActivityTimelineDrawer
          key={timelineLead.id}
          lead={timelineLead}
          onClose={() => setTimelineLead(null)}
        />
      )}

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
    </TablePageLayout>
  );
}
