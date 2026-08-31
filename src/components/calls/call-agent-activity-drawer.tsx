"use client";

import { useEffect, useMemo, useState } from "react";
import { IconActivity } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import {
  fetchCallLog,
  type CallLogRow,
  type CallRange,
} from "@/services/calls-service";

/**
 * One entry on an agent's activity timeline. Derived from a real call record —
 * there is no separate activity store and none is invented here.
 */
type AgentActivity = {
  id: string;
  at: string;
  /** "Outbound Call", "Not Answered Call", "Note Added" … */
  action: string;
  leadId: string;
  leadName: string;
  /** The note body, on a Note Added entry only. */
  note?: string;
};

/** The log's page size caps how much history one drawer shows at a time. */
const ACTIVITY_PAGE_SIZE = 50;

/**
 * What a call record says the agent did.
 *
 * Outcome decides first: an unanswered or busy attempt is that, whichever way it
 * was dialled. Only a connected call is described by its direction.
 */
function callAction(row: CallLogRow): string {
  if (row.outcome === "NO_ANSWER") return "Not Answered Call";
  if (row.outcome === "BUSY") return "Busy Call";
  return row.direction === "INBOUND" ? "Inbound Call" : "Outbound Call";
}

/**
 * A call becomes one timeline entry, plus a second "Note Added" entry when the
 * agent left a call note — the note is its own action in the reference, not a
 * line inside the call entry.
 */
function toActivities(rows: readonly CallLogRow[]): AgentActivity[] {
  return rows.flatMap((row) => {
    const call: AgentActivity = {
      id: row.id,
      at: row.startedAt,
      action: callAction(row),
      leadId: row.leadId,
      leadName: row.leadName,
    };
    if (!row.callNotes) return [call];
    return [
      call,
      {
        id: `${row.id}-note`,
        at: row.startedAt,
        action: "Note Added",
        leadId: row.leadId,
        leadName: row.leadName,
        note: row.callNotes,
      },
    ];
  });
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Matches the Lead Detail timeline's day headings, so the two read alike. */
function dayLabel(date: Date, today: Date): string {
  if (dayKey(date) === dayKey(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type DayGroup = { key: string; label: string; items: AgentActivity[] };

function groupByDay(items: readonly AgentActivity[]): DayGroup[] {
  const today = new Date();
  const groups: DayGroup[] = [];
  for (const item of items) {
    const date = new Date(item.at);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(date, today), items: [item] });
  }
  return groups;
}

/**
 * One timeline row: the time in a fixed left column, the dot on the rule, and the
 * activity card to its right. The rule is drawn by the row itself rather than as
 * one long line behind the list, so it can stop cleanly at the last entry.
 */
function TimelineRow({
  item,
  agentName,
  isLast,
}: {
  item: AgentActivity;
  agentName: string;
  isLast: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span className="w-16 shrink-0 pt-2.5 text-right text-xs tabular-nums text-ink-muted">
        {timeLabel(new Date(item.at))}
      </span>

      {/* The rule and its marker. `aria-hidden` — the order is already conveyed
          by the list itself, so the decoration must not be announced. */}
      <span
        aria-hidden="true"
        className="flex w-3 shrink-0 flex-col items-center"
      >
        <span className="mt-3 size-2.5 shrink-0 rounded-full border-2 border-brand bg-surface" />
        {!isLast && <span className="w-px flex-1 bg-hairline" />}
      </span>

      <div className="min-w-0 flex-1 pb-4">
        <div className="rounded-control border border-hairline bg-surface px-3 py-2">
          <p className="text-sm text-ink">
            <span className="font-medium">{item.action}</span>
            <span className="text-ink-muted"> by {agentName} | </span>
            <CustomerNameLink leadId={item.leadId} name={item.leadName} />
          </p>
          {item.note && (
            <p className="mt-1 text-sm text-ink-muted">{item.note}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className="flex gap-3">
          <Skeleton className="h-4 w-16 shrink-0 rounded-control" />
          <Skeleton className="h-16 flex-1 rounded-control" />
        </div>
      ))}
    </div>
  );
}

/**
 * An agent's call activity, opened from a Leaderboard user name — the
 * drill-through the leaderboard has had no destination for until now.
 *
 * Every entry is a real call from `GET /api/calls/log`, filtered to the selected
 * agent and to the same period the dashboard Filter has applied, so the drawer
 * can never disagree with the row that opened it. There is no second activity
 * store: if a richer agent-activity feed lands later, only `toActivities` changes.
 *
 * The panel is keyed by agent id by the caller, so selecting a different user
 * re-seeds this one drawer rather than stacking another.
 */
export function CallAgentActivityDrawer({
  agentId,
  agentName,
  range,
  onClose,
}: {
  agentId: string;
  agentName: string;
  range: CallRange;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<CallLogRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallLog(
      { ...range, agentId },
      1,
      { agentId, size: ACTIVITY_PAGE_SIZE },
      controller.signal,
    )
      .then((data) => {
        if (!active) return;
        setRows(data.rows);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [agentId, range, reloadToken]);

  const groups = useMemo(
    () => (rows ? groupByDay(toActivities(rows)) : []),
    [rows],
  );

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${agentName} activity`}
      width="max-w-xl"
      scrollBody={false}
      header={
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={agentName} size="md" />
          <span className="truncate text-base font-semibold text-ink">
            {agentName}
          </span>
        </div>
      }
    >
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-slim">
        {failed ? (
          <div className="p-4">
            <ErrorState
              title="Couldn’t load this agent’s activity"
              description="Something went wrong loading recent calls. Check your connection and try again."
              onRetry={() => {
                setFailed(false);
                setReloadToken((token) => token + 1);
              }}
            />
          </div>
        ) : !rows ? (
          <TimelineSkeleton />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={IconActivity}
            title="No activity in this period"
            description="Calls this agent makes or receives in the selected period appear here."
          />
        ) : (
          <div className="flex flex-col gap-5 p-4">
            {groups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  {group.label}
                </h3>
                <ul className="flex flex-col">
                  {group.items.map((item, index) => (
                    <TimelineRow
                      key={item.id}
                      item={item}
                      agentName={agentName}
                      isLast={index === group.items.length - 1}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
