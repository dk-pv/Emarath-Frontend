"use client";

import { memo, useState } from "react";
import Link from "next/link";
import {
  IconBrandWhatsapp,
  IconEdit,
  IconLoader2,
  IconMapPin,
  IconPhone,
  IconPin,
  IconPinFilled,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { formatAED, formatDate, initialsOf } from "@/lib/format";
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

/**
 * The card's single address line, joined from the lead's address parts in the order
 * Workpex prints them (street, then city, then state). Empty when the lead carries no
 * address at all, which is how the row stays absent rather than rendering blank.
 */
function locationOf(lead: LeadListItem): string {
  return [lead.street, lead.city, lead.state]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

export const KanbanCard = memo(function KanbanCard({
  lead,
}: {
  lead: LeadListItem;
}) {
  const agent = lead.assignedAgents[0];
  const location = locationOf(lead);
  // Workpex shows one avatar per card; when a lead carries several assignees the
  // tooltip names them all rather than inventing a second avatar or a "+N" chip.
  const assignedLabel = lead.assignedAgents.map((a) => a.name).join(", ");
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
        {/* The name is the most frequently clipped value on the card, so it names
            itself in full on hover (portalled, or the column's overflow would cut
            the panel off). */}
        <p className="min-w-0 truncate text-sm font-medium">
          <Tooltip content={lead.name} portal>
            <Link
              href={`/leads/${lead.id}`}
              draggable={false}
              className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
            >
              {lead.name}
            </Link>
          </Tooltip>
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
            <IconButton
              size="xs"
              aria-label={wa ? "WhatsApp" : "No phone number"}
              disabled={!wa}
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                if (wa) actions.onWhatsapp(lead);
              }}
            >
              <IconBrandWhatsapp size={16} stroke={1.75} aria-hidden="true" />
            </IconButton>
          </Tooltip>

          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-(--duration-shell) ease-shell group-hover:opacity-100 group-focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
            <Tooltip content={pinned ? "Unpin lead" : "Pin lead"} portal>
              <IconButton
                size="xs"
                aria-label={pinned ? "Unpin lead" : "Pin lead"}
                aria-pressed={pinned}
                draggable={false}
                onClick={(event) => {
                  event.stopPropagation();
                  void actions.onPin(lead);
                }}
                className={cn(pinned && "text-brand-strong")}
              >
                {pinned ? (
                  <IconPinFilled size={16} stroke={1.75} aria-hidden="true" />
                ) : (
                  <IconPin size={16} stroke={1.75} aria-hidden="true" />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip content="Edit Lead" portal>
              <IconButton
                size="xs"
                aria-label="Edit Lead"
                disabled={editing}
                draggable={false}
                onClick={(event) => {
                  event.stopPropagation();
                  actions.onEdit(lead);
                }}
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
              </IconButton>
            </Tooltip>
            <KanbanCardMenu lead={lead} />
          </div>
        </div>
      </div>

      {/* The badge takes the stage tint's fill but not its border: in
          `kanban-board-default-legend-tooltip-converted.png` the New card's badge runs
          straight from the card's white into the fill at x268 with no edge pixel, unlike
          the column header, which Workpex does outline. */}
      <span
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-ink",
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
        {formatAED(lead.actualAmount ?? 0, { digits: 0 })}
      </p>

      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
        <IconPhone
          size={14}
          stroke={1.75}
          className="shrink-0"
          aria-hidden="true"
        />
        {/* `min-w-0 flex-1` on the wrapper: it is the flex item here, and without it
            its `min-width: auto` floor keeps the truncating span at full text width,
            so a long value would spill past the card instead of ellipsing. */}
        <Tooltip content={lead.primaryPhone} portal className="min-w-0 flex-1">
          <span className="min-w-0 flex-1 truncate">{lead.primaryPhone}</span>
        </Tooltip>
      </p>

      {/* Workpex prints a pinned address under the phone on the cards that carry one
          (`kanban-lead-pipeline-dropdown-open-card-hover.png`: "Near Salmaniya Medical
          Complex, ..", "MUWAILA. NEAR, Sharjah Emirate"), truncated to one line with
          the full text on hover. A lead with no address renders no row at all, so the
          card keeps its compact height. */}
      {location && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <IconMapPin
            size={14}
            stroke={1.75}
            className="shrink-0"
            aria-hidden="true"
          />
          <Tooltip content={location} portal className="min-w-0 flex-1">
            <span className="min-w-0 flex-1 truncate">{location}</span>
          </Tooltip>
        </p>
      )}

      <div className="mt-1 flex items-center justify-between border-t border-hairline pt-1.5">
        {agent ? (
          // Hovering the avatar names the assigned agent in the shared dark tooltip,
          // as the list's Assigned Agents cell does (Workpex card hover).
          <Tooltip content={assignedLabel} portal>
            <Avatar
              name={agent.name}
              initials={initialsOf(agent.name)}
              size="sm"
              className="size-5!"
            />
          </Tooltip>
        ) : (
          // Workpex writes "Unassigned" where the avatar would sit rather than drawing
          // an empty one — see the "My Life My Rules" card in
          // `kanban-sort-dropdown-open-columns-10-15-add-lead.png`.
          <span className="truncate text-xs text-ink-subtle">Unassigned</span>
        )}
        <span className="text-xs text-ink-muted">
          {formatDate(lead.createdAt)}
        </span>
      </div>
    </article>
  );
});
