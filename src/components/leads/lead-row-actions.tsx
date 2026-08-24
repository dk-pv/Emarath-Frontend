"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  IconArrowsExchange2,
  IconBrandWhatsapp,
  IconEdit,
  IconLoader2,
  IconMail,
  IconNote,
  IconPin,
  IconPinFilled,
  IconTrash,
  IconUserEdit,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { Tooltip } from "@/components/ui/Tooltip";
import type { LeadListItem } from "@/services/leads-service";

/**
 * The per-row action icons on the Leads list (LEAD-10.2), traced pixel-for-pixel
 * from `leads-list-scroll-right-amounts-row-actions-edit-lead-tooltip.png` and
 * `leads-add-note-row-action.png`: pin, WhatsApp, email, Edit Lead (the "Edit Lead"
 * tooltip is the one that screenshot captures), Add Note (its own "Add Note"
 * tooltip), reassign, convert and delete — eight icons, always visible at the row's
 * right edge.
 *
 * Wired (LEAD-10.1 API): WhatsApp (a `wa.me` deep-link from the primary phone),
 * Reassign and Delete. Reassign is role-gated — only managers and admins see it
 * (AUTH-02.2); for other roles the icon is omitted.
 * Convert (ADR-0048, supersedes the inert ADR-0013 state): sets the lead's status to
 *   the approved converted value ("WON" — the same definition the Converted Leads
 *   report and quick filter already use) through the existing set-status API, behind a
 *   confirm dialog. A converted lead's icon is filled green with a "Converted" tooltip
 *   and is non-actionable, so a lead can't be converted twice. The green state reads
 *   from the persisted `status`, so an already-WON lead renders green on load.
 * Wired later: Email opens the Send Email composer (ADR-0032); Edit Lead opens the
 * shared New Lead form in edit mode, prefilled from the record (LEAD-06 edit mode);
 * Add Note opens the Add Note composer, persisting a note to the lead (ADR-0035).
 * Pin is wired (ADR-0031): a personal, per-user pin that floats the lead to the top
 * of the caller's own list. There is no Duplicate icon: Workpex's row has none.
 */

export type RowActionKind = "reassign" | "delete" | "pin" | "edit";

/**
 * The lead status that means "converted" — the approved definition (RPT-02.6) shared
 * by the backend Converted Leads report (`CONVERTED_STATUS`) and the Leads "Converted
 * Leads" quick filter. Converting a lead sets its status to this value; a lead already
 * at this status renders as converted. One source of truth for the whole feature.
 */
export const CONVERTED_STATUS = "WON";

/** True when a lead is converted, read from its persisted status (not local state). */
export const isLeadConverted = (lead: LeadListItem): boolean =>
  lead.status === CONVERTED_STATUS;

type RowActionsContextValue = {
  onReassign: (lead: LeadListItem) => void;
  onDelete: (lead: LeadListItem) => void;
  /** Open the Convert confirm dialog for a lead (ADR-0048); a no-op once converted. */
  onConvert: (lead: LeadListItem) => void;
  /** Open the Send Whatsapp Message composer for a lead (LEAD-10.2). */
  onWhatsapp: (lead: LeadListItem) => void;
  /** Open the Send Email composer for a lead (LEAD-10.2, ADR-0032). */
  onEmail: (lead: LeadListItem) => void;
  /** Open the Edit Lead form, prefilled from this lead (LEAD-06 edit mode). */
  onEdit: (lead: LeadListItem) => void;
  /** Open the Add Note composer for a lead (LEAD-10.2, ADR-0035). */
  onAddNote: (lead: LeadListItem) => void;
  /** Toggle the caller's personal pin on a lead (ADR-0031). */
  onPin: (lead: LeadListItem) => void;
  /** The lead currently running an action, and which — drives the per-row spinner. */
  pendingId: string | null;
  pendingAction: RowActionKind | null;
  /** Managers/admins only see the Reassign control (AUTH-02.2). */
  canReassign: boolean;
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

  const pinned = lead.isPinned;
  const converted = isLeadConverted(lead);

  return (
    <span className="flex items-center gap-0.5">
      {/* Pin — a personal, per-user pin (ADR-0031). Filled + brand-green when the
          caller has it pinned; toggles off on a second click. */}
      <Tooltip content={pinned ? "Unpin lead" : "Pin lead"}>
        <button
          type="button"
          aria-label={pinned ? "Unpin lead" : "Pin lead"}
          aria-pressed={pinned}
          disabled={busy}
          onClick={() => ctx?.onPin(lead)}
          className={cn(ACTION_CLASS, pinned && "text-brand-strong")}
        >
          {pending === "pin" ? (
            <IconLoader2
              size={18}
              stroke={1.75}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : pinned ? (
            <IconPinFilled size={18} stroke={1.75} aria-hidden="true" />
          ) : (
            <IconPin size={18} stroke={1.75} aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      {/* WhatsApp — opens the "Send Whatsapp Message" composer (LEAD-10.2). The
          wa.me deep-link fires from the drawer's Send, never from this icon. */}
      <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
        <button
          type="button"
          aria-label="WhatsApp"
          disabled={!waUrl}
          onClick={() => waUrl && ctx?.onWhatsapp(lead)}
          className={ACTION_CLASS}
        >
          <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Email — opens the Send Email composer (LEAD-10.2, ADR-0032). Enabled for
          every lead: one with no email opens an empty, still-usable composer. */}
      <Tooltip content="Email">
        <button
          type="button"
          aria-label="Email"
          onClick={() => ctx?.onEmail(lead)}
          className={ACTION_CLASS}
        >
          <IconMail size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Edit Lead — opens the shared New Lead form in edit mode, prefilled from the
          record (LEAD-06 edit mode). Shows a spinner while the record is fetched. */}
      <Tooltip content="Edit Lead">
        <button
          type="button"
          aria-label="Edit Lead"
          disabled={busy}
          onClick={() => ctx?.onEdit(lead)}
          className={ACTION_CLASS}
        >
          {pending === "edit" ? (
            <IconLoader2
              size={18}
              stroke={1.75}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <IconEdit size={18} stroke={1.75} aria-hidden="true" />
          )}
        </button>
      </Tooltip>

      {/* Add Note — opens the Add Note composer (LEAD-10.2, ADR-0035). Like Email
          and WhatsApp it only opens the drawer; the note is saved from the drawer's
          Submit, so there is no per-row spinner here. */}
      <Tooltip content="Add Note">
        <button
          type="button"
          aria-label="Add Note"
          onClick={() => ctx?.onAddNote(lead)}
          className={ACTION_CLASS}
        >
          <IconNote size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Reassign — single-lead reassign (LEAD-10.1 API); managers/admins only (AUTH-02.2). */}
      {ctx?.canReassign && (
        <Tooltip content="Reassign">
          <button
            type="button"
            aria-label="Reassign"
            disabled={busy}
            onClick={() => ctx.onReassign(lead)}
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
      )}

      {/* Convert (ADR-0048) — a circular control, filled green once converted. Clicking
          an unconverted lead opens the confirm dialog; a converted lead is non-actionable
          (guarded onClick, aria-disabled) but stays focusable/hoverable so its "Converted"
          tooltip still shows. The green state reads the persisted status, so it survives
          reload. `disabled` only while another row action is running. */}
      <Tooltip content={converted ? "Converted" : "Convert"}>
        <button
          type="button"
          aria-label={converted ? "Converted" : "Convert"}
          aria-disabled={converted || undefined}
          disabled={busy}
          onClick={() => {
            if (!converted) ctx?.onConvert(lead);
          }}
          className={cn(
            "flex size-6 items-center justify-center rounded-full border transition-colors duration-(--duration-shell) ease-shell focus-ring disabled:cursor-not-allowed disabled:opacity-45",
            converted
              ? "cursor-default border-brand bg-brand text-white"
              : "border-hairline text-ink-muted hover:bg-canvas hover:text-ink",
          )}
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
