"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconColumns,
  IconFileImport,
  IconFilterX,
  IconPlus,
  IconSearch,
  IconUsers,
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
import { LeadFilterBuilder } from "@/components/leads/lead-filter-builder";
import { useAdvancedFilter } from "@/hooks/use-advanced-filter";
import { LeadAddColumnMenu } from "@/components/leads/lead-add-column-menu";
import { LeadBulkBar } from "@/components/leads/lead-bulk-bar";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadReassignDrawer } from "@/components/leads/lead-reassign-drawer";
import { LeadWhatsappDrawer } from "@/components/leads/lead-whatsapp-drawer";
import { LeadEmailDrawer } from "@/components/leads/lead-email-drawer";
import { LeadNoteDrawer } from "@/components/leads/lead-note-drawer";
import { LeadDetailDrawer } from "@/components/leads/lead-detail-drawer";
import { LeadDetailProvider } from "@/components/leads/lead-detail-context";
import { LeadFollowUpFormDrawer } from "@/components/leads/lead-followup-form-drawer";
import {
  LeadManageColumnsDrawer,
  type ManageableColumn,
} from "@/components/leads/lead-manage-columns-drawer";
import { LeadExportMenu } from "@/components/leads/lead-export-menu";
import { LeadQuickFilterControl } from "@/components/leads/lead-quick-filter-control";
import { presetConditions } from "@/components/leads/lead-quick-filters";
import { LeadSortControl } from "@/components/leads/lead-sort-control";
import { leadColumns } from "@/components/leads/lead-columns";
import { buildCustomColumns } from "@/components/leads/lead-custom-columns";
import { SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useFilters } from "@/hooks/use-filters";
import { useListData } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import {
  fetchLeadForEdit,
  fetchLeads,
  type LeadActivity,
  type LeadEditData,
  type LeadListItem,
} from "@/services/leads-service";
import {
  fetchLeadCustomFields,
  type LeadCustomField,
} from "@/services/leads-custom-fields-service";
import { completeActivity } from "@/services/activities-service";
import { ApiError } from "@/lib/api-client";
import {
  CONVERTED_STATUS,
  LeadRowActionsProvider,
} from "@/components/leads/lead-row-actions";
import { LeadStatusProvider } from "@/components/leads/lead-status-badge";
import {
  LeadTagsProvider,
  type TagOption,
} from "@/components/leads/lead-tags-cell";
import {
  deleteLead,
  pinLead,
  reassignLead,
  setLeadStatus,
  unpinLead,
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
import { useAuth } from "@/components/auth/auth-context";
import { whatsappUrl } from "@/lib/whatsapp";
import { can } from "@/constants/permissions";
import type {
  FilterCondition,
  FilterField,
  FilterState,
  TableColumn,
} from "@/types";
import {
  CANCELLED,
  LOST_STATUS,
  useLostReasonPrompt,
} from "@/components/leads/lost-reason-prompt";

/**
 * useFilters supplies the search state; Leads renders no shared FilterPanel, so it
 * needs no filter-field catalogue (the advanced LeadFilterBuilder loads its own
 * lookups). A stable empty list keeps that state without a wasted options fetch.
 */
const NO_FILTER_FIELDS: FilterField[] = [];

/** The search bar's scope options, in the reference's order. */
const SEARCH_SCOPES = [
  { value: "lead", label: "Lead" },
  { value: "duplicate", label: "Duplicate Lead" },
] as const;

/**
 * The real Leads list (LEAD-02.2) with search, filter and sort wired in
 * (LEAD-03.3). Everything is a composition of the Foundation: search is the
 * toolbar ToolbarSearch, advanced filtering the LeadFilterBuilder, quick filters
 * the LeadQuickFilterControl; search state comes from useFilters, paging/sort from
 * useListQuery, and fetching from useListData.
 *
 * Search is debounced so a 15,000+ row query does not run per keystroke, while
 * the box stays controlled by the live value.
 */
/**
 * Columns that start hidden until a user turns them on in Manage Columns — the requested
 * default table is the 30 Workpex columns without "NO. OF MSG ATTEMPTS". The data still rides
 * every row, so enabling the column costs no request.
 */
const DEFAULT_HIDDEN_LEAD_COLUMNS: readonly string[] = ["whatsappAttempts"];

export function LeadsListView({
  initialStatus = null,
  initialConditions = null,
}: {
  /** A Lead Status to arrive filtered by (the `?status=` deep link); null for the plain list. */
  initialStatus?: string | null;
  /** A full `conditions` payload to start applied; takes precedence over `initialStatus`. */
  initialConditions?: string | null;
} = {}) {
  const { user } = useAuth();
  // Reassignment is a managers-and-admins tool (AUTH-02.2); hide its triggers otherwise.
  // The backend @Roles() gate is the real block — this just keeps the UI honest.
  const canReassign = can(user?.role, "reassignLeads");

  // The full existing-tag catalogue the row Tags picker offers (LEAD-12.1 AC1):
  // every existing tag, since a lead with none can still take any.
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

  const filters = useFilters(NO_FILTER_FIELDS);

  // Quick Filter preset (LEAD-04.1). One preset at a time; its conditions ride the
  // same list query as the field filters, so no new filter path exists. Kept in its
  // own state (not the panel's) so the active preset can be indicated and cleared
  // independently.
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetFilters, setPresetFilters] = useState<FilterCondition[]>([]);

  // The advanced filter (ADR-0039/0040/0052) — draft rows, the applied `conditions`
  // payload that drives the query, and the caller's saved presets. The same hook backs
  // the Kanban board's filter, so list and board can never diverge (KAN-07.1 AC5).
  // Applying resets to page 1 through a ref, since `list` is created below from it.
  const resetPageRef = useRef<() => void>(() => {});
  const onFilterApplied = useCallback(() => resetPageRef.current(), []);
  // The deep link's status becomes one applied builder condition, so the Filter badge
  // reads "1", the builder shows the row, and Clear All removes it like any other.
  const seededConditions = useMemo(
    () =>
      initialConditions ??
      (initialStatus
        ? JSON.stringify([
            { field: "status", operator: "is", values: [initialStatus] },
          ])
        : undefined),
    [initialConditions, initialStatus],
  );
  const advancedFilter = useAdvancedFilter({
    onApplied: onFilterApplied,
    initialConditions: seededConditions,
  });

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(
    filters.state.search,
    SEARCH_DEBOUNCE_MS,
  );
  // The search bar's "Lead / Duplicate Lead" selector rides the same condition
  // pipeline as the quick-filter presets, reaching the API as `?searchScope=duplicate`.
  const [searchScope, setSearchScope] = useState<string>("lead");
  const queryState = useMemo<FilterState>(
    () => ({
      search: debouncedSearch,
      conditions: [
        ...filters.state.conditions,
        ...presetFilters,
        ...(searchScope === "duplicate"
          ? [{ key: "searchScope", value: "duplicate" }]
          : []),
      ],
    }),
    [debouncedSearch, filters.state.conditions, presetFilters, searchScope],
  );

  const list = useListQuery({
    filters: queryState,
    conditions: advancedFilter.appliedConditions,
  });
  useEffect(() => {
    resetPageRef.current = list.resetPage;
  }, [list.resetPage]);

  // Apply a preset (or clear with null); the menu resolves a re-select to null.
  const applyQuickFilter = (id: string | null) => {
    setActivePreset(id);
    setPresetFilters(id ? presetConditions(id) : []);
    list.resetPage();
  };

  // Empty-state actions. Clear just the search, or clear every filter (quick preset +
  // advanced builder), each resetting paging via the existing list-query behavior.
  const clearSearch = () => {
    filters.setSearch("");
    list.resetPage();
  };
  const clearAllFilters = () => {
    setActivePreset(null);
    setPresetFilters([]);
    advancedFilter.clear();
    list.resetPage();
  };
  const { rows, total, isLoading, isFetching, isError, refetch } = useListData(
    fetchLeads,
    list.query,
    { keepPreviousData: true },
  );

  const newLead = useDisclosure();
  const pageCount = Math.max(1, Math.ceil(total / list.size));

  // If the active page falls past the end of the result — e.g. a bulk delete shrinks
  // the set while the user sits on a later page — step back to the last real page
  // rather than stranding them on an empty out-of-range page. Search/filter/sort
  // already reset to page 1; this covers the data-shrinks-underneath case. Gated on a
  // settled fetch so it reads the current total, not a kept-stale one.
  useEffect(() => {
    if (!isFetching && total > 0 && list.page > pageCount) {
      list.setPage(pageCount);
    }
  }, [isFetching, total, pageCount, list]);

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
  // The lead whose WhatsApp composer is open (LEAD-10.2). Null when closed; set
  // per-open so each drawer starts from that lead's own phone.
  const [whatsappTarget, setWhatsappTarget] = useState<LeadListItem | null>(
    null,
  );
  // The lead whose Email composer is open (LEAD-10.2, ADR-0032). Set per-open so To
  // starts from that lead's own email (or empty when it has none).
  const [emailTarget, setEmailTarget] = useState<LeadListItem | null>(null);
  // The lead whose Add Note composer is open (LEAD-10.2, ADR-0035). Set per-open so
  // each drawer starts from an empty note.
  const [noteTarget, setNoteTarget] = useState<LeadListItem | null>(null);
  // The lead whose Detail drawer is open (Lead Detail, from a Customer-Name click).
  // Held whole so the header reflects live changes (pin/edit); `detailRefresh` forces
  // the timeline to refetch after a note or reassignment adds an event.
  const [detailLead, setDetailLead] = useState<LeadListItem | null>(null);
  const [detailRefresh, setDetailRefresh] = useState(0);
  const syncDetail = (id: string, next: LeadListItem | null) =>
    setDetailLead((current) => (current && current.id === id ? next : current));
  // The lead whose Add New Follow-up form is open (ACT-03.2), and the next follow-up
  // awaiting a completion confirmation (ACT-04.1) — both opened from the Detail drawer.
  const [followUpTarget, setFollowUpTarget] = useState<LeadListItem | null>(
    null,
  );
  const [completeTarget, setCompleteTarget] = useState<LeadActivity | null>(
    null,
  );
  // The lead being edited (LEAD-06 edit mode): the full record that prefills the
  // shared form, plus the row's current pin so the patched row keeps it (the update
  // response, like the other row mutations, doesn't carry the caller's pin).
  const [editLead, setEditLead] = useState<{
    data: LeadEditData;
    isPinned: boolean;
  } | null>(null);
  const [rowPending, setRowPending] = useState<{
    id: string;
    action: "reassign" | "delete" | "pin" | "edit";
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
      // Pin is orthogonal to assignment and the mutation response doesn't carry
      // the caller's pin, so keep the known-local value (ADR-0031).
      patchRow(lead.id, { ...updated, isPinned: lead.isPinned });
      // Keep an open Detail drawer in step, and refresh its timeline (a new
      // assignment is a timeline event).
      syncDetail(lead.id, { ...updated, isPinned: lead.isPinned });
      setDetailRefresh((token) => token + 1);
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
      // A deleted lead has no record to show — close its Detail drawer if open.
      syncDetail(lead.id, null);
      toast({ title: `${lead.name} deleted`, tone: "success" });
    } catch {
      toast({ title: "Couldn’t delete lead", tone: "danger" });
    } finally {
      setRowPending(null);
    }
  };

  // Complete the Detail drawer's next follow-up (ACT-04.1) after the confirmation.
  // Reuses the existing complete API; a success bumps the drawer so its Next
  // Follow-up card and Timeline (a new "Completed" event) refetch.
  const handleCompleteFollowUp = async () => {
    const activity = completeTarget;
    if (!activity) return;
    setCompleteTarget(null);
    try {
      await completeActivity(activity.id);
      setDetailRefresh((token) => token + 1);
      toast({
        title: "Activity status updated to Completed",
        tone: "success",
      });
    } catch (error) {
      toast({
        title:
          error instanceof ApiError
            ? error.messages.join(" · ") || error.message
            : "Couldn’t complete the follow-up",
        tone: "danger",
      });
    }
  };

  // Pin toggle (LEAD-10.2, ADR-0031). Personal, per-user: the icon flips
  // optimistically, the pin/unpin API persists it, then a refetch lets the server
  // reorder — pinned leads float to the top of the list. The row reverts if the
  // server rejects the change.
  const handleTogglePin = async (lead: LeadListItem) => {
    const nextPinned = !lead.isPinned;
    setRowPending({ id: lead.id, action: "pin" });
    patchRow(lead.id, { ...lead, isPinned: nextPinned });
    syncDetail(lead.id, { ...lead, isPinned: nextPinned });
    try {
      await (nextPinned ? pinLead(lead.id) : unpinLead(lead.id));
      toast({
        title: `${lead.name} ${nextPinned ? "pinned" : "unpinned"}`,
        tone: "success",
      });
      // The server owns the pinned-first order; refetch to apply it.
      refetch();
    } catch {
      patchRow(lead.id, lead);
      syncDetail(lead.id, lead);
      toast({
        title: nextPinned ? "Couldn’t pin lead" : "Couldn’t unpin lead",
        tone: "danger",
      });
    } finally {
      setRowPending(null);
    }
  };

  // A plain object with fresh closures each render, matching statusValue/tagsValue
  // below — onPin needs the current row data (for the optimistic patch and
  // refetch), which a memo keyed on rowPending/canReassign would capture stale.
  // WhatsApp send (LEAD-10.2). The row icon only opens the composer; this fires the
  // existing wa.me deep-link — with the composed template text prefilled — and is
  // reached ONLY by the drawer's Send button, never by clicking the icon.
  const handleWhatsappSend = ({
    phone,
    message,
  }: {
    phone: string;
    message: string;
  }) => {
    const base = whatsappUrl(phone);
    if (base) {
      window.open(
        `${base}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setWhatsappTarget(null);
  };

  // Edit (LEAD-06 edit mode). The list row carries only the visible columns, so the
  // full editable record is fetched first (a per-row spinner runs meanwhile); once it
  // lands, the shared New Lead form opens in edit mode, prefilled. A 404 means the
  // lead was deleted out from under the list — reported, not a blank form.
  const handleEdit = async (lead: LeadListItem) => {
    setRowPending({ id: lead.id, action: "edit" });
    try {
      const data = await fetchLeadForEdit(lead.id);
      setEditLead({ data, isPinned: lead.isPinned });
    } catch (error) {
      const gone = error instanceof ApiError && error.status === 404;
      if (gone) patchRow(lead.id, null);
      toast({
        title: gone ? "This lead no longer exists" : "Couldn’t open the lead",
        tone: "danger",
      });
    } finally {
      setRowPending(null);
    }
  };

  // Convert (ADR-0048). A confirm dialog, then the existing set-status API sets the
  // lead's status to the approved converted value (WON — the Converted Leads report /
  // quick filter definition). Non-optimistic: the dialog's own loading covers the wait;
  // on success the row is patched to the persisted status (so its Status badge and the
  // green Convert icon both update) and the dialog closes; on failure nothing changes and
  // the dialog stays open to retry. A ref makes a double-click fire exactly one mutation.
  const [convertTarget, setConvertTarget] = useState<LeadListItem | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const convertingRef = useRef(false);

  const handleConvert = async () => {
    const lead = convertTarget;
    if (!lead || convertingRef.current) return;
    convertingRef.current = true;
    setConvertBusy(true);
    try {
      const updated = await setLeadStatus(lead.id, CONVERTED_STATUS);
      patchRow(lead.id, { ...updated, isPinned: lead.isPinned });
      syncDetail(lead.id, { ...updated, isPinned: lead.isPinned });
      setConvertTarget(null);
      toast({ title: `${lead.name} converted`, tone: "success" });
    } catch {
      toast({
        title: "Unable to convert lead",
        description: "Please try again.",
        tone: "danger",
      });
    } finally {
      convertingRef.current = false;
      setConvertBusy(false);
    }
  };

  const rowActionsValue = {
    onReassign: (lead: LeadListItem) => setRowReassignTarget(lead),
    onDelete: (lead: LeadListItem) => setRowDeleteTarget(lead),
    onWhatsapp: (lead: LeadListItem) => setWhatsappTarget(lead),
    onEmail: (lead: LeadListItem) => setEmailTarget(lead),
    onAddNote: (lead: LeadListItem) => setNoteTarget(lead),
    onEdit: (lead: LeadListItem) => void handleEdit(lead),
    onPin: (lead: LeadListItem) => void handleTogglePin(lead),
    onConvert: (lead: LeadListItem) => setConvertTarget(lead),
    pendingId: rowPending?.id ?? null,
    pendingAction: rowPending?.action ?? null,
    canReassign,
  };

  // Inline status change (LEAD-11.1, from lead-status.mp4). The badge dropdown picks
  // a status; the save flow is uncaptured, so this is a documented fallback (ADR-0015):
  // update the affected row optimistically, call the LEAD-10.1 set-status API, and
  // toast — reverting the row if the server rejects it.
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);

  const { ask: askLostReason, modal: lostReasonModal } = useLostReasonPrompt();
  const handleStatusChange = async (lead: LeadListItem, status: string) => {
    // A move to LOST asks why first; skipping still sets LOST (no reason recorded),
    // cancelling abandons the change.
    let lostReason: string | undefined;
    if (status === LOST_STATUS) {
      const answer = await askLostReason(lead);
      if (answer === CANCELLED) return;
      lostReason = answer;
    }
    setStatusPendingId(lead.id);
    patchRow(lead.id, { ...lead, status });
    try {
      const updated = await setLeadStatus(lead.id, status, lostReason);
      // Preserve the caller's pin — the status response doesn't carry it (ADR-0031).
      patchRow(lead.id, { ...updated, isPinned: lead.isPinned });
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
      patchRow(lead.id, { ...updated, isPinned: lead.isPinned });
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
      patchRow(lead.id, { ...updated, isPinned: lead.isPinned });
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

  // Custom-column definitions (LEAD-05.1). App-global (single-tenant); loaded once and
  // refreshed after a field is created so the new column appears without a reload.
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomField[]>([]);
  const [customFieldsToken, setCustomFieldsToken] = useState(0);
  const refreshCustomFields = () => setCustomFieldsToken((token) => token + 1);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadCustomFields(controller.signal)
      .then(setCustomFieldDefs)
      .catch((error: unknown) => {
        // Aborted on unmount; expected. Any other failure just leaves the table
        // with its standard columns — the list still works.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, [customFieldsToken]);

  // The full Leads column set: the standard columns with the custom ones spliced in
  // just before Actions. From here everything is generic — visibility and order are
  // governed by the per-user layout (below), not this array's position.
  const allColumns = useMemo<TableColumn<LeadListItem>[]>(() => {
    const actions = leadColumns.filter((column) => column.key === "actions");
    const standard = leadColumns.filter((column) => column.key !== "actions");
    return [...standard, ...buildCustomColumns(customFieldDefs), ...actions];
  }, [customFieldDefs]);

  // Custom columns (LEAD-05.1). Customer Name (the frozen identifier) and the row
  // actions are fixed; every other column — standard or custom — can be reordered and
  // shown or hidden. Custom keys join automatically because they are in `allColumns`.
  const manageableColumns = useMemo<ManageableColumn[]>(
    () =>
      allColumns
        .filter((column) => column.key !== "name" && column.key !== "actions")
        .map((column) => ({ key: column.key, label: String(column.header) })),
    [allColumns],
  );

  // The layout starts at the default and is replaced once the caller's saved
  // layout loads (AC3). Order and the hidden set persist per user server-side.
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    manageableColumns.map((column) => column.key),
  );
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([
    ...DEFAULT_HIDDEN_LEAD_COLUMNS,
  ]);
  const manageColumns = useDisclosure();

  useEffect(() => {
    const controller = new AbortController();
    fetchColumnLayout(LEADS_VIEW_KEY, controller.signal)
      .then((saved) => {
        const layout = reconcileLayout(
          saved,
          manageableColumns.map((column) => column.key),
          DEFAULT_HIDDEN_LEAD_COLUMNS,
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
    const byKey = new Map(allColumns.map((column) => [column.key, column]));
    const hidden = new Set(hiddenColumns);
    const orderedKeys = [
      "name",
      ...columnOrder.filter((key) => !hidden.has(key)),
      "actions",
    ];
    return orderedKeys
      .map((key) => byKey.get(key))
      .filter((column): column is TableColumn<LeadListItem> => Boolean(column));
  }, [allColumns, columnOrder, hiddenColumns]);

  // Export (LEAD-08.1). Downloads the current view — the same query the list runs
  // (search/filter/sort/scope) — in the chosen format. "My Default" sends the
  // visible data columns in order; Actions is a control, not data, so it is dropped.
  const handleExport = (format: ExportFormat, scope: ExportScope) => {
    const columnKeys = visibleColumns
      .map((column) => column.key)
      .filter((key) => key !== "actions");
    downloadLeadsExport(format, scope, list.query, columnKeys);
  };

  // Three distinct empty states (not one generic "no data"): a search with no match, an
  // active filter with no match, or a genuinely empty list — each with its own recovery
  // action. Search takes precedence when both a search and a filter are active. Only
  // rendered when the settled total is 0 (below); an out-of-range page is corrected, not
  // shown as empty.
  const searchTerm = filters.state.search.trim();
  const hasActiveFilter =
    activePreset !== null || advancedFilter.appliedCount > 0;
  const leadsEmptyState = searchTerm ? (
    <EmptyState
      icon={IconSearch}
      title="No leads found"
      description={`No leads match “${searchTerm}”.`}
      action={
        <Button variant="ghost" size="sm" onClick={clearSearch}>
          Clear search
        </Button>
      }
    />
  ) : hasActiveFilter ? (
    <EmptyState
      icon={IconFilterX}
      title="No matching leads"
      description="Try adjusting or clearing your filters."
      action={
        <Button variant="ghost" size="sm" onClick={clearAllFilters}>
          Clear filters
        </Button>
      }
    />
  ) : (
    <EmptyState
      icon={IconUsers}
      title="No leads yet"
      description="Create your first lead to get started."
      action={
        <Button size="sm" onClick={newLead.open}>
          <IconPlus size={18} stroke={2} />
          New Lead
        </Button>
      }
    />
  );

  return (
    <>
      <TablePageLayout
        title="Leads"
        tableLabel="Leads table"
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
              placeholder="Search"
              scope={{
                value: searchScope,
                options: SEARCH_SCOPES,
                onChange: (value) => {
                  setSearchScope(value);
                  list.resetPage();
                },
              }}
            />
            <LeadFilterBuilder filter={advancedFilter} label="Leads" />
            <LeadSortControl
              sort={list.sort}
              onSortChange={list.setSort}
              onClear={list.clearSort}
            />
            <LeadQuickFilterControl
              active={activePreset}
              onChange={applyQuickFilter}
            />
            <LeadAddColumnMenu
              onCreated={(field) => {
                refreshCustomFields();
                toast({
                  title: `Column “${field.name}” added`,
                  tone: "success",
                });
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
        <LeadDetailProvider value={{ onOpen: setDetailLead }}>
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
                    // Pinned beside the sticky Customer Name (its `left-10` is this
                    // cell's 40px), so the two never scroll apart.
                    cellClassName:
                      "sticky left-0 z-10 w-10 min-w-10 bg-surface group-hover:bg-canvas",
                    onToggleAll: toggleAll,
                    rowLabel: (row) => `Select ${row.name}`,
                    allLabel: "Select all leads on this page",
                  }}
                  isLoading={isLoading}
                  isFetching={isFetching}
                  // Only a genuinely empty result (total 0) is "empty"; an out-of-range
                  // page (rows empty but total > 0) is corrected above, not shown here.
                  emptyState={total === 0 ? leadsEmptyState : undefined}
                  errorState={
                    isError ? (
                      <ErrorState
                        title="Unable to load leads"
                        description="Something went wrong while loading your leads."
                        onRetry={refetch}
                      />
                    ) : undefined
                  }
                />
              </LeadTagsProvider>
            </LeadStatusProvider>
            {lostReasonModal}
          </LeadRowActionsProvider>
        </LeadDetailProvider>
      </TablePageLayout>

      {/* Lead Detail drawer — opened by a Customer-Name click (drawer on the Leads
          list; the /leads/[id] page stays for Activities + deep links). Every header
          action reuses the list's existing flow; the sub-drawers those open
          (WhatsApp/Email/Edit/Reassign/Note) mount below and stack over this one. */}
      {detailLead && (
        <LeadDetailDrawer
          open
          lead={detailLead}
          refreshToken={detailRefresh}
          onClose={() => setDetailLead(null)}
          actions={{
            onPin: (lead) => void handleTogglePin(lead),
            onWhatsapp: (lead) => setWhatsappTarget(lead),
            onEmail: (lead) => setEmailTarget(lead),
            onEdit: (lead) => void handleEdit(lead),
            onReassign: (lead) => setRowReassignTarget(lead),
            onDelete: (lead) => setRowDeleteTarget(lead),
            onAddNote: (lead) => setNoteTarget(lead),
            onNewFollowUp: (lead) => setFollowUpTarget(lead),
            onCompleteFollowUp: (activity) => setCompleteTarget(activity),
            canReassign,
          }}
        />
      )}

      {/* Add New Follow-up (ACT-03.2) — opened from the Detail drawer's New Follow-up
          button. Stacks over the detail drawer; a successful create refreshes the
          drawer so Next Follow-up and the Timeline pick up the new activity. */}
      {followUpTarget && (
        <LeadFollowUpFormDrawer
          lead={followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          onCreated={() => {
            setFollowUpTarget(null);
            setDetailRefresh((token) => token + 1);
            toast({ title: "Follow-up added successfully", tone: "success" });
          }}
        />
      )}

      {/* Complete follow-up (ACT-04.1) — the Next Follow-up card's checkmark asks to
          confirm before completing, matching Workpex. */}
      <ConfirmDialog
        open={completeTarget !== null}
        onCancel={() => setCompleteTarget(null)}
        onConfirm={() => void handleCompleteFollowUp()}
        title="Confirmation"
        description="Would you like to mark this activity as completed?"
        confirmLabel="Yes"
        tone="brand"
      />

      {/* Convert (ADR-0048) — confirm, then set the lead's status to WON via the existing
          set-status API. `busy` keeps the dialog open with a loading Convert button and
          blocks accidental dismissal while the mutation runs. */}
      <ConfirmDialog
        open={convertTarget !== null}
        onCancel={() => setConvertTarget(null)}
        onConfirm={() => void handleConvert()}
        title="Convert lead?"
        description="Are you sure you want to convert this lead?"
        confirmLabel="Convert"
        tone="brand"
        busy={convertBusy}
      />

      {selectedIds.size > 0 && (
        <LeadBulkBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onReassign={reassignDrawer.open}
          onDelete={confirmDelete.open}
          busy={bulkBusy}
          canReassign={canReassign}
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

      {/* Row "WhatsApp" (LEAD-10.2) — the Send Whatsapp Message composer. Mounted
          per-open so it starts from the clicked lead's own phone; Send hands off to
          the existing wa.me deep-link (handleWhatsappSend). */}
      {whatsappTarget && (
        <LeadWhatsappDrawer
          open
          lead={whatsappTarget}
          onClose={() => setWhatsappTarget(null)}
          onSend={handleWhatsappSend}
        />
      )}

      {/* Row "Email" (LEAD-10.2, ADR-0032) — the Send Email composer. Mounted per-open
          so To starts from the clicked lead's own email; the send happens on the
          backend, and only a successful send closes the drawer + toasts. */}
      {emailTarget && (
        <LeadEmailDrawer
          open
          lead={emailTarget}
          onClose={() => setEmailTarget(null)}
          onSent={() => {
            setEmailTarget(null);
            toast({ title: "Email sent", tone: "success" });
          }}
        />
      )}

      {/* Row "Add Note" (LEAD-10.2, ADR-0035) — the Add Note composer. Mounted
          per-open so it starts empty; the note persists on the backend, and only a
          successful save closes the drawer + toasts. */}
      {noteTarget && (
        <LeadNoteDrawer
          open
          lead={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSaved={() => {
            setNoteTarget(null);
            // A new note is a timeline event — refresh an open Detail drawer so
            // Recent Notes and the Timeline pick it up.
            setDetailRefresh((token) => token + 1);
            toast({ title: "Note added", tone: "success" });
          }}
        />
      )}

      {/* Mounted only while open, so every New Lead starts from a clean form. */}
      {newLead.isOpen && (
        <LeadFormDrawer
          open
          customFields={customFieldDefs}
          onClose={newLead.close}
          onSaved={(lead) => {
            newLead.close();
            toast({ title: `${lead.name} created`, tone: "success" });
            refetch();
          }}
        />
      )}

      {/* Edit Lead (LEAD-06 edit mode): the SAME form, mounted per-open with the
          fetched record so it starts prefilled. A successful update patches just
          that row (keeping the caller's pin, which the response omits) and toasts —
          no full refetch, matching the other single-row mutations. */}
      {editLead && (
        <LeadFormDrawer
          open
          lead={editLead.data}
          customFields={customFieldDefs}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => {
            patchRow(updated.id, { ...updated, isPinned: editLead.isPinned });
            // Keep an open Detail drawer's header in step with the edit.
            syncDetail(updated.id, { ...updated, isPinned: editLead.isPinned });
            setEditLead(null);
            toast({ title: `${updated.name} updated`, tone: "success" });
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
