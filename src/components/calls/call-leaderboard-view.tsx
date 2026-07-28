"use client";

import { useEffect, useMemo, useState } from "react";
import { IconTrophy } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import type { SortState, TableColumn } from "@/types";
import {
  fetchCallLeaderboard,
  type LeaderboardEntry,
} from "@/services/calls-service";
import { rangeFor, type PeriodId } from "./call-period-filter";

const NUMBER = new Intl.NumberFormat("en-AE");
/** Connect % is a share; two decimals match the Workpex cell (e.g. 56.25%). */
const PERCENT = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 });

const COLUMNS: TableColumn<LeaderboardEntry>[] = [
  {
    key: "agentName",
    header: "Users",
    sortable: true,
    render: (row) => (
      // Plain name + avatar. The drill-through (CALL-04.2 AC2) has no destination
      // route yet, so the clickable affordance is removed rather than shown dead.
      <span className="flex items-center gap-3">
        <Avatar name={row.agentName} size="sm" />
        <span className="truncate font-medium text-ink">{row.agentName}</span>
      </span>
    ),
  },
  {
    key: "totalCalls",
    header: "Total Calls",
    align: "right",
    sortable: true,
    render: (row) => NUMBER.format(row.totalCalls),
  },
  {
    key: "uniqueCalls",
    header: "Unique Calls",
    align: "right",
    sortable: true,
    render: (row) => NUMBER.format(row.uniqueCalls),
  },
  {
    key: "answeredCalls",
    header: "Answered Calls",
    align: "right",
    sortable: true,
    render: (row) => NUMBER.format(row.answeredCalls),
  },
  {
    key: "missedCalls",
    header: "Missed Calls",
    align: "right",
    sortable: true,
    render: (row) => NUMBER.format(row.missedCalls),
  },
  {
    key: "callConnectPct",
    header: "Call Connect",
    align: "right",
    sortable: true,
    render: (row) => `${PERCENT.format(row.callConnectPct)}%`,
  },
];

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
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

/**
 * The Call Dashboard leaderboard (CALL-04.2): agents ranked by call volume and
 * quality for the period the parent's Filter selects (AC3). Reuses the shared
 * Table (sortable headers, skeleton, empty) and the CALL-03.2 tagged-fetch +
 * retry pattern. Columns mirror the Workpex board.
 */
export function CallLeaderboard({ period }: { period: PeriodId }) {
  const [loaded, setLoaded] = useState<{
    period: PeriodId;
    rows: LeaderboardEntry[];
  } | null>(null);
  const [failed, setFailed] = useState<PeriodId | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState<SortState | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallLeaderboard(rangeFor(period), controller.signal)
      .then((rows) => {
        if (!active) return;
        setLoaded({ period, rows });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(period);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadToken]);

  const rows = loaded?.period === period ? loaded.rows : null;
  const isError = failed === period;
  const isLoading = !rows && !isError;
  const sorted = useMemo(() => sortRows(rows ?? [], sort), [rows, sort]);

  return (
    <section className="rounded-surface border border-hairline bg-surface">
      <SectionHeader title="Leaderboard" />

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
            columns={COLUMNS}
            rows={sorted}
            getRowId={(row) => row.agentId}
            sort={sort}
            onSortChange={setSort}
            isLoading={isLoading}
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
    </section>
  );
}
