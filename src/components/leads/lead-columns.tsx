import { IconAlertTriangle } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { LeadNameCell } from "@/components/leads/lead-name-cell";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadTagsCell } from "@/components/leads/lead-tags-cell";
import {
  formatAED,
  formatDate,
  formatDateTime,
  initialsOf,
} from "@/lib/format";
import type { LeadListItem } from "@/services/leads-service";
import type { TableColumn } from "@/types";

/** Muted em dash for any empty cell, so a blank never reads as a layout gap. */
function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">—</span>;
}

/** A Decimal quantity as Workpex prints it ("1.00"); an absent one dashes. */
function formatQty(value: string | null) {
  if (value === null) return <span className="text-ink-subtle">—</span>;
  const qty = Number(value);
  return Number.isNaN(qty) ? value : qty.toFixed(2);
}

/** dd-mm-yyyy for a date-only or instant field; an absent one dashes. */
function formatDay(value: string | null) {
  return value ? formatDate(value) : <span className="text-ink-subtle">—</span>;
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

/**
 * Customer Name is frozen to the left edge. Workpex proves it: in the
 * scroll-right screenshot every other column has scrolled away but Customer Name
 * still shows the lead names. The opaque background covers columns sliding under
 * it, and `group-hover` (the row is a `group`) keeps it in step with the row
 * highlight. This also makes the horizontal scroll usable on tablet and mobile —
 * the identifier stays put while the rest of the row scrolls.
 */
// `left-10` = the checkbox column's 40px, which the Leads list pins at `left-0` with the same
// classes (`selection.cellClassName`), so checkbox + name freeze as one block.
const STICKY_FIRST = "sticky left-10 z-10 bg-surface group-hover:bg-canvas";

/**
 * The Leads list columns in Workpex's full left-to-right order (LEAD-02.2), built
 * from the fields the list endpoint returns. Every column here is a real field —
 * the three order fields, payment, national code, the latest complaint and the
 * assignment date all ride the list projection now, so none of them dashes for want
 * of data.
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
    // In the Leads list the name opens the Lead Detail drawer in place (the list
    // wraps the table in a LeadDetailProvider); the Activities list has no such
    // provider, so LeadNameCell there falls back to navigating to /leads/{id}
    // (ACT-09.1). One cell, both behaviours. The warning triangle marks a lead nobody has
    // worked yet — no completed activity and no logged call, the No Activity report's own
    // definition — and its tooltip says since when.
    render: (row) => (
      <span className="flex items-center gap-2">
        {!row.hasActivity && (
          <Tooltip
            portal
            content={
              <span className="block text-center leading-snug">
                Lead Created on
                <br />
                <strong className="font-semibold">
                  {formatDateTime(row.createdAt)}
                </strong>
                <br />
                No Activities Yet
              </span>
            }
          >
            <IconAlertTriangle
              size={18}
              stroke={1.75}
              aria-label="No activities yet"
              // Workpex's triangle is a soft salmon, not the full danger red.
              className="shrink-0 text-danger/70"
            />
          </Tooltip>
        )}
        <LeadNameCell lead={row} />
      </span>
    ),
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
    render: (row) => <LeadStatusBadge lead={row} />,
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
    // Every lead carries a pipeline, so it never dashes.
    key: "pipeline",
    header: "Lead Pipeline",
    render: (row) => row.pipeline,
  },
  {
    key: "firstName",
    header: "First Name",
    render: (row) => orDash(row.firstName),
  },
  {
    key: "tags",
    header: "Tags",
    render: (row) => <LeadTagsCell lead={row} />,
  },
  {
    key: "secondaryPhone",
    header: "Secondary Phone",
    render: (row) => orDash(row.secondaryPhone),
  },
  {
    key: "complaints",
    header: "COMPLAINTS",
    render: (row) => orDash(row.complaintReason),
  },
  {
    key: "language",
    header: "Language",
    render: (row) => orDash(row.language),
  },
  {
    key: "assignedDate",
    header: "Assigned Date",
    render: (row) => formatDay(row.assignedDate),
  },
  { key: "product", header: "Product", render: (row) => orDash(row.product) },
  {
    key: "productQty",
    header: "QTY",
    align: "right",
    render: (row) => formatQty(row.productQty),
  },
  {
    key: "product2",
    header: "Product 2",
    render: (row) => orDash(row.product2),
  },
  {
    key: "product2Qty",
    header: "QTY OF PRODUCT 2",
    align: "right",
    render: (row) => formatQty(row.product2Qty),
  },
  {
    key: "callStatus",
    header: "Call Status",
    render: (row) => orDash(row.callStatus),
  },
  {
    key: "callAttempts",
    header: "NO. OF CALL ATTEMPTS",
    align: "right",
    render: (row) => row.callAttempts.toLocaleString("en-US"),
  },
  {
    key: "whatsappAttempts",
    header: "NO. OF MSG ATTEMPTS",
    align: "right",
    render: (row) => row.whatsappAttempts.toLocaleString("en-US"),
  },
  { key: "state", header: "State", render: (row) => orDash(row.state) },
  { key: "street", header: "Street", render: (row) => orDash(row.street) },
  { key: "city", header: "CITY", render: (row) => orDash(row.city) },
  {
    key: "nationalCode",
    header: "National Code",
    render: (row) => orDash(row.nationalCode),
  },
  {
    key: "bookingDate",
    header: "BOOKING DATE",
    render: (row) => formatDay(row.bookingDate),
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
    render: (row) => formatAED(row.actualAmount),
  },
  {
    key: "forecastedAmount",
    header: "Forecasted Amount",
    align: "right",
    render: (row) => formatAED(row.forecastedAmount),
  },
  {
    key: "paymentMethod",
    header: "Payment Method",
    render: (row) => orDash(row.paymentMethod),
  },
  {
    // The row action icons sit in the last column in Workpex (LEAD-10.2), always
    // visible at the right edge of the horizontally scrolling table.
    key: "actions",
    header: "Actions",
    render: (row) => <LeadRowActions lead={row} />,
  },
];
