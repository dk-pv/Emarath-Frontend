"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  FOLLOW_UP_TYPE_LABEL,
  type FollowUpType,
  type OverdueFollowUpsAgentRef,
} from "@/services/overdue-follow-ups-report-service";
import type { TableColumn } from "@/types";

/**
 * The row shape the Follow Ups reports' tables read. Overdue and Today return exactly this,
 * so both render through one set of columns rather than a copy each.
 */
export type FollowUpTableRow = {
  id: string;
  type: FollowUpType;
  leadId: string;
  customerName: string;
  status: string;
  statusColor: string | null;
  dueAt: string;
  notes: string | null;
  assignedTo: OverdueFollowUpsAgentRef[];
};

/**
 * The Assigned User cell: a single avatar of fixed width, naming its user on hover — and every
 * assignee when a follow-up is shared, so one disc never hides the rest. Portalled because these
 * tables scroll horizontally, and that container would crop an absolutely-placed bubble.
 */
function AssignedCell({ agents }: { agents: OverdueFollowUpsAgentRef[] }) {
  const names = agents.map((agent) => agent.name);

  return (
    <Tooltip
      portal
      content={names.length > 0 ? names.join(", ") : "Unassigned"}
    >
      <Avatar name={names[0] ?? "Unassigned"} size="sm" />
    </Tooltip>
  );
}

/** A muted em dash, so an empty Notes cell never reads as a layout gap. */
const DASH = <span className="text-ink-subtle">—</span>;

/**
 * The six columns both Follow Ups reports show, in the reference's order: Lead Name, Lead
 * Status, Assigned User, Follow up Type, Date & Time, Notes.
 *
 * Lead Name opens that customer's details through the shared `CustomerNameLink`, carrying
 * `from` so the details page knows which report it was reached from. The status badge uses the
 * status's own Stage colour, never an invented hue. Date stacks over time, as the references
 * print it.
 *
 * `dateHeader` exists only because the two references label that column differently — "Date and
 * Time" on Overdue, "Date & Time" on Today — and each is transcribed from its own screenshot.
 */
export function followUpColumns<Row extends FollowUpTableRow>(options: {
  from: string;
  dateHeader: string;
}): readonly TableColumn<Row>[] {
  return [
    {
      key: "customerName",
      header: "Lead Name",
      render: (row) => (
        <CustomerNameLink
          leadId={row.leadId}
          name={row.customerName}
          from={options.from}
        />
      ),
    },
    {
      key: "status",
      header: "Lead Status",
      align: "center",
      render: (row) => (
        <span
          className={cn(
            "inline-flex max-w-full cursor-pointer items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
            stageColorClasses(row.statusColor).badge,
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: "assigned",
      header: "Assigned User",
      align: "center",
      render: (row) => <AssignedCell agents={row.assignedTo} />,
    },
    {
      key: "type",
      header: "Follow up Type",
      render: (row) => FOLLOW_UP_TYPE_LABEL[row.type],
    },
    {
      key: "dueAt",
      header: options.dateHeader,
      render: (row) => (
        <span className="flex flex-col leading-tight">
          <span>{formatDate(row.dueAt)}</span>
          <span>{formatTime(row.dueAt)}</span>
        </span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      render: (row) => row.notes ?? DASH,
    },
  ];
}
