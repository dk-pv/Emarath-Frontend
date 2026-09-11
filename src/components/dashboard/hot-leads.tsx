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
import { formatAED } from "@/lib/format";
import { fetchHotLeads, type HotLeadRow } from "@/services/dashboard-service";
import type { TableColumn } from "@/types";
import { DashboardTable } from "./dashboard-table";
import { useWidgetPeriod } from "./dashboard-widget";

/**
 * The reference's three columns, no more: Lead Name, Assigned User, Lead Value.
 * No status badge, rank or row action appears on this table in
 * dashboard-avatar-user-menu-open.png, so none is drawn.
 */
const COLUMNS: readonly TableColumn<HotLeadRow>[] = [
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
    header: "Assigned User",
    render: (row) =>
      row.assignedAgents.length === 0 ? (
        <span className="text-ink-subtle">—</span>
      ) : (
        <span className="flex flex-col gap-1">
          {row.assignedAgents.map((agent) => (
            <span key={agent.agentId} className="flex items-center gap-2.5">
              {/* No initials fallback: the reference draws the neutral grey
                  silhouette for a member without a photo. */}
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
    key: "value",
    header: "Lead Value",
    align: "right",
    // A lead with no amount dashes rather than claiming 0.00 د.إ.
    render: (row) =>
      row.value === null ? (
        <span className="text-ink-subtle">—</span>
      ) : (
        formatAED(row.value)
      ),
  },
];

/**
 * The card's own ornament — a quarter-arc off the left edge, a low hill at the
 * right and two faint discs above it.
 *
 * **Decorative, not a chart.** No axis, no point, nothing tied to the figure; it
 * is the same fixed drawing whatever the total reads, and hidden from assistive
 * tech. Traced from the TOTAL block in dashboard-avatar-user-menu-open.png, whose
 * shapes are quite unlike the stat cards' single wave, so this does not reuse
 * StatWave.
 */
function TotalCardOrnament() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 601 90"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full fill-total-card-wave"
    >
      <path d="M0 0h34C14 22 8 46 8 60c0 12 10 23 26 30H0Z" />
      <path d="M498 90c14-34 30-46 52-46s40 14 51 46Z" />
      <circle cx="392" cy="34" r="15" opacity="0.55" />
      <circle cx="414" cy="34" r="15" opacity="0.55" />
    </svg>
  );
}

/**
 * The running total beneath the table — 601x90 at 1:1, so 541x81 at the chosen
 * density (ADR-0076). Its ink is the reference's navy, not the page ink.
 *
 * It is the total of **every** hot lead in the period, not the visible page: the
 * API aggregates it over the same scoped `where` that produced the rows, so
 * turning to page 2 cannot change it.
 */
function TotalCard({ totalValue }: { totalValue: string }) {
  return (
    <section className="relative isolate min-h-20 overflow-hidden rounded-surface bg-total-card px-5 py-4">
      <TotalCardOrnament />
      <p className="relative text-sm font-medium text-total-card-ink">TOTAL</p>
      <p className="relative mt-2 text-[22px] leading-none font-semibold text-total-card-ink">
        {formatAED(totalValue)}
      </p>
    </section>
  );
}

/**
 * The Dashboard's Hot Leads widget (DASH-08.2).
 *
 * "Hot" is never decided here — the API composes the same `hotLeadsWhere` fragment
 * the Hot Leads KPI counter uses, so the card's number and this table's total can
 * never disagree, and role scoping is applied in that query rather than in the
 * browser. The ranking is the API's too (value descending); no sort control is
 * drawn, because none appears in the reference.
 *
 * **Paging is server-side**, the same contract the Call Activity Board follows:
 * the widget owns page and size, a change to either refetches, and the footer's
 * range is drawn from the API's role-scoped total rather than derived from a
 * partial set. Changing the size returns to page 1.
 */
export function HotLeads() {
  const { period, range } = useWidgetPeriod("this-month");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reloadToken, setReloadToken] = useState(0);

  const [loaded, setLoaded] = useState<{
    key: string;
    rows: readonly HotLeadRow[];
    total: number;
    totalValue: string;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Period, page and size together identify a request. Tagging the result with it
  // stops a slow earlier page repainting over a newer one, and lets the effect
  // avoid resetting state on its way in, which would cascade a render.
  const key = `${periodKey(period, range)}|${page}|${pageSize}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchHotLeads(range, page, pageSize, controller.signal)
      .then((result) => {
        if (!active) return;
        setLoaded({
          key,
          rows: result.rows,
          total: result.total,
          totalValue: result.totalValue,
        });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone.
        console.error("Hot Leads failed to load", error);
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
  const totalValue = current?.totalValue ?? loaded?.totalValue ?? "0";
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card as="section">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h3 className="text-xl font-semibold text-ink">Hot Leads</h3>
      </div>

      <div className="p-5">
        {isError ? (
          <ErrorState
            title="Couldn’t load Hot Leads"
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
            {/* Capped at the six rows the reference shows, so the TOTAL card
                below stays on screen however many hot leads the period holds.
                Measured: 47px header + 6 rows of 47. The scroll, hidden
                scrollbar, sticky header and pinned footer are
                `DashboardTable`'s, shared with the other three widgets. */}
            <DashboardTable
              label="Hot Leads"
              columns={COLUMNS}
              rows={rows}
              getRowId={(row) => row.leadId}
              isFetching={isLoading}
              bodyClassName="max-h-[329px]"
              // 49px rows, matching the Call Activity Board and the reference's
              // own 54px pitch at the chosen density (ADR-0076).
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

            <TotalCard totalValue={totalValue} />
          </div>
        )}
      </div>
    </Card>
  );
}
