"use client";

import { useEffect, useMemo, useState } from "react";
import { IconArrowsDiagonal, IconTrophy } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import type { SortState, TableColumn } from "@/types";
import {
  fetchCallLeaderboard,
  type LeaderboardEntry,
} from "@/services/calls-service";
import { resolveCallRange, type CallFilterState } from "./call-filter-panel";
import { CallAgentActivityDrawer } from "./call-agent-activity-drawer";

const NUMBER = new Intl.NumberFormat("en-AE");
/** Connect % is a share; two decimals match the Workpex cell (e.g. 56.25%). */
const PERCENT = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 });

function buildColumns(
  onSelectAgent: (row: LeaderboardEntry) => void,
): TableColumn<LeaderboardEntry>[] {
  return [
    {
      key: "agentName",
      header: "Users",
      sortable: true,
      // The one vertical rule in the reference board — after Users, nowhere else.
      className: "border-r border-hairline",
      render: (row) => (
        // The drill-through the reference shows: a squared avatar, the underlined
        // name, then the little diagonal expand arrow, which opens the agent's
        // activity drawer. It stays on the Call Dashboard, so this is a button
        // rather than a link — there is no agent route to visit.
        <span className="flex items-center gap-3">
          <Avatar name={row.agentName} size="sm" shape="square" />
          <button
            type="button"
            onClick={() => onSelectAgent(row)}
            aria-label={`Open ${row.agentName} activity`}
            className="focus-ring group/name inline-flex min-w-0 items-center gap-2 rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
          >
            <span className="truncate">{row.agentName}</span>
            <IconArrowsDiagonal
              size={16}
              stroke={2}
              aria-hidden="true"
              className="shrink-0 text-ink-subtle transition-colors duration-(--duration-shell) ease-shell group-hover/name:text-ink"
            />
          </button>
        </span>
      ),
    },
    {
      key: "totalCalls",
      header: "Total Calls",
      align: "center",
      sortable: true,
      render: (row) => NUMBER.format(row.totalCalls),
    },
    {
      key: "uniqueCalls",
      header: "Unique Calls",
      align: "center",
      sortable: true,
      render: (row) => NUMBER.format(row.uniqueCalls),
    },
    {
      key: "answeredCalls",
      header: "Answered Calls",
      align: "center",
      sortable: true,
      render: (row) => NUMBER.format(row.answeredCalls),
    },
    {
      key: "missedCalls",
      header: "Missed Calls",
      align: "center",
      sortable: true,
      render: (row) => NUMBER.format(row.missedCalls),
    },
    {
      key: "callConnectPct",
      header: "Call Connect",
      align: "center",
      sortable: true,
      render: (row) => `${PERCENT.format(row.callConnectPct)}%`,
    },
  ];
}

/** Client-side re-sort. Absent sort keeps the API's ranking (AC4). */
function sortRows(
  rows: readonly LeaderboardEntry[],
  sort: SortState | undefined,
): readonly LeaderboardEntry[] {
  if (!sort) return rows;
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort.key as keyof LeaderboardEntry];
    const bv = b[sort.key as keyof LeaderboardEntry];
    if (typeof av === "number" && typeof bv === "number")
      return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

/**
 * The Call Dashboard leaderboard (CALL-04.2): agents ranked by call volume and
 * quality for whatever the dashboard's one Filter selects — period and agent
 * alike (AC3). Reuses the shared
 * Table (sortable headers, skeleton, empty) and the CALL-03.2 tagged-fetch +
 * retry pattern. Columns mirror the Workpex board.
 */
export function CallLeaderboard({ filters }: { filters: CallFilterState }) {
  const range = useMemo(() => resolveCallRange(filters), [filters]);
  const requestKey = `${range.from}|${range.to}|${range.agentId ?? ""}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: LeaderboardEntry[];
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState<SortState | undefined>(undefined);
  // One drawer, re-seeded when another user is picked — never a second panel.
  const [selectedAgent, setSelectedAgent] = useState<LeaderboardEntry | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallLeaderboard(range, controller.signal)
      .then((rows) => {
        if (!active) return;
        setLoaded({ key: requestKey, rows });
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
  }, [range, requestKey, reloadToken]);

  const rows = loaded?.key === requestKey ? loaded.rows : null;
  const isError = failed === requestKey;
  const isLoading = !rows && !isError;
  const sorted = useMemo(() => sortRows(rows ?? [], sort), [rows, sort]);
  const columns = useMemo(() => buildColumns(setSelectedAgent), []);

  return (
    <section>
      {/* The heading stands outside the table in the reference, not on its top edge:
          plain text on the page, then the bordered table beneath it. */}
      <h3 className="mb-3 text-xl font-semibold text-ink">Leaderboard</h3>

      <Card>
        {isError ? (
          <div className="p-4">
            <ErrorState
              title="Couldn’t load the leaderboard"
              description="Something went wrong loading agent standings. Check your connection and try again."
              onRetry={() => {
                setFailed(null);
                setReloadToken((token) => token + 1);
              }}
            />
          </div>
        ) : (
          <ResponsiveTableContainer label="Leaderboard">
            <Table
              columns={columns}
              rows={sorted}
              getRowId={(row) => row.agentId}
              sort={sort}
              onSortChange={setSort}
              isLoading={isLoading}
              sortTooltips
              emptyState={
                <EmptyState
                  icon={IconTrophy}
                  title="No agent activity yet"
                  description="Leaderboard standings appear once agents make or receive calls in this period."
                />
              }
            />
          </ResponsiveTableContainer>
        )}
      </Card>

      {/* Keyed by agent, so picking another user re-seeds this drawer instead of
          stacking a second one. The activity covers the same period the board does. */}
      {selectedAgent && (
        <CallAgentActivityDrawer
          key={selectedAgent.agentId}
          agentId={selectedAgent.agentId}
          agentName={selectedAgent.agentName}
          range={range}
          onClose={() => setSelectedAgent(null)}
        />
      )}
    </section>
  );
}
