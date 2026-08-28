"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  IconBrandWhatsapp,
  IconCircle,
  IconCircleCheck,
  IconCopy,
  IconLoader2,
  IconMail,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { formatDateTime, initialsOf } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import type { ActivityListItem } from "@/services/activities-service";
import type { TableColumn } from "@/types";

/**
 * Supplies the per-row actions to every activity row (Complete — ACT-04.1;
 * Edit — ACT-05.1), the same context idiom the Leads status badge and row
 * actions use. Without a provider the row is read-only (ACT-02.2), so the
 * columns render in either mode with no branching at the call site.
 */
type RowActionKind = "complete" | "duplicate" | "delete";

type RowContextValue = {
  onRequestComplete: (row: ActivityListItem) => void;
  onRequestEdit: (row: ActivityListItem) => void;
  onRequestDelete: (row: ActivityListItem) => void;
  onRequestDuplicate: (row: ActivityListItem) => void;
  /** The row with an action in flight, and which — disables it and spins the icon. */
  pendingId: string | null;
  pendingAction: RowActionKind | null;
};

const RowContext = createContext<RowContextValue | null>(null);

export function ActivityRowProvider({
  value,
  children,
}: {
  value: RowContextValue;
  children: ReactNode;
}) {
  return <RowContext value={value}>{children}</RowContext>;
}

/**
 * The Activities worklist columns (ACT-02.2), in Workpex's default order: the
 * activity's own first cell, then its linked lead's columns. Manage Columns
 * (customising this set) is ACT-07.1; the row actions column is ACT-08.1 — both
 * deliberately absent here.
 *
 * `formatDateTime`/`initialsOf` are duplicated from the Leads columns for now;
 * FND-04.1 introduces the shared formatters and both move to it.
 */

function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">—</span>;
}

/** The activity title stays frozen at the left edge while the row scrolls. */
const STICKY_FIRST = "sticky left-0 z-10 bg-surface group-hover:bg-canvas";

function AssignedAvatars({
  assignees,
}: {
  assignees: ActivityListItem["assignees"];
}) {
  if (assignees.length === 0) {
    return (
      <Tooltip content="Unassigned">
        <Avatar name="Unassigned" size="sm" />
      </Tooltip>
    );
  }
  return (
    <span className="flex items-center -space-x-1">
      {assignees.map((assignee) => (
        <Tooltip key={assignee.id} content={assignee.name}>
          <Avatar
            name={assignee.name}
            initials={initialsOf(assignee.name)}
            size="sm"
            className="ring-2 ring-surface"
          />
        </Tooltip>
      ))}
    </span>
  );
}

/**
 * The activity-owned first cell: a completion control, then the derived title
 * over its due date/time. A completed activity shows a read-only green check.
 * With a `CompleteContext` an open activity's circle is a button that requests
 * completion (ACT-04.1); without one it is a read-only outline (ACT-02.2).
 */
function CompletionControl({ row }: { row: ActivityListItem }) {
  const ctx = useContext(RowContext);

  if (row.completedAt) {
    return (
      <IconCircleCheck
        size={18}
        className="shrink-0 text-emerald-600"
        aria-label="Completed"
      />
    );
  }

  if (!ctx) {
    return (
      <IconCircle
        size={18}
        className="shrink-0 text-ink-subtle"
        aria-hidden="true"
      />
    );
  }

  const pending = ctx.pendingId === row.id;
  return (
    <Tooltip content="Mark as Complete">
      <button
        type="button"
        aria-label="Mark as Complete"
        disabled={pending}
        onClick={() => ctx.onRequestComplete(row)}
        className="focus-ring flex shrink-0 rounded-full text-ink-subtle transition-colors duration-(--duration-shell) ease-shell hover:text-emerald-600 disabled:opacity-50"
      >
        <IconCircle size={18} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

/** The edit affordance on the title (ACT-05.1); hidden without a provider. */
function EditControl({ row }: { row: ActivityListItem }) {
  const ctx = useContext(RowContext);
  if (!ctx) return null;
  return (
    <Tooltip content="Edit Follow-up">
      <button
        type="button"
        aria-label="Edit Follow-up"
        onClick={() => ctx.onRequestEdit(row)}
        className="focus-ring flex shrink-0 rounded-control p-0.5 text-ink-subtle opacity-0 transition-opacity duration-(--duration-shell) ease-shell group-hover:opacity-100 hover:text-ink"
      >
        <IconPencil size={15} stroke={1.75} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

/**
 * The per-row quick actions at the right edge (ACT-08.1): WhatsApp, Email,
 * Duplicate, Delete — the same right-aligned icon cluster as the Leads list.
 * Hidden without a provider, so the read-only list (ACT-02.2) shows no controls.
 *
 * WhatsApp is a `wa.me` deep-link from the lead's primary phone; Email is disabled
 * because a lead carries no email address for a `mailto:` (the Leads/ADR-0013
 * constraint applies identically). Duplicate and Delete call the scoped ACT-08.1 /
 * ACT-06.1 APIs — which 404 anything out of the caller's scope, so a user can only
 * act on rows they may already see (AC5). Delete confirms first (AC3).
 */
function ActivityRowActions({ row }: { row: ActivityListItem }) {
  const ctx = useContext(RowContext);
  if (!ctx) return null;

  const pending = ctx.pendingId === row.id ? ctx.pendingAction : null;
  const busy = pending !== null;
  const waUrl = whatsappUrl(row.lead.primaryPhone);

  return (
    <span className="flex items-center justify-end gap-0.5">
      <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
        <IconButton
          aria-label="WhatsApp"
          disabled={!waUrl}
          onClick={() =>
            waUrl && window.open(waUrl, "_blank", "noopener,noreferrer")
          }
        >
          <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
        </IconButton>
      </Tooltip>

      <Tooltip content="No email address on this lead">
        <IconButton aria-label="Email" disabled>
          <IconMail size={18} stroke={1.75} aria-hidden="true" />
        </IconButton>
      </Tooltip>

      <Tooltip content="Duplicate">
        <IconButton
          aria-label="Duplicate"
          disabled={busy}
          onClick={() => ctx.onRequestDuplicate(row)}
        >
          {pending === "duplicate" ? (
            <IconLoader2
              size={18}
              stroke={1.75}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <IconCopy size={18} stroke={1.75} aria-hidden="true" />
          )}
        </IconButton>
      </Tooltip>

      <Tooltip content="Delete">
        <IconButton
          aria-label="Delete"
          disabled={busy}
          onClick={() => ctx.onRequestDelete(row)}
          tone="danger"
        >
          <IconTrash size={18} stroke={1.75} aria-hidden="true" />
        </IconButton>
      </Tooltip>
    </span>
  );
}

function ActivityCell({ row }: { row: ActivityListItem }) {
  return (
    <span className="flex items-center gap-2">
      <CompletionControl row={row} />
      <span className="flex flex-col">
        <span className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{row.title}</span>
          <EditControl row={row} />
        </span>
        <span className="text-xs text-ink-muted">
          {formatDateTime(row.dueAt)}
        </span>
      </span>
    </span>
  );
}

export const activityColumns: TableColumn<ActivityListItem>[] = [
  {
    key: "activity",
    header: "Activities",
    className: STICKY_FIRST,
    render: (row) => <ActivityCell row={row} />,
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedAvatars assignees={row.assignees} />,
  },
  {
    // ACT-09.1: navigates to /leads/{leadId} — matches the Workpex
    // CustomerName-Click behaviour. Uses the shared CustomerNameLink so both
    // the Activities list and the Leads list resolve to the same destination.
    key: "customerName",
    header: "Customer Name",
    render: (row) => (
      <CustomerNameLink leadId={row.lead.id} name={row.lead.name} />
    ),
  },
  {
    key: "pipeline",
    header: "Lead Pipeline",
    render: (row) => row.lead.pipeline,
  },
  {
    key: "callStatus",
    header: "Call Status",
    render: (row) => orDash(row.lead.callStatus),
  },
  {
    // Read-only here (no LeadStatusProvider): a plain colour-coded pill from the
    // canonical stage catalogue, the same source the Leads list and board use.
    key: "leadStatus",
    header: "Lead Status",
    render: (row) => <LeadStatusBadge lead={row.lead} />,
  },
  {
    // The right-edge quick actions (ACT-08.1). A control column, not data, so
    // Manage Columns keeps it fixed and it is not part of the reorderable set.
    key: "actions",
    header: "",
    render: (row) => <ActivityRowActions row={row} />,
  },
];
