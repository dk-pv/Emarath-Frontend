"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  IconCash,
  IconFilter,
  IconPercentage,
  IconTrophy,
  IconTruckDelivery,
  IconUser,
  IconUserStar,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMetricCard } from "./report-metric-card";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { ReportShell, type ReportState } from "./report-shell";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useLookup } from "@/hooks/use-lookup";
import { isAbortError } from "@/lib/api-client";
import { formatAED } from "@/lib/format";
import {
  barShare,
  isTeamPerformanceEmpty,
  type TeamPerformanceDateField,
  type TeamPerformanceFigures,
  type TeamPerformanceFilterOptions,
  type TeamPerformanceFilters,
  type TeamPerformancePersonRow,
  type TeamPerformanceResult,
  type TeamPerformanceTeamRow,
} from "@/lib/team-performance";
import {
  DATE_FIELD_OPTIONS,
  isDatePeriodKey,
  periodRange,
} from "@/services/leads-by-status-report-service";
import {
  fetchTeamPerformance,
  fetchTeamPerformanceFilterOptions,
} from "@/services/team-performance-service";
import type { TableColumn } from "@/types";

const count = (value: number) => value.toLocaleString("en-US");
const percent = (value: number) => `${value.toFixed(2)}%`;

/** A figure with a bar of its share of the column's largest, so rows compare at a glance. */
export function BarCell({ label, share }: { label: string; share: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span
        aria-hidden="true"
        className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-canvas sm:inline-block"
      >
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${share}%` }}
        />
      </span>
      <span className="tabular-nums">{label}</span>
    </span>
  );
}

export function Achievement({ value }: { value: number | null }) {
  return value === null ? (
    <span className="text-ink-muted">No Target Set</span>
  ) : (
    <span className="tabular-nums">{percent(value)}</span>
  );
}

/** The columns both comparisons share, each figure barred against its own column. */
function figureColumns<TRow extends TeamPerformanceFigures>(
  rows: readonly TRow[],
): TableColumn<TRow>[] {
  const leads = rows.map((row) => row.leads);
  const won = rows.map((row) => row.won);
  const values = rows.map((row) => Number(row.wonValue));
  return [
    {
      key: "leads",
      header: "Leads",
      align: "right",
      render: (row) => (
        <BarCell label={count(row.leads)} share={barShare(row.leads, leads)} />
      ),
    },
    {
      key: "won",
      header: "Won",
      align: "right",
      render: (row) => (
        <BarCell label={count(row.won)} share={barShare(row.won, won)} />
      ),
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      render: (row) => count(row.orders),
    },
    {
      key: "conversionRate",
      header: "Conversion",
      align: "right",
      render: (row) => percent(row.conversionRate),
    },
    {
      key: "wonValue",
      header: "Won Value",
      align: "right",
      render: (row) => (
        <BarCell
          label={formatAED(row.wonValue)}
          share={barShare(Number(row.wonValue), values)}
        />
      ),
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
    {
      key: "members",
      header: "Members",
      align: "right",
      render: (row) =>
        row.members === null ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          count(row.members)
        ),
    },
    ...figureColumns(rows),
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
    ...figureColumns(rows),
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

const list = (value: string | null): string[] =>
  value ? value.split(",").filter(Boolean) : [];

/**
 * The `GET /reports/team-performance` query kept in the address, and the response read under it —
 * shared by Team Performance and the Financial Dashboard, which read the same rows. Filters: team,
 * Sales Manager, BDE, lead source and a date window over one of `dateFields`. Every filter is a
 * server query param kept in the URL, and the server decides what each caller sees — every team for
 * the admin, a Sales Manager's own team, a sales agent's own row. Returns the toolbar's filter bar,
 * the response shown beside the filters it was read under, and the screen state.
 */
export function useTeamPerformanceReport(
  dateFields: readonly { value: TeamPerformanceDateField; label: string }[],
) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const sources = useLookup("sources");

  const [options, setOptions] = useState<TeamPerformanceFilterOptions | null>(
    null,
  );
  const [result, setResult] = useState<{
    key: string;
    data: TeamPerformanceResult;
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const dateParam = params.get("dateField");
  const dateField: TeamPerformanceDateField =
    dateFields.find((option) => option.value === dateParam)?.value ?? "created";
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const teamKey = params.get("team");
  const agentKey = params.get("agent");
  const sourceKey = params.get("source");
  const manager = params.get("manager");

  const filters: TeamPerformanceFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      dateField,
      team: list(teamKey),
      agent: list(agentKey),
      source: list(sourceKey),
      manager,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      dateField,
      teamKey,
      agentKey,
      sourceKey,
      manager,
    ],
  );
  const requestKey = `${JSON.stringify(filters)}#${reloadToken}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchTeamPerformanceFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        // The report still runs; the filters just offer nothing until a reload.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchTeamPerformance(filters, controller.signal)
      .then((data) => setResult({ key: requestKey, data }))
      .catch((error: unknown) => {
        if (!isAbortError(error)) setFailedKey(requestKey);
      });
    return () => controller.abort();
  }, [filters, requestKey]);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // A response is shown only beside the filters it was read under.
  const data = result?.key === requestKey ? result.data : null;
  const state: ReportState =
    failedKey === requestKey
      ? "error"
      : !data
        ? "loading"
        : isTeamPerformanceEmpty(data)
          ? "empty"
          : "ready";

  const filterBar = (
    <div className="flex flex-wrap items-center gap-1 empty:hidden">
      {(options?.teams.length ?? 0) > 0 && (
        <ReportToolbarSelect
          label="Team"
          icon={IconUsersGroup}
          multiple
          value={filters.team}
          onChange={(value) => setParams({ team: value.join(",") || null })}
          options={(options?.teams ?? []).map((team) => ({
            value: team,
            label: team,
          }))}
        />
      )}
      {(options?.managers.length ?? 0) > 0 && (
        <ReportToolbarSelect
          label="Sales Manager"
          icon={IconUserStar}
          value={manager ? [manager] : []}
          onChange={(value) => setParams({ manager: value[0] ?? null })}
          options={(options?.managers ?? []).map((row) => ({
            value: row.id,
            label: `${row.name} (${row.team})`,
          }))}
          clearLabel="All managers"
        />
      )}
      {(options?.agents.length ?? 0) > 1 && (
        <ReportToolbarSelect
          label="BDE"
          icon={IconUser}
          multiple
          searchable
          value={filters.agent}
          onChange={(value) => setParams({ agent: value.join(",") || null })}
          options={(options?.agents ?? []).map((agent) => ({
            value: agent.id,
            label: agent.name,
          }))}
        />
      )}
      <ReportToolbarSelect
        label="Lead Source"
        icon={IconFilter}
        multiple
        searchable
        value={filters.source}
        onChange={(value) => setParams({ source: value.join(",") || null })}
        options={sources.options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <ReportDateFilter
        value={{
          field: dateField,
          period: periodKey,
          from: customFrom,
          to: customTo,
        }}
        fields={dateFields}
        onApply={(next) =>
          setParams({
            period: next.period,
            dateField: next.field === "created" ? null : next.field,
            from: next.period === "custom" ? (next.from ?? null) : null,
            to: next.period === "custom" ? (next.to ?? null) : null,
          })
        }
        onClear={() =>
          setParams({ period: null, dateField: null, from: null, to: null })
        }
      />
    </div>
  );

  const retry = () => {
    setFailedKey(null);
    setReloadToken((token) => token + 1);
  };

  return { data, filters, state, retry, filterBar };
}

/**
 * Team Performance (Teams v1, client acceptance criterion 11): teams compared with teams and BDEs
 * with BDEs on leads, won leads, orders, conversion and target achievement, filtered by date, team,
 * Sales Manager, BDE and lead source. A new client screen with no Workpex reference, so it reuses
 * the report shell, toolbar, metric cards and tables (CLAUDE.md §1A).
 */
export function TeamPerformanceReport({
  category,
  slug,
}: {
  category: string;
  slug: string;
}) {
  const resolved = findReport(category, slug);
  const { data, state, retry, filterBar } =
    useTeamPerformanceReport(DATE_FIELD_OPTIONS);

  if (!resolved) notFound();

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      toolbarActions={filterBar}
      state={state}
      emptyTitle="Nothing to compare"
      emptyDescription="No leads match the selected filters and no team has members to show."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={retry}
    >
      {data && <TeamPerformanceBody data={data} />}
    </ReportShell>
  );
}

function TeamPerformanceBody({ data }: { data: TeamPerformanceResult }) {
  const teamTable = useMemo(() => teamColumns(data.teams), [data.teams]);
  const personTable = useMemo(() => personColumns(data.people), [data.people]);
  const { total } = data;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap gap-3 p-4">
        <ReportMetricCard
          title="Leads"
          hint="Leads in the filters, each counted once — unassigned leads included."
          icon={IconUsers}
          value={count(total.leads)}
          tone="blue"
        />
        <ReportMetricCard
          title="Won"
          hint="Leads whose stage is WON now."
          icon={IconTrophy}
          value={count(total.won)}
          tone="emerald"
        />
        <ReportMetricCard
          title="Orders"
          hint="Leads that have a Logistics order, whatever its status since."
          icon={IconTruckDelivery}
          value={count(total.orders)}
          tone="violet"
        />
        <ReportMetricCard
          title="Conversion"
          hint="Won ÷ leads."
          icon={IconPercentage}
          value={percent(total.conversionRate)}
          tone="amber"
        />
        <ReportMetricCard
          title="Won Value"
          hint="The actual amount of the won leads."
          icon={IconCash}
          value={formatAED(total.wonValue)}
          tone="orange"
        />
      </div>
      <p className="px-4 pb-3 text-sm text-ink-muted">
        A lead shared by two people counts for each of them, but once for their
        team. Teams are today&rsquo;s membership; targets are monthly and are
        not pro-rated to the dates chosen.
      </p>

      {data.teams.length > 0 && (
        <section
          aria-labelledby="team-performance-teams"
          className="border-t border-hairline"
        >
          <h2
            id="team-performance-teams"
            className="px-4 pt-4 pb-2 text-sm font-semibold text-ink"
          >
            Team comparison
          </h2>
          <ResponsiveTableContainer label="Team comparison">
            <Table<TeamPerformanceTeamRow>
              columns={teamTable}
              rows={data.teams}
              getRowId={(row) => row.team ?? "no-team"}
            />
          </ResponsiveTableContainer>
        </section>
      )}

      <section
        aria-labelledby="team-performance-people"
        className="border-t border-hairline"
      >
        <h2
          id="team-performance-people"
          className="px-4 pt-4 pb-2 text-sm font-semibold text-ink"
        >
          BDE comparison
        </h2>
        {data.people.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-ink-muted">
            No BDE has leads in these filters.
          </p>
        ) : (
          <ResponsiveTableContainer label="BDE comparison">
            <Table<TeamPerformancePersonRow>
              columns={personTable}
              rows={data.people}
              getRowId={(row) => row.userId}
            />
          </ResponsiveTableContainer>
        )}
      </section>
    </div>
  );
}
