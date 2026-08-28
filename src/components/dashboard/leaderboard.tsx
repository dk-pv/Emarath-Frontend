import { IconTrophy } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import type { LeaderboardRow, TableColumn } from "@/types";

const AED = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 2,
});

/** Conversion rates may legitimately exceed 100%, so this must never be clamped. */
const PERCENT = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 });

const columns: TableColumn<LeaderboardRow>[] = [
  {
    key: "agent",
    header: "Agent",
    render: (row) => (
      <span className="flex items-center gap-3">
        <Avatar name={row.agent} size="sm" />
        <span className="truncate font-medium text-ink">{row.agent}</span>
      </span>
    ),
  },
  {
    key: "leads",
    header: "Leads",
    align: "right",
    render: (row) => row.leads.toLocaleString("en-AE"),
  },
  {
    key: "calls",
    header: "Calls",
    align: "right",
    render: (row) => row.calls.toLocaleString("en-AE"),
  },
  {
    key: "convertedAmount",
    header: "Converted Amount",
    align: "right",
    render: (row) => AED.format(row.convertedAmount),
  },
  {
    key: "conversionRate",
    header: "Total Conversion Rate",
    align: "right",
    render: (row) => `${PERCENT.format(row.conversionRate)}%`,
  },
];

/**
 * The Sales Team Activity Board leaderboard (demo data). Interactive search, sort and
 * pagination are the Dashboard module's job (DASH-*, Sprint 5); this restored placeholder
 * renders the fixture rows as a static table so the layout still matches the Workpex
 * reference without depending on the list plumbing the real module will wire.
 */
export function Leaderboard({ rows }: { rows: readonly LeaderboardRow[] }) {
  return (
    <Card as="section">
      <SectionHeader
        title="Leaderboard"
        description="Agent performance across leads, calls and conversion."
      />

      <ResponsiveTableContainer>
        <Table
          columns={columns}
          rows={rows}
          getRowId={(row) => row.id}
          emptyState={
            <EmptyState
              icon={IconTrophy}
              title="No agent activity yet"
              description="Leaderboard standings appear once agents log leads and calls."
            />
          }
        />
      </ResponsiveTableContainer>
    </Card>
  );
}
