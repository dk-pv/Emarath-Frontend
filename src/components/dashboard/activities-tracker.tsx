"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  ActivityRowActions,
  ActivityRowProvider,
} from "@/components/activities/activity-columns";
import { ActivityFormDrawer } from "@/components/activities/activity-form-drawer";
import { ActivityTimelineDrawer } from "@/components/activities/activity-timeline-drawer";
import { TYPE_LABEL } from "@/components/activities/activity-form-parts";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LeadEmailDrawer } from "@/components/leads/lead-email-drawer";
import { LeadWhatsappDrawer } from "@/components/leads/lead-whatsapp-drawer";
import { DEFAULT_PAGE_SIZE } from "@/constants/table";
import { isAbortError } from "@/lib/api-client";
import { dayBoundaries } from "@/lib/day-boundaries";
import { formatDate, formatTime } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  completeActivity,
  deleteActivity,
  updateActivity,
  type ActivityListItem,
} from "@/services/activities-service";
import {
  fetchActivitiesTracker,
  type ActivityTrackerGroup,
} from "@/services/dashboard-service";
import type { LeadListItem } from "@/services/leads-service";
import type { TableColumn } from "@/types";
import { DashboardTable } from "./dashboard-table";
import {
  DashboardStatCard,
  type DashboardStatCardTone,
} from "./dashboard-stat-card";

/**
 * The four cards, in the reference's order and hues: Overdue blue, Today's
 * Activity green, Tomorrow peach, This Month purple
 * (dashboard-quick-add-plus-menu-open.png). Selecting one filters the table beside
 * it.
 */
const GROUPS: {
  key: ActivityTrackerGroup;
  title: string;
  tone: DashboardStatCardTone;
}[] = [
  { key: "overdue", title: "Overdue", tone: "blue" },
  { key: "today", title: "Today's Activity", tone: "green" },
  { key: "tomorrow", title: "Tomorrow", tone: "peach" },
  { key: "thisMonth", title: "This Month", tone: "purple" },
];

const COUNT = new Intl.NumberFormat("en-US", { useGrouping: false });

/**
 * The reference's five columns, no more: Assigned User, Follow Up Type, Lead Name,
 * Date/Time, Actions. Built per render because the avatar column reads the page's
 * own signed URLs, which arrive with the rows.
 */
function columnsFor(
  avatars: Record<string, string | null>,
): readonly TableColumn<ActivityListItem>[] {
  return [
    {
      key: "assignedUser",
      header: "Assigned User",
      /**
       * One line, always. Every reference row carries a single assignee, so the
       * shape there is avatar + name; a shared follow-up must not be allowed to
       * stack and blow the row's fixed pitch, which is the whole point of a
       * height-capped table. Extra assignees overlap their avatars — the
       * Activities list's own `-space-x-1` idiom for exactly this — and the names
       * join and ellipse.
       */
      render: (row) =>
        row.assignees.length === 0 ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex shrink-0 items-center -space-x-1">
              {row.assignees.map((assignee) => (
                /* No initials fallback: the reference draws the neutral grey
                   silhouette for a member without a photo, which is what Avatar
                   renders when given neither a src nor initials. */
                <Avatar
                  key={assignee.id}
                  name={assignee.name}
                  src={avatars[assignee.id] ?? undefined}
                  size="sm"
                  className={
                    row.assignees.length > 1 ? "ring-2 ring-surface" : undefined
                  }
                />
              ))}
            </span>
            {/* The cap has to sit on the cell's own content box: `max-width` on a
                `<td>` is advisory in an auto table layout, so without it the
                column widens to the longest name list and pushes Actions off the
                card. `max-w-50` is 200px ≈ the reference's 238px Assigned User
                column at this density, less the avatar and its gap. */}
            <span className="max-w-50 truncate text-ink">
              {row.assignees.map((assignee) => assignee.name).join(", ")}
            </span>
          </span>
        ),
    },
    {
      key: "followUpType",
      header: "Follow Up Type",
      // The worklist's own labels, not a second mapping of the same enum.
      render: (row) => TYPE_LABEL[row.type],
    },
    {
      key: "leadName",
      header: "Lead Name",
      // The product's one way into a lead — keeps history, so Back returns here.
      render: (row) => (
        <CustomerNameLink leadId={row.lead.id} name={row.lead.name} />
      ),
    },
    {
      key: "dueAt",
      header: "Date/Time",
      // Two lines — date over time — as the reference draws it, through the shared
      // formatters rather than a format invented here. `padHour` gives the
      // reference's "05:00 PM" rather than "5:00 PM".
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="text-ink">{formatDate(row.dueAt)}</span>
          <span className="text-xs text-ink-muted">
            {formatTime(row.dueAt, { padHour: true })}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      // The Activities worklist's own row actions, unchanged — same handlers, same
      // endpoints, same confirmations. They read everything from the row context
      // this widget provides below.
      render: (row) => <ActivityRowActions row={row} />,
    },
  ];
}

/**
 * The cap that fixes this widget's height, whatever the API returns.
 *
 * **The table drives, the rail follows.** The cards are grid items and stretch, so
 * the rail takes its height from this number rather than the other way round —
 * which is what keeps the two columns' edges level, as the reference draws them
 * (rail 337–927, table 344–931 in dashboard-quick-add-plus-menu-open.png). Raising
 * the cap makes the cards taller; it cannot make them clip.
 *
 * 592 = the 43px header plus ten 54px rows and a sliver of the eleventh — measured
 * off the rendered page, and the same count the reference shows (its body is 538 at
 * a 54px pitch, nine full rows and a part). That sliver is deliberate: a row cut by
 * the bottom edge is how both captures signal the body scrolls.
 *
 * Written out rather than computed because Tailwind scans source text: a class
 * built at runtime generates no CSS and the cap would silently not exist.
 */
const TABLE_HEIGHT_CLASS = "max-h-[592px]";
const SKELETON_HEIGHT_CLASS = "h-[592px]";

/**
 * The Dashboard's Activities tracker (DASH-09.2).
 *
 * **No new business rules and no second worklist.** The four counts and the page
 * come from `GET /api/dashboard/activities`, which composes the Activities module's
 * own bucket predicates under the configured overdue rule — so a card here and the
 * tab badge on the Activities page count the same rows, and role scoping is applied
 * in that query rather than in the browser.
 *
 * The row actions are the worklist's `ActivityRowActions`, driven by the same
 * `ActivityRowProvider` contract and calling the same endpoints. What this widget
 * deliberately does *not* copy is the list view's optimistic row overlay: after a
 * write it simply refetches, which is correct on a widget whose table is one small
 * page and keeps the flows here to the API call itself.
 *
 * **No period filter.** Its four buckets *are* the date dimension — "Overdue within
 * this week" is not a thing the reference offers — and the reference draws no chip
 * on this widget's header.
 */
export function ActivitiesTracker() {
  const { toast } = useToast();
  const [group, setGroup] = useState<ActivityTrackerGroup>("overdue");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [loaded, setLoaded] = useState<{
    key: string;
    counts: Record<ActivityTrackerGroup, number>;
    rows: readonly ActivityListItem[];
    avatars: Record<string, string | null>;
    total: number;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Group, page and size together identify a request. Tagging the result with the
  // key is what stops a slow earlier page repainting over a newer one, and lets the
  // effect avoid resetting state on its way in, which would cascade a render — the
  // same rule every other Dashboard read follows.
  const key = `${group}|${page}|${pageSize}`;

  const [completeTarget, setCompleteTarget] = useState<ActivityListItem | null>(
    null,
  );
  const [editTarget, setEditTarget] = useState<ActivityListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ActivityListItem | null>(
    null,
  );
  const [emailLead, setEmailLead] = useState<LeadListItem | null>(null);
  const [whatsappLead, setWhatsappLead] = useState<LeadListItem | null>(null);
  const [timelineLead, setTimelineLead] = useState<LeadListItem | null>(null);
  const [pending, setPending] = useState<{
    id: string;
    action: "complete" | "delete";
  } | null>(null);

  const refetch = () => setReloadToken((token) => token + 1);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchActivitiesTracker(group, page, pageSize, controller.signal)
      .then((result) => {
        if (!active) return;
        setLoaded({
          key,
          counts: result.counts,
          rows: result.rows,
          avatars: result.avatars,
          total: result.total,
        });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone.
        console.error("Activities tracker failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, group, page, pageSize, reloadToken]);

  const current = loaded?.key === key ? loaded : null;
  const isError = failed === key;
  const isLoading = current === null && !isError;
  // The previous group's rows stay put while the next loads, so the card rail does
  // not jump under the pointer as the user clicks down it.
  const counts = current?.counts ?? loaded?.counts;
  const rows = current?.rows ?? loaded?.rows ?? [];
  const avatars = current?.avatars ?? loaded?.avatars ?? {};
  const total = current?.total ?? loaded?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const select = (next: ActivityTrackerGroup) => {
    setGroup(next);
    // "Page 4" is meaningless once the row set changes.
    setPage(1);
  };

  const confirmComplete = async () => {
    const target = completeTarget;
    if (!target) return;
    setCompleteTarget(null);
    setPending({ id: target.id, action: "complete" });
    try {
      await completeActivity(target.id);
      refetch();
    } catch {
      toast({ title: "Couldn't complete the activity", tone: "danger" });
    } finally {
      setPending(null);
    }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    setPending({ id: target.id, action: "delete" });
    try {
      await deleteActivity(target.id);
      refetch();
      toast({ title: "Follow-up deleted", tone: "success" });
    } catch {
      toast({ title: "Couldn’t delete the activity", tone: "danger" });
    } finally {
      setPending(null);
    }
  };

  /**
   * An in-place due date/time change. Reuses `PATCH /activities/:id` exactly as the
   * worklist does — that endpoint replaces the editable fields, so the row's own
   * current values go back with the new instant.
   */
  const saveDueDate = async (row: ActivityListItem, dueAt: string) => {
    if (row.description === null) {
      // The API requires a description on update, so a note-less row cannot be
      // saved from here without inventing one — send the user to the drawer.
      setEditTarget(row);
      return;
    }
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
      toast({ title: "Couldn't update the date", tone: "danger" });
    }
  };

  return (
    <Card as="section" className="flex flex-col gap-4 p-5">
      <h2 className="text-xl font-semibold text-ink">Activities</h2>

      {isError ? (
        <ErrorState
          title="Couldn’t load Activities"
          description="Something went wrong loading this widget. Check your connection and try again."
          onRetry={() => {
            setFailed(null);
            refetch();
          }}
        />
      ) : (
        // The rail is a fixed 322px (reference 358 × 0.9) and the table takes the
        // rest, with the reference's 27px gutter → 24 at this density. Below `lg`
        // the rail stacks above the table and the cards spread across the row.
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,322px)_minmax(0,1fr)]">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1 [&>*]:min-w-0">
            {GROUPS.map((entry) => (
              <DashboardStatCard
                key={entry.key}
                title={entry.title}
                value={counts ? COUNT.format(counts[entry.key]) : "—"}
                tone={entry.tone}
                active={group === entry.key}
                onClick={() => select(entry.key)}
                // The table sits beside this rail, not under it, so the caret
                // leaves the card's right edge (the shared card's `right` case).
                pointer="right"
              />
            ))}
          </div>

          {isLoading && loaded === null ? (
            <Skeleton
              className={`${SKELETON_HEIGHT_CLASS} w-full rounded-surface`}
            />
          ) : (
            <ActivityRowProvider
              value={{
                onRequestComplete: setCompleteTarget,
                onRequestEdit: setEditTarget,
                onRequestDelete: setDeleteTarget,
                onRequestEmail: (row) => setEmailLead(row.lead),
                onRequestWhatsapp: (row) => setWhatsappLead(row.lead),
                onRequestTimeline: (row) => setTimelineLead(row.lead),
                onSaveDueDate: (row, dueAt) => void saveDueDate(row, dueAt),
                // The same local midnight the query was built from, so the red
                // overdue ink agrees exactly with the server's Overdue bucket.
                overdueBefore: dayBoundaries().todayStart,
                pendingId: pending?.id ?? null,
                pendingAction: pending?.action ?? null,
              }}
            >
              <DashboardTable
                label="Activities"
                columns={columnsFor(avatars)}
                rows={rows}
                getRowId={(row) => row.id}
                isFetching={isLoading}
                bodyClassName={TABLE_HEIGHT_CLASS}
                // 49px rows — the reference measures this table at a 54px pitch,
                // 49 at the chosen density (ADR-0076), matching the other three
                // Dashboard tables.
                rowClassName={() => "[&>td]:py-2.5"}
                emptyTitle="No activities"
                emptyDescription="There are no activities in this view."
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                total={total}
              />
            </ActivityRowProvider>
          )}
        </div>
      )}

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

      {/* The worklist's own drawers, unchanged — one Edit form, one email composer
          and one WhatsApp composer across the product. */}
      {editTarget && (
        <ActivityFormDrawer
          activity={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            refetch();
            toast({ title: "Follow-up updated", tone: "success" });
          }}
        />
      )}

      {emailLead && (
        <LeadEmailDrawer
          open
          lead={emailLead}
          onClose={() => setEmailLead(null)}
          onSent={() => {
            setEmailLead(null);
            toast({ title: "Email sent", tone: "success" });
          }}
        />
      )}

      {whatsappLead && (
        <LeadWhatsappDrawer
          open
          lead={whatsappLead}
          onClose={() => setWhatsappLead(null)}
          onSend={({ phone, message }) => {
            const base = whatsappUrl(phone);
            if (base) {
              window.open(
                `${base}?text=${encodeURIComponent(message)}`,
                "_blank",
                "noopener",
              );
            }
            setWhatsappLead(null);
          }}
        />
      )}

      {timelineLead && (
        <ActivityTimelineDrawer
          lead={timelineLead}
          onClose={() => setTimelineLead(null)}
        />
      )}
    </Card>
  );
}
