"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconColumns,
  IconDownload,
  IconFlag,
  IconFlagFilled,
  IconNote,
  IconPhoneIncoming,
  IconPhoneOutgoing,
  IconPhonePlus,
  IconTimelineEvent,
  IconUserPlus,
} from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import {
  LeadManageColumnsDrawer,
  type ManageableColumn,
} from "@/components/leads/lead-manage-columns-drawer";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadFollowUpFormDrawer } from "@/components/leads/lead-followup-form-drawer";
import { LeadNoteDrawer } from "@/components/leads/lead-note-drawer";
import { ActivityTimelineDrawer } from "@/components/activities/activity-timeline-drawer";
import { fetchLead, type LeadListItem } from "@/services/leads-service";
import { useStages } from "@/components/stages/stages-context";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  CALLS_VIEW_KEY,
  fetchColumnLayout,
  reconcileLayout,
  saveColumnLayout,
} from "@/services/view-preferences-service";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import type { TableColumn } from "@/types";
import {
  fetchCallLog,
  setCallFlagged,
  type CallLogResponse,
  type CallLogRow,
  type CallOutcome,
} from "@/services/calls-service";
import { resolveCallRange, type CallFilterState } from "./call-filter-panel";
import {
  CallLogFilterPanel,
  EMPTY_CALL_LOG_FILTERS,
  callLogFilterCount,
  type CallLogFilterState,
} from "./call-log-filter-panel";

/** The quick outcome tabs (CALL-06.1 AC1); All clears the outcome filter. */
const OUTCOME_TABS: { label: string; value: CallOutcome | null }[] = [
  { label: "All", value: null },
  { label: "Answered", value: "ANSWERED" },
  { label: "No answer", value: "NO_ANSWER" },
  { label: "Busy", value: "BUSY" },
];

const OUTCOME: Record<CallOutcome, { label: string; className: string }> = {
  ANSWERED: { label: "ANSWERED", className: "text-ink" },
  NO_ANSWER: { label: "NO ANSWER", className: "text-danger" },
  BUSY: { label: "BUSY", className: "text-warning" },
};

function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">--</span>;
}

/** The reference stacks the date over the time in one cell. */
function DateTimeCell({ iso }: { iso: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-ink">{formatDate(iso)}</span>
      <span className="text-xs text-ink-muted">
        {formatTime(iso, { seconds: true })}
      </span>
    </span>
  );
}

/**
 * What a row action needs to reach: the row itself, and which action was asked
 * for. The drawers all take a full `LeadListItem`, which a log row does not
 * carry, so the lead is fetched when an action opens rather than widening every
 * page of the log with a payload only a click needs.
 */
type RowAction = "followUp" | "note" | "timeline";

type RowContext = {
  onToggleFlag: (row: CallLogRow) => void;
  onRowAction: (row: CallLogRow, action: RowAction) => void;
  pendingFlagId: string | null;
};

const ACTION_CLASS =
  "focus-ring inline-flex size-7 items-center justify-center rounded-control text-ink-subtle transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-40";

function buildColumns(ctx: RowContext): TableColumn<CallLogRow>[] {
  return [
    {
      key: "leadName",
      header: "Lead Name",
      render: (row) => (
        // Direction indicator (AC2) + the drill-through link to the lead (AC4).
        <span className="flex items-center gap-2">
          {row.direction === "INBOUND" ? (
            <IconPhoneIncoming
              size={16}
              stroke={1.75}
              className="shrink-0 text-ink-subtle"
              aria-label="Inbound"
            />
          ) : (
            <IconPhoneOutgoing
              size={16}
              stroke={1.75}
              className="shrink-0 text-ink-subtle"
              aria-label="Outbound"
            />
          )}
          <CustomerNameLink leadId={row.leadId} name={row.leadName} />
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => <span className="text-ink">{row.phone}</span>,
    },
    {
      key: "dateTime",
      header: "Date & Time",
      render: (row) => <DateTimeCell iso={row.startedAt} />,
    },
    {
      key: "outcome",
      header: "Call Outcome",
      render: (row) => (
        <span className={cn("font-medium", OUTCOME[row.outcome].className)}>
          {OUTCOME[row.outcome].label}
        </span>
      ),
    },
    {
      key: "leadStatus",
      header: "Lead Status",
      // LeadStatusBadge reads only `.status` here (no LeadStatusProvider → a plain
      // pill); the log row carries just the status string.
      render: (row) => (
        <LeadStatusBadge lead={{ status: row.leadStatus } as LeadListItem} />
      ),
    },
    {
      key: "nextFollowUp",
      header: "Next Follow-up",
      render: (row) =>
        row.nextFollowUp ? (
          <DateTimeCell iso={row.nextFollowUp} />
        ) : (
          <span className="text-ink-subtle">--</span>
        ),
    },
    {
      key: "leadNotes",
      header: "Lead Notes",
      render: (row) => orDash(row.leadNotes),
    },
    {
      key: "callNotes",
      header: "Call Notes",
      render: (row) => orDash(row.callNotes),
    },
    {
      key: "audioClip",
      header: "Audio Clip",
      render: (row) =>
        row.audioUrl ? (
          <a
            href={row.audioUrl}
            download
            className="focus-ring inline-flex items-center gap-1 rounded-control text-sm text-brand-strong underline-offset-2 hover:underline"
          >
            <IconDownload size={16} stroke={1.75} aria-hidden="true" />
            Recording
          </a>
        ) : (
          <span className="text-ink-subtle">--</span>
        ),
    },
    {
      key: "tags",
      header: "Tags",
      render: (row) =>
        row.tags.length === 0 ? (
          <span className="text-ink-subtle">--</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <Tag key={tag.id}>{tag.name}</Tag>
            ))}
          </span>
        ),
    },
    {
      key: "assignedTo",
      header: "Assigned To",
      render: (row) =>
        row.assignedTo.length === 0 ? (
          <span className="text-ink-subtle">--</span>
        ) : (
          <span className="text-ink">
            {row.assignedTo.map((agent) => agent.name).join(", ")}
          </span>
        ),
    },
    {
      key: "leadSource",
      header: "Lead Source",
      render: (row) => orDash(row.leadSource),
    },
    {
      key: "leadStage",
      header: "Lead Stage",
      // Workpex suffixes the stage with its pipeline, so two boards can share a name.
      render: (row) => (
        <span className="text-ink">
          {row.leadStatus}{" "}
          <span className="text-ink-muted">({row.leadPipeline})</span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <span className="flex items-center gap-0.5">
          <Tooltip content={row.flagged ? "Unflag" : "Flag"}>
            <button
              type="button"
              aria-label={row.flagged ? "Unflag call" : "Flag call"}
              aria-pressed={row.flagged}
              disabled={ctx.pendingFlagId === row.id}
              onClick={() => ctx.onToggleFlag(row)}
              className={cn(ACTION_CLASS, row.flagged && "text-danger")}
            >
              {row.flagged ? (
                <IconFlagFilled size={16} aria-hidden="true" />
              ) : (
                <IconFlag size={16} stroke={1.75} aria-hidden="true" />
              )}
            </button>
          </Tooltip>

          <Tooltip content="Add note">
            <button
              type="button"
              aria-label="Add note"
              onClick={() => ctx.onRowAction(row, "note")}
              className={ACTION_CLASS}
            >
              <IconNote size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <Tooltip content="Add Followup">
            <button
              type="button"
              aria-label="Add follow-up"
              onClick={() => ctx.onRowAction(row, "followUp")}
              className={ACTION_CLASS}
            >
              <IconUserPlus size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          {/* Disabled, not hidden: the reference greys this control on a row with
              no recording, and every call here has one only once 3CX supplies it. */}
          <Tooltip
            content={row.audioUrl ? "Download recording" : "No recording"}
          >
            {row.audioUrl ? (
              <a
                href={row.audioUrl}
                download
                aria-label="Download recording"
                className={ACTION_CLASS}
              >
                <IconDownload size={16} stroke={1.75} aria-hidden="true" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-label="No recording available"
                className={ACTION_CLASS}
              >
                <IconDownload size={16} stroke={1.75} aria-hidden="true" />
              </button>
            )}
          </Tooltip>

          <Tooltip content="Timeline">
            <button
              type="button"
              aria-label="Open timeline"
              onClick={() => ctx.onRowAction(row, "timeline")}
              className={ACTION_CLASS}
            >
              <IconTimelineEvent size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </span>
      ),
    },
  ];
}

/**
 * The manageable columns the reference shows on load. Lead Name is the frozen
 * identifier and Actions the fixed right edge, so neither is manageable; the five
 * that are declared but absent here — Audio Clip, Tags, Assigned To, Lead Source,
 * Lead Stage — are offered by Manage Columns without widening the default table
 * past what Workpex shows.
 */
/** Matches the Leads list's default page size, so the two tables page alike. */
const DEFAULT_PAGE_SIZE = 20;

const MANAGEABLE_KEYS = [
  "phone",
  "dateTime",
  "outcome",
  "leadStatus",
  "nextFollowUp",
  "leadNotes",
  "callNotes",
  "audioClip",
  "tags",
  "assignedTo",
  "leadSource",
  "leadStage",
];

const DEFAULT_VISIBLE_COLUMNS = [
  "phone",
  "dateTime",
  "outcome",
  "leadStatus",
  "nextFollowUp",
  "leadNotes",
  "callNotes",
];

/**
 * The Recent Call Log (CALL-05.2): the scoped, paginated table behind the KPIs,
 * over whatever the dashboard's one Filter selects. Reuses the shared Table,
 * Pagination, the shared Manage Columns drawer, and the same follow-up, note and
 * timeline drawers the Leads and Activities pages open — the row actions here
 * are wiring, not a second implementation of any of them.
 */
export function CallLog({ filters }: { filters: CallFilterState }) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: CallLogResponse;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  /** Rows whose flag was toggled since the last fetch, so the icon stays truthful. */
  const [flagOverrides, setFlagOverrides] = useState<Record<string, boolean>>(
    {},
  );
  const [pendingFlagId, setPendingFlagId] = useState<string | null>(null);

  // The drawers all need a full lead; the log row only has its id.
  const [actionTarget, setActionTarget] = useState<{
    action: RowAction;
    lead: LeadListItem;
  } | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const { stages } = useStages();
  /**
   * The log's own Filter, per the Workpex reference. `outcome` is shared with the
   * tabs above the table — the reference shows both, and they are one selection.
   */
  const [logFilters, setLogFilters] = useState<CallLogFilterState>(
    EMPTY_CALL_LOG_FILTERS,
  );
  const leadStatusOptions = useMemo(
    () => stages.map((stage) => ({ label: stage.name, value: stage.name })),
    [stages],
  );

  /** The window and agent come from the dashboard's own Filter, unchanged. */
  const range = useMemo(() => resolveCallRange(filters), [filters]);

  const requestKey = `${page}|${size}|${outcome ?? ""}|${debouncedSearch}|${range.from}|${range.to}|${range.agentId ?? ""}|${logFilters.leadStatus ?? ""}|${logFilters.timeMetric ?? ""}|${logFilters.flaggedOnly}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallLog(
      range,
      page,
      {
        outcome: outcome ?? undefined,
        search: debouncedSearch || undefined,
        leadStatus: logFilters.leadStatus ?? undefined,
        timeMetric: logFilters.timeMetric ?? undefined,
        flagged: logFilters.flaggedOnly || undefined,
        size,
      },
      controller.signal,
    )
      .then((data) => {
        if (!active) return;
        setLoaded({ key: requestKey, data });
        // A fresh page is the server's truth; local flag echoes are spent.
        setFlagOverrides({});
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailed(requestKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    page,
    size,
    outcome,
    debouncedSearch,
    range,
    logFilters,
    requestKey,
    reloadToken,
  ]);

  // A dashboard-level filter change is a different result set, so the page has to
  // go back to 1. Adjusted during render against the last filters seen — an effect
  // would fetch page N of the new set first, then immediately refetch page 1.
  const [lastFilters, setLastFilters] = useState(filters);
  if (lastFilters !== filters) {
    setLastFilters(filters);
    setPage(1);
  }

  const toggleFlag = useCallback(
    async (row: CallLogRow) => {
      const next = !(flagOverrides[row.id] ?? row.flagged);
      setPendingFlagId(row.id);
      try {
        await setCallFlagged(row.id, next);
        setFlagOverrides((prev) => ({ ...prev, [row.id]: next }));
        toast({
          title: next
            ? "Call log flagged successfully"
            : "Call log unflagged successfully",
          tone: "success",
        });
      } catch {
        toast({ title: "Couldn’t update the flag", tone: "danger" });
      } finally {
        setPendingFlagId(null);
      }
    },
    [flagOverrides, toast],
  );

  const openRowAction = useCallback(
    async (row: CallLogRow, action: RowAction) => {
      setLoadingAction(true);
      try {
        setActionTarget({ action, lead: await fetchLead(row.leadId) });
      } catch {
        toast({ title: "Couldn’t open that lead", tone: "danger" });
      } finally {
        setLoadingAction(false);
      }
    },
    [toast],
  );

  const columns = useMemo(
    () =>
      buildColumns({
        onToggleFlag: (row) => void toggleFlag(row),
        onRowAction: (row, action) => void openRowAction(row, action),
        pendingFlagId,
      }),
    [toggleFlag, openRowAction, pendingFlagId],
  );

  // Column layout, wired exactly as the Activities list wires it: the same drawer,
  // the same reconcile step and the same per-user server persistence, under this
  // view's own key. Lead Name is the frozen identifier and Actions the fixed right
  // edge, so neither is offered for reorder or hiding.
  const manageableColumns = useMemo<ManageableColumn[]>(
    () =>
      columns
        .filter(
          (column) => column.key !== "leadName" && column.key !== "actions",
        )
        .map((column) => ({ key: column.key, label: String(column.header) })),
    [columns],
  );

  const defaultHidden = useMemo(
    () =>
      manageableColumns
        .map((column) => column.key)
        .filter((key) => !DEFAULT_VISIBLE_COLUMNS.includes(key)),
    [manageableColumns],
  );

  const manageColumns = useDisclosure();
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    DEFAULT_VISIBLE_COLUMNS.concat(
      MANAGEABLE_KEYS.filter((key) => !DEFAULT_VISIBLE_COLUMNS.includes(key)),
    ),
  );
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() =>
    MANAGEABLE_KEYS.filter((key) => !DEFAULT_VISIBLE_COLUMNS.includes(key)),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchColumnLayout(CALLS_VIEW_KEY, controller.signal)
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
        /* an unavailable layout just leaves the module default in place */
      });
    return () => controller.abort();
  }, [manageableColumns, defaultHidden]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(columns.map((column) => [column.key, column]));
    const hidden = new Set(hiddenColumns);
    const keys = [
      "leadName",
      ...columnOrder.filter((key) => !hidden.has(key)),
      "actions",
    ];
    return keys
      .map((key) => byKey.get(key))
      .filter((column): column is (typeof columns)[number] => Boolean(column));
  }, [columns, columnOrder, hiddenColumns]);

  const data = loaded?.key === requestKey ? loaded.data : null;
  const isError = failed === requestKey;
  const isLoading = (!data && !isError) || loadingAction;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const anyActive =
    outcome !== null ||
    searchInput.trim() !== "" ||
    callLogFilterCount(logFilters) > 0;

  // Local flag echoes are applied on read so a toggle shows immediately without
  // refetching the whole page.
  const rows = useMemo(
    () =>
      (data?.rows ?? []).map((row) =>
        row.id in flagOverrides
          ? { ...row, flagged: flagOverrides[row.id] }
          : row,
      ),
    [data, flagOverrides],
  );

  return (
    <section>
      {/* One row above the table, as the reference shows: the heading stands
          outside the bordered table on the left, and the tabs, search, Manage
          Columns and Filter travel together on the right. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-ink">Recent Call Log</h3>

        {/* One line from `lg` up, as the reference shows; below that the controls
            are allowed to wrap rather than squeeze. */}
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          {/* Outcome tabs (AC1) — All clears the outcome. */}
          <div className="flex shrink-0 items-center gap-1">
            {OUTCOME_TABS.map((tab) => {
              const activeTab = outcome === tab.value;
              return (
                <button
                  key={tab.label}
                  type="button"
                  aria-pressed={activeTab}
                  onClick={() => {
                    setOutcome(tab.value);
                    setPage(1);
                  }}
                  className={cn(
                    "focus-ring h-control-sm rounded-full px-3 text-sm font-medium transition-colors duration-(--duration-shell) ease-shell",
                    activeTab
                      ? "bg-brand text-ink"
                      : "text-ink-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <SearchInput
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            placeholder="Search by Name or Phone"
            aria-label="Search by name or phone"
            className="w-64 max-w-full min-w-0"
          />
          <button
            type="button"
            onClick={manageColumns.open}
            className={cn(TOOLBAR_BUTTON_CLASS, "shrink-0")}
          >
            <IconColumns size={18} stroke={1.75} aria-hidden="true" />
            Manage Columns
          </button>
          <CallLogFilterPanel
            value={{ ...logFilters, outcome }}
            leadStatuses={leadStatusOptions}
            onApply={(next) => {
              setLogFilters(next);
              setOutcome(next.outcome);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Card>
        {isError ? (
          <div className="p-4">
            <ErrorState
              title="Couldn’t load the call log"
              description="Something went wrong loading recent calls. Check your connection and try again."
              onRetry={() => {
                setFailed(null);
                setReloadToken((token) => token + 1);
              }}
            />
          </div>
        ) : (
          <ResponsiveTableContainer label="Recent call log">
            <Table
              columns={visibleColumns}
              rows={rows}
              getRowId={(row) => row.id}
              isLoading={isLoading}
              emptyState={
                <EmptyState
                  icon={IconPhonePlus}
                  title="No records yet"
                  description={
                    anyActive
                      ? "No calls match your search or filters."
                      : "Calls for this period will appear here once they are logged."
                  }
                />
              }
            />
          </ResponsiveTableContainer>
        )}

        {data && (
          <div className="border-t border-hairline px-4 py-3">
            {/* The full footer the Leads list uses — rows-per-page beside the row
              count — so a long call history is workable, not just paged. */}
            <Pagination
              page={page}
              pageCount={pageCount}
              total={data.total}
              pageSize={size}
              onPageSizeChange={(next) => {
                setSize(next);
                setPage(1);
              }}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

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
            // Optimistic: the table already reflects the change, so a failed save
            // only means it will not survive a reload.
            void saveColumnLayout(CALLS_VIEW_KEY, { order, hidden }).catch(
              () => {},
            );
          }}
        />
      )}

      {/* Add Follow-up: the same create drawer Leads and Activities open, with
          this call's lead fixed. No second follow-up system. */}
      {actionTarget?.action === "followUp" && (
        <LeadFollowUpFormDrawer
          lead={actionTarget.lead}
          onClose={() => setActionTarget(null)}
          onCreated={() => {
            setActionTarget(null);
            toast({ title: "Follow-up created", tone: "success" });
            // Refetch so the row's Next Follow-up reflects the new activity.
            setReloadToken((token) => token + 1);
          }}
        />
      )}

      {actionTarget?.action === "note" && (
        <LeadNoteDrawer
          open
          lead={actionTarget.lead}
          onClose={() => setActionTarget(null)}
          onSaved={() => {
            setActionTarget(null);
            toast({ title: "Note added", tone: "success" });
            setReloadToken((token) => token + 1);
          }}
        />
      )}

      {actionTarget?.action === "timeline" && (
        <ActivityTimelineDrawer
          key={actionTarget.lead.id}
          lead={actionTarget.lead}
          onClose={() => setActionTarget(null)}
        />
      )}
    </section>
  );
}
