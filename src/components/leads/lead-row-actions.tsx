"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  IconArrowsExchange2,
  IconBrandWhatsapp,
  IconEdit,
  IconLoader2,
  IconMail,
  IconPin,
  IconTrash,
  IconUserEdit,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { Tooltip } from "@/components/ui/Tooltip";
import type { LeadListItem } from "@/services/leads-service";

/**
 * The per-row action icons on the Leads list (LEAD-10.2), traced pixel-for-pixel
 * from `leads-list-scroll-right-amounts-row-actions-edit-lead-tooltip.png`: pin,
 * WhatsApp, email, Edit Lead (the "Edit Lead" tooltip is the one Workpex captures),
 * reassign, convert and delete — seven icons, always visible at the row's right edge.
 *
 * Wired (LEAD-10.1 API): WhatsApp (a `wa.me` deep-link from the primary phone),
 * Reassign and Delete. Deliberately not wired — recorded in ADR-0013:
 *   • Email is disabled — leads carry no email address, so a `mailto:` has no target.
 *   • Convert is inert — Workpex's green-circle behaviour is uncaptured and the stage
 *     config it would drive (LEAD-11.1) does not exist yet.
 *   • Edit Lead opens the record (its own task, LEAD-06) and Pin is not in the backlog.
 * There is no Duplicate icon: Workpex's row has none, so none is invented.
 */

export type RowActionKind = "reassign" | "delete";

type RowActionsContextValue = {
  onReassign: (lead: LeadListItem) => void;
  onDelete: (lead: LeadListItem) => void;
  /** The lead currently running an action, and which — drives the per-row spinner. */
  pendingId: string | null;
  pendingAction: RowActionKind | null;
};

const RowActionsContext = createContext<RowActionsContextValue | null>(null);

/** Supplies the row-action handlers and the in-flight state to every row. */
export function LeadRowActionsProvider({
  value,
  children,
}: {
  value: RowActionsContextValue;
  children: ReactNode;
}) {
  return <RowActionsContext value={value}>{children}</RowActionsContext>;
}

const ACTION_CLASS =
  "flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted";

export function LeadRowActions({ lead }: { lead: LeadListItem }) {
  const ctx = useContext(RowActionsContext);
  const pending = ctx?.pendingId === lead.id ? ctx.pendingAction : null;
  const busy = pending !== null;
  const waUrl = whatsappUrl(lead.primaryPhone);

  return (
    <span className="flex items-center gap-0.5">
      {/* Pin — Workpex shows it; not in the backlog, so it stays inert. */}
      <Tooltip content="Pin lead">
        <button type="button" aria-label="Pin lead" className={ACTION_CLASS}>
          <IconPin size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* WhatsApp — wa.me deep-link built from the primary phone. */}
      <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
        <button
          type="button"
          aria-label="WhatsApp"
          disabled={!waUrl}
          onClick={() =>
            waUrl && window.open(waUrl, "_blank", "noopener,noreferrer")
          }
          className={ACTION_CLASS}
        >
          <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Email — disabled: leads hold no email address for a mailto (ADR-0013). */}
      <Tooltip content="No email address on this lead">
        <button
          type="button"
          aria-label="Email"
          disabled
          className={ACTION_CLASS}
        >
          <IconMail size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Edit Lead — opens the record (LEAD-06); inert here. */}
      <Tooltip content="Edit Lead">
        <button type="button" aria-label="Edit Lead" className={ACTION_CLASS}>
          <IconEdit size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Reassign — single-lead reassign (LEAD-10.1 API). */}
      <Tooltip content="Reassign">
        <button
          type="button"
          aria-label="Reassign"
          disabled={busy}
          onClick={() => ctx?.onReassign(lead)}
          className={ACTION_CLASS}
        >
          {pending === "reassign" ? (
            <IconLoader2
              size={18}
              stroke={1.75}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <IconUserEdit size={18} stroke={1.75} aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      {/* Convert — a circular control, filled green once a lead is converted.
          Workpex's trigger for that state is not captured, so it stays inert and
          every row shows the default outline until the rule is confirmed (ADR-0013). */}
      <Tooltip content="Convert">
        <button
          type="button"
          aria-label="Convert"
          className="flex size-6 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring"
        >
          <IconArrowsExchange2 size={14} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Delete — single-lead hard delete (LEAD-10.1 API), confirmed first. */}
      <Tooltip content="Delete">
        <button
          type="button"
          aria-label="Delete"
          disabled={busy}
          onClick={() => ctx?.onDelete(lead)}
          className={cn(ACTION_CLASS, "hover:text-danger")}
        >
          {pending === "delete" ? (
            <IconLoader2
              size={18}
              stroke={1.75}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <IconTrash size={18} stroke={1.75} aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </span>
  );
}
