"use client";

import { memo, useState } from "react";
import { IconBrandWhatsapp, IconPhone } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import type { LeadListItem } from "@/services/leads-service";
import { useKanbanDnd } from "./kanban-dnd-context";

/**
 * The board lead card (KAN-03.1), traced from `kanban-board-default-…png` and
 * `kanban-lead-pipeline-dropdown-open-card-hover.png`: customer name (an underlined
 * link, as in the list) with a WhatsApp quick-contact icon, a dot status badge, the
 * lead value, phone, the assigned agent and the date — over a stage-coloured border.
 *
 * Reuse over duplication: the WhatsApp deep-link is the shared `whatsappUrl` the
 * list's row actions use (LEAD-10.2), the avatar is the shared `Avatar`, and every
 * colour comes from the one canonical stage catalogue (`useStages`, KAN-05.2) so the
 * badge stays consistent with the list's stage colours (AC3). The address line some
 * cards carry is not shown: it is absent from KAN-03.1's fields and from the list
 * API's `LeadListItem`.
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
        "cursor-grab rounded-surface border bg-surface p-3 shadow-sm active:cursor-grabbing",
        colors.cardBorder,
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium text-ink underline decoration-1 underline-offset-2">
          {lead.name}
        </p>
        <button
          type="button"
          aria-label={wa ? "WhatsApp" : "No phone number"}
          disabled={!wa}
          // Stop the click reaching the card, so a card action never starts a move
          // once drag-and-drop lands (KAN-04.2 / AC5).
          onClick={(event) => {
            event.stopPropagation();
            if (wa) window.open(wa, "_blank", "noopener,noreferrer");
          }}
          className="focus-ring flex size-6 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted"
        >
          <IconBrandWhatsapp size={16} stroke={1.75} aria-hidden="true" />
        </button>
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

      <div className="mt-1.5 flex items-center justify-between border-t border-hairline pt-1.5">
        {agent ? (
          <Avatar name={agent.name} initials={initialsOf(agent.name)} size="sm" />
        ) : (
          <Avatar name="Unassigned" size="sm" />
        )}
        <span className="text-xs text-ink-muted">
          {formatDate(lead.createdAt)}
        </span>
      </div>
    </article>
  );
});
