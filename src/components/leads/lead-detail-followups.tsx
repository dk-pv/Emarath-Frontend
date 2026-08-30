"use client";

import { useMemo, useState } from "react";
import {
  IconCalendar,
  IconLoader2,
  IconPlus,
  IconUser,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ReportToolbarSelect } from "@/components/reports/report-toolbar-select";
import {
  ROWS_PER_PAGE_OPTIONS,
  RowsPerPage,
} from "@/components/ui/RowsPerPage";
import { TYPE_LABEL } from "@/components/activities/activity-form-parts";
import { LeadDetailAddButton } from "@/components/leads/lead-detail-section";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { LeadActivity } from "@/services/leads-service";

type Tab = "followup" | "history";

const TABS: { key: Tab; label: string }[] = [
  { key: "followup", label: "Follow-up" },
  { key: "history", label: "History" },
];

/** The date buckets the reference's "Date Filter" offers, applied to the due date. */
const DATE_FILTERS = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
];

function inDateBucket(dueAt: string, bucket: string, now: Date): boolean {
  const due = new Date(dueAt).getTime();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const end = start + 24 * 60 * 60 * 1000;
  if (bucket === "overdue") return due < start;
  if (bucket === "today") return due >= start && due < end;
  if (bucket === "upcoming") return due >= end;
  return true;
}

export type LeadDetailFollowUpsProps = {
  activities: LeadActivity[];
  loading?: boolean;
  errored?: boolean;
  onRetry?: () => void;
  /** Opens the Add New Follow-up drawer. */
  onAdd: () => void;
};

/**
 * The Lead Detail page's Follow-up / History section, matched to the supplied reference:
 * folder-style tabs on the panel, the Assigned To / Date Filter controls and the green add
 * control on the same row, over the records area with its "Add Follow-up" call to action.
 *
 * Follow-ups are the lead's real activities (`GET /leads/:id/activities`) — the same feed
 * the Leads-list detail drawer reads — so both filters act on data actually in hand rather
 * than being decorative. History has no audit feed yet and keeps the honest empty state.
 */
export function LeadDetailFollowUps({
  activities,
  loading = false,
  errored = false,
  onRetry,
  onAdd,
}: LeadDetailFollowUpsProps) {
  const [tab, setTab] = useState<Tab>("followup");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dateBucket, setDateBucket] = useState<string[]>([]);
  const [followUpSize, setFollowUpSize] = useState<number>(
    ROWS_PER_PAGE_OPTIONS[0],
  );
  const [followUpPage, setFollowUpPage] = useState(1);
  const [historySize, setHistorySize] = useState<number>(
    ROWS_PER_PAGE_OPTIONS[0],
  );

  /** Assignee options come from the follow-ups themselves — no extra request. */
  const assigneeOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const activity of activities) {
      for (const person of activity.assignees) byId.set(person.id, person.name);
    }
    return [...byId].map(([value, label]) => ({ value, label }));
  }, [activities]);

  const visible = useMemo(() => {
    const now = new Date();
    return activities.filter((activity) => {
      if (
        assignees.length > 0 &&
        !activity.assignees.some((person) => assignees.includes(person.id))
      ) {
        return false;
      }
      if (
        dateBucket.length > 0 &&
        !inDateBucket(activity.dueAt, dateBucket[0], now)
      ) {
        return false;
      }
      return true;
    });
  }, [activities, assignees, dateBucket]);

  const filtered = activities.length > 0 && visible.length === 0;

  const pageCount = Math.max(1, Math.ceil(visible.length / followUpSize));
  const currentPage = Math.min(followUpPage, pageCount);
  const paged = visible.slice(
    (currentPage - 1) * followUpSize,
    currentPage * followUpSize,
  );

  return (
    <section aria-label="Follow-up and history" className="flex flex-col">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div role="tablist" aria-label="Follow-up and history" className="flex">
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.key)}
                className={cn(
                  "focus-ring rounded-t-surface border border-b-0 px-6 py-2.5 text-sm font-medium transition-colors duration-(--duration-shell) ease-shell",
                  active
                    ? "border-hairline bg-surface text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        {tab === "followup" && (
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <ReportToolbarSelect
              label="Assigned To"
              icon={IconUser}
              multiple
              searchable
              value={assignees}
              onChange={setAssignees}
              options={assigneeOptions}
            />
            <ReportToolbarSelect
              label="Date Filter"
              icon={IconCalendar}
              value={dateBucket}
              onChange={setDateBucket}
              options={DATE_FILTERS}
              clearLabel="Any date"
            />
            <LeadDetailAddButton label="Add Follow-up" onClick={onAdd} />
          </div>
        )}
      </div>

      <div className="rounded-surface rounded-tl-none border border-hairline bg-surface">
        {tab === "history" ? (
          <>
            <div className="p-6">
              <EmptyState
                title="No records yet"
                description="Records will appear here once they are added."
              />
            </div>
            <div className="border-t border-hairline px-5 py-3">
              <RowsPerPage
                value={historySize}
                onChange={setHistorySize}
                aria-label="Rows per page, History"
              />
            </div>
          </>
        ) : loading ? (
          <div className="flex items-center justify-center p-10 text-ink-muted">
            <IconLoader2
              size={20}
              className="animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : errored ? (
          <div className="p-6">
            <ErrorState
              title="Couldn’t load follow-ups"
              description="Something went wrong. Check your connection and try again."
              onRetry={onRetry ?? (() => {})}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title={filtered ? "No matching follow-ups" : "No records yet"}
              description={
                filtered
                  ? "No follow-ups match the selected filters."
                  : "Records will appear here once they are added."
              }
              action={
                filtered ? undefined : (
                  <Button size="sm" onClick={onAdd}>
                    <IconPlus size={16} stroke={2} aria-hidden="true" />
                    Add Follow-up
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {paged.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
              >
                <span className="inline-flex items-center rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                  {TYPE_LABEL[activity.type]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {activity.description ?? "—"}
                  </span>
                  <span className="block text-xs text-ink-muted">
                    Due {formatDateTime(activity.dueAt, { padHour: true })}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {activity.assignees.map((person) => (
                    <Avatar key={person.id} name={person.name} size="sm" />
                  ))}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    activity.completedAt
                      ? "text-brand-strong"
                      : "text-ink-muted",
                  )}
                >
                  {activity.completedAt ? "Completed" : "Open"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {tab === "followup" && !loading && !errored && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-5 py-3">
            <RowsPerPage
              value={followUpSize}
              onChange={(next) => {
                setFollowUpSize(next);
                setFollowUpPage(1);
              }}
              aria-label="Rows per page, Follow-up"
            />
            {pageCount > 1 && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <button
                  type="button"
                  onClick={() => setFollowUpPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="focus-ring rounded-control px-2 py-1 transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Previous
                </button>
                <span className="whitespace-nowrap">
                  {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setFollowUpPage(currentPage + 1)}
                  disabled={currentPage >= pageCount}
                  className="focus-ring rounded-control px-2 py-1 transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
