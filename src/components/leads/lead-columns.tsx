import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { Tooltip } from "@/components/ui/Tooltip";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import type { LeadListItem } from "@/services/leads-service";
import type { TableColumn } from "@/types";

/**
 * Formatting is kept local to the Leads module for now; FND-04.1 introduces the
 * shared money/number/date utilities and these move to it.
 */
const AED = new Intl.NumberFormat("en-AE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Workpex renders amounts as "130.00 د.إ"; an absent amount shows as a dash. */
function formatAmount(value: string | null): string {
  if (value === null) return "—";
  const amount = Number(value);
  return Number.isNaN(amount) ? "—" : `${AED.format(amount)} د.إ`;
}

/** Workpex date format, e.g. "16-07-2026, 11:39 AM". Client-only, so no SSR skew. */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dd}-${mm}-${yyyy}, ${time}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Muted em dash for any empty cell, so a blank never reads as a layout gap. */
function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">—</span>;
}

function AssignedAgents({
  agents,
}: {
  agents: LeadListItem["assignedAgents"];
}) {
  if (agents.length === 0) {
    return (
      <Tooltip content="Unassigned">
        <Avatar name="Unassigned" size="sm" />
      </Tooltip>
    );
  }

  // A lead can carry more than one agent (LEAD-01.1 AC4); show each. The exact
  // multi-avatar treatment is refined with LEAD-14.1.
  return (
    <span className="flex items-center -space-x-1">
      {agents.map((agent) => (
        <Tooltip key={agent.id} content={agent.name}>
          <Avatar
            name={agent.name}
            initials={initialsOf(agent.name)}
            size="sm"
            className="ring-2 ring-surface"
          />
        </Tooltip>
      ))}
    </span>
  );
}

function LeadTags({ tags }: { tags: LeadListItem["tags"] }) {
  if (tags.length === 0) return <span className="text-ink-subtle">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Tag key={tag.id}>{tag.name}</Tag>
      ))}
    </span>
  );
}

/**
 * Customer Name is frozen to the left edge. Workpex proves it: in the
 * scroll-right screenshot every other column has scrolled away but Customer Name
 * still shows the lead names. The opaque background covers columns sliding under
 * it, and `group-hover` (the row is a `group`) keeps it in step with the row
 * highlight. This also makes the horizontal scroll usable on tablet and mobile —
 * the identifier stays put while the rest of the row scrolls.
 */
const STICKY_FIRST = "sticky left-0 z-10 bg-surface group-hover:bg-canvas";

/**
 * The Leads list columns in Workpex's default left-to-right order, built from the
 * fields LEAD-02.1 returns.
 *
 * None are sortable: Workpex's list headers are plain text and sorting is done
 * through a separate toolbar control (LEAD-03.3), so clickable-header sorting is
 * deliberately not offered here. Recorded as a deviation from LEAD-02.2 AC3,
 * which describes header sorting Workpex does not have.
 */
export const leadColumns: TableColumn<LeadListItem>[] = [
  {
    key: "name",
    header: "Customer Name",
    className: STICKY_FIRST,
    render: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => row.primaryPhone,
  },
  { key: "source", header: "Source", render: (row) => orDash(row.source) },
  {
    key: "status",
    header: "Lead Status",
    render: (row) => <LeadStatusBadge status={row.status} />,
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedAgents agents={row.assignedAgents} />,
  },
  {
    key: "createdAt",
    header: "Created Date",
    render: (row) => formatDateTime(row.createdAt),
  },
  { key: "country", header: "Country", render: (row) => orDash(row.country) },
  {
    key: "firstName",
    header: "First Name",
    render: (row) => orDash(row.firstName),
  },
  {
    key: "tags",
    header: "Tags",
    render: (row) => <LeadTags tags={row.tags} />,
  },
  {
    key: "secondaryPhone",
    header: "Secondary Phone",
    render: (row) => orDash(row.secondaryPhone),
  },
  {
    key: "language",
    header: "Language",
    render: (row) => orDash(row.language),
  },
  {
    key: "category",
    header: "Category",
    render: (row) => orDash(row.category),
  },
  {
    key: "actualAmount",
    header: "Actual Amount",
    align: "right",
    render: (row) => formatAmount(row.actualAmount),
  },
  {
    key: "forecastedAmount",
    header: "Forecasted Amount",
    align: "right",
    render: (row) => formatAmount(row.forecastedAmount),
  },
  {
    key: "callStatus",
    header: "Call Status",
    render: (row) => orDash(row.callStatus),
  },
];
