"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  IconArrowUpRight,
  IconBrandWhatsapp,
  IconCircle,
  IconCircleCheck,
  IconMail,
  IconNote,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { ActivityDueDateEditor } from "@/components/activities/activity-due-date-editor";
import { TYPE_LABEL } from "@/components/activities/activity-form-parts";
import { LeadNameCell } from "@/components/leads/lead-name-cell";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadTagsCell } from "@/components/leads/lead-tags-cell";
import { cn } from "@/lib/cn";
import { formatAED, formatDateTime, initialsOf } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import type { ActivityListItem } from "@/services/activities-service";
import type { TableColumn } from "@/types";

/**
 * Supplies the per-row actions to every activity row (Complete — ACT-04.1;
 * Edit — ACT-05.1), the same context idiom the Leads status badge and row
 * actions use. Without a provider the row is read-only (ACT-02.2), so the
 * columns render in either mode with no branching at the call site.
 */
type RowActionKind = "complete" | "delete";

type RowContextValue = {
  onRequestComplete: (row: ActivityListItem) => void;
  onRequestEdit: (row: ActivityListItem) => void;
  onRequestDelete: (row: ActivityListItem) => void;
  /** Opens the lead's email composer — the same drawer the Leads row action uses. */
  onRequestEmail: (row: ActivityListItem) => void;
  /** Opens the lead's WhatsApp composer — the same drawer the Leads row action uses. */
  onRequestWhatsapp: (row: ActivityListItem) => void;
  /** Commits an in-place due date/time change from the row (ACT-05.1). */
  onSaveDueDate: (row: ActivityListItem, dueAt: string) => void;
  /** Opens the lead's existing activity timeline (the ↗ beside the customer name). */
  onRequestTimeline: (row: ActivityListItem) => void;
  /**
   * Local midnight as an ISO instant — a row due before it is overdue. Supplied by
   * the view (it is the same `todayStart` the query sends), so the cells stay pure
   * and the red styling agrees exactly with the server's Overdue bucket instead of
   * drifting against a second clock.
   */
  overdueBefore: string;
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

/**
 * Workpex keeps the lead columns compact and lets a long value ellipse rather than
 * widening the table. The cap has to sit on the cell's own content box: `max-width`
 * on a `<td>` is advisory in an auto table layout, so the column widens to the text
 * regardless and nothing ever measures as clipped. A short value still shrinks the
 * column — only an over-long one is cut.
 */
const TRUNCATE_CAP = "max-w-[240px]";

/**
 * A one-line cell that reveals its full value on hover. The tooltip is only
 * attached when the text is actually clipped, so a short value that is fully
 * visible carries no redundant tooltip.
 */
function Truncated({ text }: { text: string }) {
  const [clipped, setClipped] = useState(false);
  /**
   * Measure once per value. Re-measuring after the clipped branch has mounted is
   * what makes this oscillate: the tooltip wrapper is a different box from the
   * bare span the first measurement came from, so the second measurement
   * disagrees, the tree switches back, and the two states alternate until React
   * gives up with "Maximum update depth exceeded".
   */
  const measuredFor = useRef<string | null>(null);
  const measure = (el: HTMLSpanElement | null) => {
    if (!el || measuredFor.current === text) return;
    measuredFor.current = text;
    setClipped(el.scrollWidth > el.clientWidth);
  };
  const cell = (
    <span ref={measure} className={cn("block truncate", TRUNCATE_CAP)}>
      {text}
    </span>
  );
  if (!clipped) return cell;
  return (
    <Tooltip content={text} portal>
      {cell}
    </Tooltip>
  );
}

/**
 * The activity title stays frozen at the left edge while the row scrolls. The width
 * is capped so a long title ellipses inside the cell instead of stretching the
 * column and squeezing the lead's columns off-screen — Workpex keeps this column a
 * fixed, compact width.
 */
const STICKY_FIRST =
  "sticky left-0 z-10 w-[380px] max-w-[380px] bg-surface group-hover:bg-canvas";

/*
 * Every tooltip in this table is portalled. The worklist body scrolls horizontally, and that
 * container crops an absolutely-placed bubble — on the first row a tooltip placed above the
 * trigger was cut off by the header. Fixed in <body>, it is fully visible from any row.
 */
function AssignedAvatars({
  assignees,
}: {
  assignees: ActivityListItem["assignees"];
}) {
  if (assignees.length === 0) {
    return (
      <Tooltip content="Unassigned" portal>
        <Avatar name="Unassigned" size="sm" />
      </Tooltip>
    );
  }
  return (
    <span className="flex items-center -space-x-1">
      {assignees.map((assignee) => (
        <Tooltip key={assignee.id} content={assignee.name} portal>
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
 * The Activities cell's assignee avatar: always exactly one disc of fixed width, so every row's
 * title starts at the same x however many people a follow-up is assigned to — a per-assignee
 * stack here would shift the titles row by row. Hovering names them, all of them when a
 * follow-up is shared. The Assigned column above still shows one avatar per assignee.
 *
 * Portalled because this cell is sticky inside the table's horizontal scroller, which clips an
 * absolutely-placed bubble — the same reason the title's own tooltip is portalled.
 */
function ActivityAvatar({
  assignees,
}: {
  assignees: ActivityListItem["assignees"];
}) {
  const names = assignees.map((assignee) => assignee.name);

  return (
    <Tooltip
      portal
      content={names.length > 0 ? names.join(", ") : "Unassigned"}
    >
      <Avatar name={names[0] ?? "Unassigned"} size="sm" />
    </Tooltip>
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
    <Tooltip content="Mark as Complete" portal>
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

/**
 * The per-row quick actions at the right edge (ACT-08.1): WhatsApp, Email,
 * Edit, Delete — the same right-aligned icon cluster as the Leads list. Edit is
 * the third action, replacing Duplicate, and is the only edit affordance on the
 * row: the title carries no second pencil.
 * Hidden without a provider, so the read-only list (ACT-02.2) shows no controls.
 *
 * WhatsApp opens the Leads "Send Whatsapp Message" composer (LEAD-10.2) for the
 * linked lead, prefilled with that lead's own primary phone — the same drawer, and
 * only its Send button reaches the `wa.me` hand-off. Disabled when the lead carries
 * no dialable number, so the composer never opens on an unsendable row; Email is disabled
 * because a lead carries no email address for a `mailto:` (the Leads/ADR-0013
 * constraint applies identically). Edit opens the existing Edit Follow-up drawer
 * (ACT-05.1); Delete calls the scoped ACT-06.1 API — which 404s anything out of the
 * caller's scope, so a user can only act on rows they may already see (AC5). Delete
 * confirms first (AC3).
 */
function ActivityRowActions({ row }: { row: ActivityListItem }) {
  const ctx = useContext(RowContext);
  if (!ctx) return null;

  const pending = ctx.pendingId === row.id ? ctx.pendingAction : null;
  const busy = pending !== null;
  const waUrl = whatsappUrl(row.lead.primaryPhone);

  return (
    <span className="flex items-center justify-end gap-0.5">
      <Tooltip content={waUrl ? "WhatsApp" : "No phone number"} portal>
        <IconButton
          aria-label="WhatsApp"
          disabled={!waUrl || busy}
          onClick={() => ctx.onRequestWhatsapp(row)}
        >
          <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
        </IconButton>
      </Tooltip>

      {/* Reuses the Leads email composer (LEAD-10.2): it opens for every lead, one
          with no address simply starting empty — the same behaviour as the Leads
          row action, rather than a dead control. */}
      <Tooltip content="Mail" portal>
        <IconButton
          aria-label="Mail"
          disabled={busy}
          onClick={() => ctx.onRequestEmail(row)}
        >
          <IconMail size={18} stroke={1.75} aria-hidden="true" />
        </IconButton>
      </Tooltip>

      <Tooltip content="Edit" portal>
        <IconButton
          aria-label="Edit"
          disabled={busy}
          onClick={() => ctx.onRequestEdit(row)}
        >
          <IconPencil size={18} stroke={1.75} aria-hidden="true" />
        </IconButton>
      </Tooltip>

      <Tooltip content="Delete" portal>
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

/**
 * The note affordance beside the title. Workpex marks the activities that carry a
 * note with a small sheet icon whose tooltip is the note itself — see the "booking"
 * tooltip in the supplied Activities capture. Absent when there is no note, so a
 * bare row stays bare.
 */
function NoteMark({ note }: { note: string }) {
  return (
    <Tooltip content={note} portal>
      <span className="flex shrink-0 text-ink-subtle">
        <IconNote size={14} stroke={1.75} aria-label={`Note: ${note}`} />
      </span>
    </Tooltip>
  );
}

/**
 * The due date/time. Workpex makes it the edit affordance — "click to change date"
 * on hover, then a calendar and time row in place. Read-only (no provider) it stays
 * plain text, so the list still renders without row actions (ACT-02.2).
 */
function DueDate({
  row,
  overdue,
}: {
  row: ActivityListItem;
  overdue: boolean;
}) {
  const ctx = useContext(RowContext);
  if (!ctx)
    return (
      <span
        className={cn("text-xs", overdue ? "text-rose-600" : "text-ink-muted")}
      >
        {formatDateTime(row.dueAt)}
      </span>
    );

  return (
    <ActivityDueDateEditor
      row={row}
      overdue={overdue}
      onSave={ctx.onSaveDueDate}
    />
  );
}

function ActivityCell({ row }: { row: ActivityListItem }) {
  // Workpex prints an open, past-due follow-up in red — the worklist's whole point
  // is that an overdue item reads as overdue in every tab, not just Overdue.
  const ctx = useContext(RowContext);
  const overdue =
    ctx !== null && row.completedAt === null && row.dueAt < ctx.overdueBefore;

  return (
    <span className="flex items-center gap-3">
      <CompletionControl row={row} />
      <ActivityAvatar assignees={row.assignees} />
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <Tooltip content={row.title} portal className="min-w-0 flex-1">
            <span
              className={cn(
                "min-w-0 flex-1 truncate font-medium",
                overdue ? "text-rose-600" : "text-ink",
              )}
            >
              {row.title}
            </span>
          </Tooltip>
          {row.description && <NoteMark note={row.description} />}
        </span>
        <DueDate row={row} overdue={overdue} />
      </span>
    </span>
  );
}

/**
 * Customer Name plus Workpex's ↗ affordance. The name keeps its own click target and
 * navigates to the Lead Detail page (ACT-09.1); the ↗ is a separate control that opens
 * that lead's activity timeline — the existing `LeadTimeline` feed the Lead Detail
 * drawer renders, not a second history system. It rests hidden and appears on row hover
 * or keyboard focus, as the Leads list's own arrow does.
 */
function CustomerNameCell({ row }: { row: ActivityListItem }) {
  const ctx = useContext(RowContext);

  return (
    <span className="inline-flex items-center gap-1.5">
      <LeadNameCell lead={row.lead} />
      {ctx && (
        <Tooltip content="Open activity timeline" portal>
          <button
            type="button"
            aria-label={`Open ${row.lead.name} activity timeline`}
            onClick={() => ctx.onRequestTimeline(row)}
            className="focus-ring flex size-5 shrink-0 items-center justify-center rounded-control border border-hairline text-ink-subtle opacity-0 transition-opacity duration-(--duration-shell) ease-shell group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
          >
            <IconArrowUpRight size={13} stroke={2} aria-hidden="true" />
          </button>
        </Tooltip>
      )}
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
    // The shared Leads cell (no `LeadDetailProvider` here, so the name navigates to
    // the Lead Detail page — ACT-09.1), plus Workpex's ↗ beside it. One cell, no
    // second customer-name implementation.
    key: "customerName",
    header: "Customer Name",
    render: (row) => <CustomerNameCell row={row} />,
  },
  {
    key: "pipeline",
    header: "Lead Pipeline",
    render: (row) => <Truncated text={row.lead.pipeline} />,
  },
  {
    key: "callStatus",
    header: "Call Status",
    render: (row) =>
      row.lead.callStatus ? (
        <Truncated text={row.lead.callStatus} />
      ) : (
        orDash(null)
      ),
  },
  {
    // Read-only here (no LeadStatusProvider): a plain colour-coded pill from the
    // canonical stage catalogue, the same source the Leads list and board use.
    key: "leadStatus",
    header: "Lead Status",
    render: (row) => <LeadStatusBadge lead={row.lead} />,
  },
  // ── Additional columns, hidden by default ──────────────────────────────────
  //
  // Workpex's Activities Manage Columns offers the linked lead's fields alongside
  // the five above (its capture shows Primary Phone and First Name below the fold),
  // so the worklist can be widened into a lead view without leaving the page. They
  // render from data `GET /activities` already returns — the row's activity plus its
  // whole `lead` — so none of them costs an extra request. All start hidden, leaving
  // the default worklist exactly as Workpex's default shows it.
  {
    key: "followUpType",
    header: "Follow Up Type",
    render: (row) => <Truncated text={TYPE_LABEL[row.type]} />,
  },
  {
    key: "dueDate",
    header: "Due Date",
    render: (row) => <Truncated text={formatDateTime(row.dueAt)} />,
  },
  {
    key: "endDate",
    header: "End Date",
    render: (row) =>
      row.endAt ? <Truncated text={formatDateTime(row.endAt)} /> : orDash(null),
  },
  {
    key: "completedAt",
    header: "Completed On",
    render: (row) =>
      row.completedAt ? (
        <Truncated text={formatDateTime(row.completedAt)} />
      ) : (
        orDash(null)
      ),
  },
  {
    key: "note",
    header: "Note",
    render: (row) =>
      row.description ? <Truncated text={row.description} /> : orDash(null),
  },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => <Truncated text={row.lead.primaryPhone} />,
  },
  {
    key: "secondaryPhone",
    header: "Secondary Phone",
    render: (row) =>
      row.lead.secondaryPhone ? (
        <Truncated text={row.lead.secondaryPhone} />
      ) : (
        orDash(null)
      ),
  },
  {
    key: "firstName",
    header: "First Name",
    render: (row) =>
      row.lead.firstName ? (
        <Truncated text={row.lead.firstName} />
      ) : (
        orDash(null)
      ),
  },
  {
    key: "email",
    header: "Email",
    render: (row) =>
      row.lead.email ? <Truncated text={row.lead.email} /> : orDash(null),
  },
  {
    key: "source",
    header: "Source",
    render: (row) =>
      row.lead.source ? <Truncated text={row.lead.source} /> : orDash(null),
  },
  {
    key: "country",
    header: "Country",
    render: (row) =>
      row.lead.country ? <Truncated text={row.lead.country} /> : orDash(null),
  },
  {
    key: "city",
    header: "City",
    render: (row) =>
      row.lead.city ? <Truncated text={row.lead.city} /> : orDash(null),
  },
  {
    key: "language",
    header: "Language",
    render: (row) =>
      row.lead.language ? <Truncated text={row.lead.language} /> : orDash(null),
  },
  {
    key: "category",
    header: "Category",
    render: (row) =>
      row.lead.category ? <Truncated text={row.lead.category} /> : orDash(null),
  },
  {
    // The shared Leads tags cell. Read-only here — no `LeadTagsProvider` in the
    // worklist — so it shows the pills without the add/remove affordance.
    key: "tags",
    header: "Tags",
    render: (row) => <LeadTagsCell lead={row.lead} />,
  },
  {
    key: "actualAmount",
    header: "Actual Amount",
    render: (row) => <Truncated text={formatAED(row.lead.actualAmount)} />,
  },
  {
    key: "forecastedAmount",
    header: "Forecasted Amount",
    render: (row) => <Truncated text={formatAED(row.lead.forecastedAmount)} />,
  },
  {
    key: "bookingDate",
    header: "Booking Date",
    render: (row) =>
      row.lead.bookingDate ? (
        <Truncated text={row.lead.bookingDate} />
      ) : (
        orDash(null)
      ),
  },
  {
    key: "callAttempts",
    header: "No. of Call Attempts",
    render: (row) => <Truncated text={String(row.lead.callAttempts)} />,
  },
  {
    key: "whatsappAttempts",
    header: "No. of WhatsApp Attempts",
    render: (row) => <Truncated text={String(row.lead.whatsappAttempts)} />,
  },
  {
    key: "createdDate",
    header: "Created Date",
    render: (row) => <Truncated text={formatDateTime(row.lead.createdAt)} />,
  },
  {
    // The right-edge quick actions (ACT-08.1). A control column, not data, so
    // Manage Columns keeps it fixed and it is not part of the reorderable set.
    key: "actions",
    header: "Actions",
    render: (row) => <ActivityRowActions row={row} />,
  },
];
