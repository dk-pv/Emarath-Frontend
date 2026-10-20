"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import {
  IconCash,
  IconCircleCheck,
  IconCircleX,
  IconLock,
  IconPackage,
  IconReceipt,
  IconTrophy,
  IconTruckReturn,
  type Icon,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportMetricCard, type CardTone } from "./report-metric-card";
import { ReportShell } from "./report-shell";
import {
  Achievement,
  BarCell,
  useTeamPerformanceReport,
} from "./team-performance-report";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import {
  FINANCIAL_DATE_FIELDS,
  FINANCIAL_METRICS,
  OUTCOME_METRIC,
  OUTCOME_STATUSES,
  UNAVAILABLE_METRICS,
  shareOfOrders,
  statusFigures,
  statusRows,
  unvaluedOrders,
  type StatusRow,
} from "@/lib/financial-dashboard";
import { formatAED } from "@/lib/format";
import {
  barShare,
  type TeamPerformanceFigures,
  type TeamPerformancePersonRow,
  type TeamPerformanceResult,
  type TeamPerformanceTeamRow,
} from "@/lib/team-performance";
import type { TableColumn } from "@/types";

const count = (value: number) => value.toLocaleString("en-US");
const percent = (value: number) => `${value.toFixed(2)}%`;
const plural = (n: number, one: string, many: string) =>
  `${count(n)} ${n === 1 ? one : many}`;

const OUTCOME_CARD: Record<
  (typeof OUTCOME_STATUSES)[number],
  { icon: Icon; tone: CardTone }
> = {
  DELIVERED: { icon: IconCircleCheck, tone: "emerald" },
  CANCELLED: { icon: IconCircleX, tone: "red" },
  RTO: { icon: IconTruckReturn, tone: "amber" },
};

/** The sales figures both comparisons share, each money column barred against its own. */
function salesColumns<TRow extends TeamPerformanceFigures>(
  rows: readonly TRow[],
): TableColumn<TRow>[] {
  const won = rows.map((row) => Number(row.wonValue));
  const delivered = rows.map((row) =>
    Number(statusFigures(row, "DELIVERED").value),
  );
  return [
    {
      key: "won",
      header: FINANCIAL_METRICS.wonLeads.label,
      align: "right",
      render: (row) => count(row.won),
    },
    {
      key: "wonValue",
      header: FINANCIAL_METRICS.wonValue.label,
      align: "right",
      render: (row) => (
        <BarCell
          label={formatAED(row.wonValue)}
          share={barShare(Number(row.wonValue), won)}
        />
      ),
    },
    {
      key: "orders",
      header: FINANCIAL_METRICS.orders.label,
      align: "right",
      render: (row) => count(row.orders),
    },
    {
      key: "orderValue",
      header: FINANCIAL_METRICS.orderValue.label,
      align: "right",
      render: (row) => formatAED(row.orderValue),
    },
    {
      key: "delivered",
      header: "Delivered",
      align: "right",
      render: (row) => count(statusFigures(row, "DELIVERED").orders),
    },
    {
      key: "deliveredValue",
      header: "Delivered Value",
      align: "right",
      render: (row) => {
        const value = statusFigures(row, "DELIVERED").value;
        return (
          <BarCell
            label={formatAED(value)}
            share={barShare(Number(value), delivered)}
          />
        );
      },
    },
    {
      key: "cancelled",
      header: "Cancelled",
      align: "right",
      render: (row) => count(statusFigures(row, "CANCELLED").orders),
    },
    {
      key: "rto",
      header: "RTO",
      align: "right",
      render: (row) => count(statusFigures(row, "RTO").orders),
    },
  ];
}

function teamColumns(
  rows: readonly TeamPerformanceTeamRow[],
): TableColumn<TeamPerformanceTeamRow>[] {
  return [
    {
      key: "team",
      header: "Team",
      render: (row) =>
        row.team ?? <span className="text-ink-subtle">No Team</span>,
    },
    ...salesColumns(rows),
    {
      key: "target",
      header: "Monthly Target",
      align: "right",
      render: (row) => (row.target === null ? "—" : formatAED(row.target)),
    },
    {
      key: "achievement",
      header: "Achievement",
      align: "right",
      render: (row) => <Achievement value={row.achievement} />,
    },
  ];
}

function personColumns(
  rows: readonly TeamPerformancePersonRow[],
): TableColumn<TeamPerformancePersonRow>[] {
  return [
    { key: "name", header: "BDE", render: (row) => row.name },
    {
      key: "team",
      header: "Team",
      render: (row) =>
        row.team ?? <span className="text-ink-subtle">No Team</span>,
    },
    ...salesColumns(rows),
    {
      key: "target",
      header: "Monthly Goal",
      align: "right",
      render: (row) => (row.target === null ? "—" : formatAED(row.target)),
    },
    {
      key: "achievement",
      header: "Achievement",
      align: "right",
      render: (row) => <Achievement value={row.achievement} />,
    },
  ];
}

type StatusTableRow =
  StatusRow | (Omit<StatusRow, "status"> & { status: "total" });

const STATUS_COLUMNS: TableColumn<StatusTableRow>[] = [
  { key: "label", header: "Status", render: (row) => row.label },
  {
    key: "orders",
    header: "Orders",
    align: "right",
    render: (row) => count(row.orders),
  },
  {
    key: "share",
    header: "Share of Orders",
    align: "right",
    render: (row) => percent(row.share),
  },
  {
    key: "value",
    header: "Order Value",
    align: "right",
    render: (row) => formatAED(row.value),
  },
  {
    key: "unvalued",
    header: "No Order Value",
    align: "right",
    render: (row) =>
      row.unvalued > 0 ? (
        count(row.unvalued)
      ) : (
        <span className="text-ink-subtle">—</span>
      ),
  },
];

/**
 * Financial Dashboard v1 (client acceptance criterion 13): what was won and ordered, and which
 * orders were delivered, cancelled or RTO, in money and in counts, for the whole filtered set and
 * by team and BDE — filtered by team, Sales Manager, BDE, lead source and a date window over the
 * lead's creation, its last status change or its order's creation. Every figure is a row of Team
 * Performance's scoped endpoint, so the cards, the tables and that report always agree, and each
 * caller sees what their lead scope allows. Payments, costs and profit are listed as not
 * available, with what each waits for — never estimated. A new client screen with no Workpex
 * reference, so it reuses the report shell, toolbar, metric cards and tables (CLAUDE.md §1A).
 */
export function FinancialDashboardReport({
  category,
  slug,
}: {
  category: string;
  slug: string;
}) {
  const resolved = findReport(category, slug);
  const { data, filters, state, retry, filterBar } = useTeamPerformanceReport(
    FINANCIAL_DATE_FIELDS,
  );

  if (!resolved) notFound();

  const basis =
    filters.from || filters.to
      ? (FINANCIAL_DATE_FIELDS.find(
          (field) => field.value === filters.dateField,
        )?.label ?? FINANCIAL_DATE_FIELDS[0].label)
      : null;

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      toolbarActions={filterBar}
      state={state}
      emptyTitle="Nothing to show"
      emptyDescription="No leads match the selected filters and no team has members to show."
      errorMessage="The dashboard couldn’t be loaded. Please try again."
      onRetry={retry}
    >
      {data && <FinancialDashboardBody data={data} basis={basis} />}
    </ReportShell>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="border-t border-hairline">
      <h2 id={id} className="px-4 pt-4 pb-2 text-sm font-semibold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FinancialDashboardBody({
  data,
  basis,
}: {
  data: TeamPerformanceResult;
  /** The date the window is applied to; null when no window is set. */
  basis: string | null;
}) {
  const { total } = data;
  const statusTable = useMemo<StatusTableRow[]>(
    () => [
      ...statusRows(total),
      {
        status: "total",
        label: "Total",
        orders: total.orders,
        value: total.orderValue,
        unvalued: unvaluedOrders(total),
        share: total.orders > 0 ? 100 : 0,
      },
    ],
    [total],
  );
  const teamTable = useMemo(() => teamColumns(data.teams), [data.teams]);
  const personTable = useMemo(() => personColumns(data.people), [data.people]);
  const missingOrderValues = unvaluedOrders(total);

  return (
    <div className="flex min-h-0 flex-col">
      <p className="px-4 pt-4 pb-3 text-sm text-ink-muted">
        Amounts in AED, over the leads in these filters
        {basis ? `, dated by ${basis}` : ", all dates"}. No figure on this page
        is a payment: what was received, is outstanding or was collected is not
        recorded yet.
      </p>

      <Section id="financial-sales" title="Sales">
        <div className="flex flex-wrap gap-3 px-4 pb-4">
          <ReportMetricCard
            title={FINANCIAL_METRICS.wonLeads.label}
            hint={FINANCIAL_METRICS.wonLeads.definition}
            icon={IconTrophy}
            value={count(total.won)}
            tone="blue"
          />
          <ReportMetricCard
            title={FINANCIAL_METRICS.wonValue.label}
            hint={FINANCIAL_METRICS.wonValue.definition}
            icon={IconCash}
            value={formatAED(total.wonValue)}
            label={
              total.wonUnvalued > 0
                ? `Not money received · ${plural(total.wonUnvalued, "won lead has", "won leads have")} no Actual Amount`
                : "Not money received"
            }
            tone="violet"
          />
        </div>
      </Section>

      <Section id="financial-orders" title="Orders and outcomes">
        <div className="flex flex-wrap gap-3 px-4 pb-4">
          <ReportMetricCard
            title={FINANCIAL_METRICS.orders.label}
            hint={FINANCIAL_METRICS.orders.definition}
            icon={IconPackage}
            value={count(total.orders)}
            label={
              missingOrderValues > 0
                ? `${plural(missingOrderValues, "order has", "orders have")} no Order Value`
                : "Every status"
            }
            tone="blue"
          />
          <ReportMetricCard
            title={FINANCIAL_METRICS.orderValue.label}
            hint={FINANCIAL_METRICS.orderValue.definition}
            icon={IconReceipt}
            value={formatAED(total.orderValue)}
            label="Not money received"
            tone="orange"
          />
          {OUTCOME_STATUSES.map((status) => {
            const metric = FINANCIAL_METRICS[OUTCOME_METRIC[status]];
            const row = statusFigures(total, status);
            return (
              <ReportMetricCard
                key={status}
                title={metric.label}
                hint={metric.definition}
                icon={OUTCOME_CARD[status].icon}
                value={count(row.orders)}
                label={
                  // Isolated left-to-right, so the AED sign cannot reorder the text after it.
                  <>
                    <bdi dir="ltr">{formatAED(row.value)}</bdi> ·{" "}
                    {percent(shareOfOrders(row.orders, total.orders))} of orders
                  </>
                }
                tone={OUTCOME_CARD[status].tone}
              />
            );
          })}
        </div>
        <ResponsiveTableContainer label="Orders by status">
          <Table<StatusTableRow>
            columns={STATUS_COLUMNS}
            rows={statusTable}
            getRowId={(row) => row.status}
            rowClassName={(row) =>
              row.status === "total" ? "font-semibold" : undefined
            }
          />
        </ResponsiveTableContainer>
      </Section>

      {data.teams.length > 0 && (
        <Section id="financial-teams" title="Team sales performance">
          <ResponsiveTableContainer label="Team sales performance">
            <Table<TeamPerformanceTeamRow>
              columns={teamTable}
              rows={data.teams}
              getRowId={(row) => row.team ?? "no-team"}
            />
          </ResponsiveTableContainer>
        </Section>
      )}

      <Section id="financial-people" title="BDE sales performance">
        {data.people.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-ink-muted">
            No BDE has leads in these filters.
          </p>
        ) : (
          <ResponsiveTableContainer label="BDE sales performance">
            <Table<TeamPerformancePersonRow>
              columns={personTable}
              rows={data.people}
              getRowId={(row) => row.userId}
            />
          </ResponsiveTableContainer>
        )}
        <p className="px-4 py-3 text-sm text-ink-muted">
          A lead shared by two people counts for each of them, but once for
          their team. Teams are today&rsquo;s membership; targets are monthly,
          are not pro-rated to the dates chosen, and achievement is the won lead
          value against them.
        </p>
      </Section>

      <Section id="financial-unavailable" title="Not available yet">
        <ul className="divide-y divide-hairline px-4 pb-4">
          {UNAVAILABLE_METRICS.map((metric) => (
            <li
              key={metric.label}
              className="flex items-start gap-2 py-2 text-sm"
            >
              <IconLock
                size={16}
                stroke={1.75}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-ink-subtle"
              />
              <span>
                <span className="block font-medium text-ink">
                  {metric.label}
                </span>
                <span className="block text-ink-muted">{metric.needs}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="financial-definitions" title="Definitions">
        <dl className="grid gap-x-6 gap-y-2 px-4 pb-4 text-sm sm:grid-cols-[max-content_1fr]">
          {Object.values(FINANCIAL_METRICS).map((metric) => (
            <div key={metric.label} className="contents">
              <dt className="font-medium text-ink">{metric.label}</dt>
              <dd className="text-ink-muted">{metric.definition}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
