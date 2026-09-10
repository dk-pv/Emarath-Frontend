"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { DEFAULT_PAGE_SIZE } from "@/constants/table";
import { isAbortError } from "@/lib/api-client";
import { periodKey } from "@/lib/dashboard-period";
import {
  fetchCallActivity,
  type CallActivityRow,
} from "@/services/dashboard-service";
import type { TableColumn } from "@/types";
import { useWidgetPeriod } from "./dashboard-widget";

const COUNT = new Intl.NumberFormat("en-US");
/** Minutes and averages carry one and two decimals — 766.9 and 4.65 in the reference. */
const MINUTES = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const AVERAGE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * The reference's exact column set and spelling, including "AVG,Call Time" — the
 * comma is Workpex's, and renaming it would be a localisation decision this task
 * has no mandate to make. Every numeric column is centred, as the reference draws
 * them; only Name is left-aligned.
 */
const COLUMNS: readonly TableColumn<CallActivityRow>[] = [
  {
    key: "agentName",
    header: "Name",
    render: (row) => (
      <span className="flex items-center gap-2.5">
        {/* No initials fallback: the reference draws the neutral grey silhouette
            for a member without a photo, which is what Avatar renders when it is
            given neither a src nor initials. */}
        <Avatar
          name={row.agentName}
          src={row.avatarUrl ?? undefined}
          size="sm"
        />
        <span className="truncate text-ink">{row.agentName}</span>
      </span>
    ),
  },
  {
    key: "totalCalls",
    header: "Total Calls",
    align: "center",
    render: (row) => COUNT.format(row.totalCalls),
  },
  {
    key: "uniqueCalls",
    header: "Unique Calls",
    align: "center",
    render: (row) => COUNT.format(row.uniqueCalls),
  },
  {
    key: "answeredCalls",
    header: "Answered Calls",
    align: "center",
    render: (row) => COUNT.format(row.answeredCalls),
  },
  {
    key: "callMinutes",
    header: "Call Minutes",
    align: "center",
    render: (row) => MINUTES.format(row.callMinutes),
  },
  {
    key: "averageCallTime",
    header: "AVG,Call Time",
    align: "center",
    render: (row) => AVERAGE.format(row.averageCallTime),
  },
];

/**
 * The Dashboard's Call Activity Board (DASH-05.2).
 *
 * Every figure comes from GET /api/dashboard/call-activity, which is the Call
 * Dashboard's own per-agent aggregation — so this board cannot disagree with that
 * screen, and role scoping is applied in the query rather than here.
 *
 * **Paging is server-side.** The widget owns page and size, and a change to either
 * refetches — so the browser never holds more than the page it is showing, and the
 * footer's range is drawn from the API's own role-scoped total rather than derived
 * from a partial set. Changing the size returns to page 1, because "page 4 at 25
 * per page" means nothing once the pages are redrawn.
 *
 * It owns its period directly (DASH-01.2) instead of sitting inside a
 * DashboardWidget: that shell reloads on period alone, which cannot express
 * "reload because the page changed".
 */
export function CallActivityBoard() {
  const { period, range } = useWidgetPeriod("this-month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [loaded, setLoaded] = useState<{
    key: string;
    rows: readonly CallActivityRow[];
    total: number;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // One key identifies a request — period, page and size together. Tagging the
  // result with it is what stops a slow earlier page repainting over a newer one,
  // and lets the effect avoid resetting state on its way in, which would cascade a
  // render. The same rule every other Dashboard read follows.
  const key = `${periodKey(period, range)}|${page}|${pageSize}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchCallActivity(range, page, pageSize, controller.signal)
      .then((result) => {
        if (!active) return;
        setLoaded({ key, rows: result.rows, total: result.total });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone.
        console.error("Call Activity Board failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, page, pageSize, reloadToken]);

  const current = loaded?.key === key ? loaded : null;
  const isError = failed === key;
  const isLoading = current === null && !isError;
  // The previous page stays on screen while the next one loads, so the card keeps
  // its height and nothing jumps under the pager.
  const rows = current?.rows ?? loaded?.rows ?? [];
  const total = current?.total ?? loaded?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card as="section">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h3 className="text-base font-semibold text-ink">
          Call Activity Board
        </h3>
      </div>

      <div className="p-5">
        {isError ? (
          <ErrorState
            title="Couldn’t load the Call Activity Board"
            description="Something went wrong loading this widget. Check your connection and try again."
            onRetry={() => {
              setFailed(null);
              setReloadToken((token) => token + 1);
            }}
          />
        ) : isLoading && loaded === null ? (
          <Skeleton className="h-80 w-full rounded-surface" />
        ) : (
          <div className="flex flex-col gap-4">
            <ResponsiveTableContainer
              label="Call Activity Board"
              className="rounded-surface border border-hairline"
            >
              <Table
                columns={COLUMNS}
                rows={rows}
                getRowId={(row) => row.agentId}
                isFetching={isLoading}
                // 49px rows, not the list's default 39: the reference measures
                // this board at a 54px pitch, 49 at the chosen density (ADR-0076).
                rowClassName={() => "[&>td]:py-2.5"}
                emptyState={
                  <EmptyState
                    title="No data available"
                    description="There's currently no data to display here."
                  />
                }
              />
            </ResponsiveTableContainer>

            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              total={total}
              hideNavWhenSingle
            />
          </div>
        )}
      </div>
    </Card>
  );
}
