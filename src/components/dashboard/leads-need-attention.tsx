"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { DEFAULT_PAGE_SIZE } from "@/constants/table";
import { isAbortError } from "@/lib/api-client";
import { periodKey } from "@/lib/dashboard-period";
import { formatDate, formatTime } from "@/lib/format";
import {
  fetchLeadsAttention,
  type AttentionGroup,
  type AttentionRow,
} from "@/services/dashboard-service";
import type { TableColumn } from "@/types";
import { DashboardTable } from "./dashboard-table";
import {
  DashboardStatCard,
  type DashboardStatCardTone,
} from "./dashboard-stat-card";
import { useWidgetPeriod } from "./dashboard-widget";

/**
 * The three cards, in the reference's order and hues: Overdue blue, No Activity
 * green, Lost pink. Selecting one filters the table beneath it.
 */
const GROUPS: {
  key: AttentionGroup;
  title: string;
  tone: DashboardStatCardTone;
}[] = [
  { key: "overdue", title: "Overdue", tone: "blue" },
  { key: "noActivity", title: "No Activity", tone: "green" },
  { key: "lost", title: "Lost", tone: "pink" },
];

const COUNT = new Intl.NumberFormat("en-US", { useGrouping: false });

const COLUMNS: readonly TableColumn<AttentionRow>[] = [
  {
    key: "leadName",
    header: "Lead Name",
    // The product's one way into a lead — keeps history, so Back returns here.
    render: (row) => (
      <CustomerNameLink leadId={row.leadId} name={row.leadName} />
    ),
  },
  {
    key: "assignedAgents",
    header: "Assigned To",
    render: (row) =>
      row.assignedAgents.length === 0 ? (
        <span className="text-ink-subtle">—</span>
      ) : (
        <span className="flex flex-col gap-1">
          {row.assignedAgents.map((agent) => (
            <span key={agent.agentId} className="flex items-center gap-2.5">
              <Avatar
                name={agent.agentName}
                src={agent.avatarUrl ?? undefined}
                size="sm"
              />
              <span className="truncate text-ink">{agent.agentName}</span>
            </span>
          ))}
        </span>
      ),
  },
  {
    key: "leadDateTime",
    header: "Lead Date/Time",
    // Two lines — date over time — as the reference draws it, through the shared
    // formatters rather than a format invented here.
    render: (row) => (
      <span className="flex flex-col leading-tight">
        <span className="text-ink">{formatDate(row.leadDateTime)}</span>
        <span className="text-xs text-ink-muted">
          {formatTime(row.leadDateTime)}
        </span>
      </span>
    ),
  },
];

/**
 * Leads – Need Attention (DASH-07.2).
 *
 * Three selectable cards over one drill-down table. Every group is the predicate
 * its own report already owns — Overdue Follow Ups, No Activity Leads, Lost Leads
 * — composed server-side, so this widget cannot invent a fourth definition of
 * "at risk" or drift from those reports. Role scoping is applied in that query.
 *
 * Selecting a card resets to page 1: "page 4" is meaningless once the row set
 * changes, and the counts are read in the same transaction as the page, so a card
 * can never disagree with the list it opens.
 */
export function LeadsNeedAttention() {
  const { period, range } = useWidgetPeriod("this-month");
  const [group, setGroup] = useState<AttentionGroup>("overdue");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [loaded, setLoaded] = useState<{
    key: string;
    counts: Record<AttentionGroup, number>;
    rows: readonly AttentionRow[];
    total: number;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const key = `${periodKey(period, range)}|${group}|${page}|${pageSize}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchLeadsAttention(range, group, page, pageSize, controller.signal)
      .then((result) => {
        if (!active) return;
        setLoaded({
          key,
          counts: result.counts,
          rows: result.rows,
          total: result.total,
        });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        console.error("Leads – Need Attention failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, group, page, pageSize, reloadToken]);

  const current = loaded?.key === key ? loaded : null;
  const isError = failed === key;
  const isLoading = current === null && !isError;
  // The previous group's rows stay put while the next loads, so the card row does
  // not jump under the pointer as the user clicks along it.
  const counts = current?.counts ?? loaded?.counts;
  const rows = current?.rows ?? loaded?.rows ?? [];
  const total = current?.total ?? loaded?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const select = (next: AttentionGroup) => {
    setGroup(next);
    setPage(1);
  };

  return (
    <Card as="section" className="flex flex-col gap-4 p-5">
      <h3 className="text-xl font-semibold text-ink">
        Leads &ndash; Need Attention
      </h3>

      {/* Equal-width, equal-height cards: the selected one only swaps its fill and
          grows its wave, so selecting never reflows the row. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        {GROUPS.map((entry) => (
          <DashboardStatCard
            key={entry.key}
            title={entry.title}
            value={counts ? COUNT.format(counts[entry.key]) : "—"}
            tone={entry.tone}
            active={group === entry.key}
            onClick={() => select(entry.key)}
            pointer="down"
          />
        ))}
      </div>

      {isError ? (
        <ErrorState
          title="Couldn’t load these leads"
          description="Something went wrong loading this widget. Check your connection and try again."
          onRetry={() => {
            setFailed(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : isLoading && loaded === null ? (
        <Skeleton className="h-72 w-full rounded-surface" />
      ) : (
        <>
          {/* Five rows, as the reference shows, then the body scrolls under the
              sticky header. Measured: 43px header + 5 rows of 54 (this table
              carries a two-line date, so its rows are taller than the others).
              The scroll, hidden scrollbar, sticky header and pinned footer are
              `DashboardTable`'s, shared with the other three widgets. */}
          <DashboardTable
            label="Leads needing attention"
            columns={COLUMNS}
            rows={rows}
            getRowId={(row) => row.leadId}
            isFetching={isLoading}
            bodyClassName="max-h-[315px]"
            rowClassName={() => "[&>td]:py-2.5"}
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
        </>
      )}
    </Card>
  );
}
