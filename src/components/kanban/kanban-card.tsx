"use client";

import { memo, useState } from "react";
import Link from "next/link";
import {
  IconBrandWhatsapp,
  IconEdit,
  IconLoader2,
  IconPhone,
  IconPin,
  IconPinFilled,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import type { LeadListItem } from "@/services/leads-service";
import { useKanbanCardActions } from "./kanban-card-actions";
import { KanbanCardMenu } from "./kanban-card-menu";
import { useKanbanDnd } from "./kanban-dnd-context";

/**
 * The board lead card (KAN-03.1), traced from `kanban-board-default-…png` and
 * `kanban-lead-pipeline-dropdown-open-card-hover.png`: customer name (an underlined
 * link, as in the list) with a WhatsApp quick-contact icon, a dot status badge, the
 * lead value, phone, the assigned agent and the date — over a stage-coloured border.
 *
 * The card-hover reference reveals three more controls beside WhatsApp on hover —
 * Pin, Edit and a ⋮ Actions menu — so those are shown on hover/focus (WhatsApp stays
 * always visible). Every action reuses the Leads-list logic through
 * `useKanbanCardActions`; the menu itself is `KanbanCardMenu`.
 *
 * Reuse over duplication: WhatsApp/Pin/Edit and the menu all call the existing
 * row-action handlers (LEAD-10.x), the avatar is the shared `Avatar`, and every colour
 * comes from the one canonical stage catalogue (`useStages`, KAN-05.2) so the badge
 * stays consistent with the list's stage colours (AC3). The address line some cards
 * carry is not shown: it is absent from KAN-03.1's fields and from the list API's
 * `LeadListItem`.
 */

// Local money/date formatters until FND-04.1 ships the shared utilities, as
// `lead-columns` does. Cards read whole AED values ("130 د.إ", "0 د.إ").
const AED = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

function formatValue(value: string | null): string {
  const amount = value === null ? 0 : Number(value);
  return `${AED.format(Number.isNaN(amount) ? 0 : amount)} د.إ`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getFullYear()}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** The card's quick-action icon buttons (WhatsApp/Pin/Edit) — one shared shape. */
const ICON_BUTTON_CLASS =
  "focus-ring flex size-5 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted";

export const KanbanCard = memo(function KanbanCard({
  lead,
}: {
  lead: LeadListItem;
}) {
  const agent = lead.assignedAgents[0];
  const wa = whatsappUrl(lead.primaryPhone);
  const dnd = useKanbanDnd();
  const { colorsFor } = useStages();
  const colors = colorsFor(lead.status);
  const actions = useKanbanCardActions();
  const pinned = actions.isPinned(lead);
  const editing = actions.pendingEditId === lead.id;
  const [dragging, setDragging] = useState(false);

  return (
    <article
      // Native HTML5 drag (KAN-04.2): a card is its column's drag source. The
      // dragged lead's identity travels through the board's DnD coordinator, not
      // `dataTransfer`; the text payload only satisfies browsers that require one to
      // start a drag. `lead.status` is always this column's stage (the board keeps
      // them in step), so it is the source stage.
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", lead.id);
        setDragging(true);
        dnd.onDragStart(lead.id, lead.status);
      }}
      onDragEnd={() => {
        setDragging(false);
        dnd.onDragEnd();
      }}
      className={cn(
        "group cursor-grab rounded-surface border bg-surface p-2.5 shadow-sm active:cursor-grabbing",
        colors.cardBorder,
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* The name opens the Lead Detail page, the app-wide Workpex behaviour
            (CustomerName-Click.mp4, ACT-09.1) — `<Link>` so Back returns to the
            board. `draggable={false}` keeps the card's own drag as the drag source. */}
        <p className="truncate text-sm font-medium">
          <Link
            href={`/leads/${lead.id}`}
            draggable={false}
            className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
          >
            {lead.name}
          </Link>
        </p>

        {/* Quick actions (KAN-03.1, from the card-hover reference). WhatsApp is always
            visible; Pin, Edit and the ⋮ menu reveal on hover/focus, exactly as Workpex
            shows them. Each stops the click reaching the card so an action never starts
            a move (KAN-04.2 / AC5), and is `draggable={false}` so it is not a drag
            source. All reuse the Leads-list handlers via `useKanbanCardActions`. */}
        {/* Each icon names itself in the shared dark tooltip on hover, the same
            content the Leads-list row actions show (Workpex card-hover tooltips). */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip content={wa ? "WhatsApp" : "No phone number"} portal>
            <button
              type="button"
              aria-label={wa ? "WhatsApp" : "No phone number"}
              disabled={!wa}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                if (wa) actions.onWhatsapp(lead);
              }}
              className={ICON_BUTTON_CLASS}
            >
              <IconBrandWhatsapp size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>

          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-(--duration-shell) ease-shell group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
            <Tooltip content={pinned ? "Unpin lead" : "Pin lead"} portal>
              <button
                type="button"
                aria-label={pinned ? "Unpin lead" : "Pin lead"}
                aria-pressed={pinned}
                draggable={false}
                onClick={(event) => {
                  event.stopPropagation();
                  void actions.onPin(lead);
                }}
                className={cn(ICON_BUTTON_CLASS, pinned && "text-brand-strong")}
              >
                {pinned ? (
                  <IconPinFilled size={16} stroke={1.75} aria-hidden="true" />
                ) : (
                  <IconPin size={16} stroke={1.75} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
            <Tooltip content="Edit Lead" portal>
              <button
                type="button"
                aria-label="Edit Lead"
                disabled={editing}
                draggable={false}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.onEdit(lead);
                }}
                className={ICON_BUTTON_CLASS}
              >
                {editing ? (
                  <IconLoader2
                    size={16}
                    stroke={1.75}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <IconEdit size={16} stroke={1.75} aria-hidden="true" />
                )}
              </button>
            </Tooltip>
            <KanbanCardMenu lead={lead} />
          </div>
        </div>
      </div>

      <span
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-ink",
          colors.tint,
        )}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", colors.swatch)}
          aria-hidden="true"
        />
        {lead.status}
      </span>

      <p className="mt-1 text-base font-semibold text-ink">
        {formatValue(lead.actualAmount)}
      </p>

      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
        <IconPhone
          size={14}
          stroke={1.75}
          className="shrink-0"
          aria-hidden="true"
        />
        <span className="truncate">{lead.primaryPhone}</span>
      </p>

      <div className="mt-1 flex items-center justify-between border-t border-hairline pt-1.5">
        {agent ? (
          // Hovering the avatar names the assigned agent in the shared dark tooltip,
          // as the list's Assigned Agents cell does (Workpex card hover). Unassigned
          // stays a bare placeholder — no name to show.
          <Tooltip content={agent.name}>
            <Avatar
              name={agent.name}
              initials={initialsOf(agent.name)}
              size="sm"
              className="size-5!"
            />
          </Tooltip>
        ) : (
          <Avatar name="Unassigned" size="sm" className="size-5!" />
        )}
        <span className="text-xs text-ink-muted">
          {formatDate(lead.createdAt)}
        </span>
      </div>
    </article>
  );
});
