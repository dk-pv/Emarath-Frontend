"use client";

import { useRef, useState } from "react";
import {
  IconArchive,
  IconArrowsExchange2,
  IconArrowsRightLeft,
  IconBrandWhatsapp,
  IconDotsVertical,
  IconMail,
  IconNote,
  IconPin,
  IconPinFilled,
  IconTrash,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import { AnchoredLayer } from "@/components/ui/AnchoredLayer";
import { Tooltip } from "@/components/ui/Tooltip";
import type { LeadListItem } from "@/services/leads-service";
import { useKanbanCardActions } from "./kanban-card-actions";

/**
 * The card's ⋮ Actions menu (KAN-03.1), traced from the Workpex card-hover reference
 * (`kanban-lead-pipeline-dropdown-open-card-hover.png`): WhatsApp, Email, Add Notes,
 * Change Pipeline, Convert Lead — a separator — Pin, Archive, Delete, under an
 * "Actions" heading.
 *
 * It is PORTALLED to `document.body` with fixed positioning: the card sits inside the
 * column's `overflow-y-auto` body and the row's `overflow-x-auto`, so an absolutely
 * positioned menu (the shared Dropdown) would be clipped by both. Fixed positioning
 * off the trigger's rect escapes both; the menu opens upward when the trigger sits low
 * so it never runs off the bottom, and closes on any scroll/resize (a fixed panel
 * would otherwise detach from the scrolling card).
 *
 * Every item is real and reuses the card action handlers (`useKanbanCardActions`):
 * Change Pipeline opens the pipeline picker, Archive soft-archives, and the rest map to
 * the reused composers/dialogs. WhatsApp is the only item that ever disables — when the
 * lead has no phone number.
 */

const PANEL_WIDTH = 224; // w-56 — the design-system Dropdown's width.

const TRIGGER_CLASS =
  "focus-ring flex size-5 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink";

const ITEM_CLASS =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring-inset";

type Row =
  | { kind: "label"; id: string; label: string }
  | { kind: "separator"; id: string }
  | {
      kind: "item";
      id: string;
      label: string;
      icon: Icon;
      onSelect: () => void;
      disabled?: boolean;
      hint?: string;
      danger?: boolean;
    };

export function KanbanCardMenu({ lead }: { lead: LeadListItem }) {
  const actions = useKanbanCardActions();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const toggle = () => setOpen((value) => !value);

  const wa = whatsappUrl(lead.primaryPhone);
  const pinned = actions.isPinned(lead);

  const rows: Row[] = [
    { kind: "label", id: "actions", label: "Actions" },
    {
      kind: "item",
      id: "whatsapp",
      label: "WhatsApp",
      icon: IconBrandWhatsapp,
      onSelect: () => actions.onWhatsapp(lead),
      disabled: !wa,
      hint: wa ? undefined : "No phone number",
    },
    {
      kind: "item",
      id: "email",
      label: "Email",
      icon: IconMail,
      onSelect: () => actions.onEmail(lead),
    },
    {
      kind: "item",
      id: "note",
      label: "Add Notes",
      icon: IconNote,
      onSelect: () => actions.onAddNote(lead),
    },
    {
      kind: "item",
      id: "pipeline",
      label: "Change Pipeline",
      icon: IconArrowsRightLeft,
      onSelect: () => actions.onChangePipeline(lead),
    },
    {
      kind: "item",
      id: "convert",
      label: "Convert Lead",
      icon: IconArrowsExchange2,
      onSelect: () => actions.onConvert(lead),
    },
    { kind: "separator", id: "sep" },
    {
      kind: "item",
      id: "pin",
      label: pinned ? "Unpin" : "Pin",
      icon: pinned ? IconPinFilled : IconPin,
      onSelect: () => void actions.onPin(lead),
    },
    {
      kind: "item",
      id: "archive",
      label: "Archive",
      icon: IconArchive,
      onSelect: () => actions.onArchive(lead),
    },
    {
      kind: "item",
      id: "delete",
      label: "Delete",
      icon: IconTrash,
      onSelect: () => actions.onDelete(lead),
      danger: true,
    },
  ];

  return (
    <>
      {/* Suppressed while the menu is open so the tooltip never sits over the panel. */}
      <Tooltip content="More" disabled={open} portal>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Lead actions"
          aria-haspopup="menu"
          aria-expanded={open}
          draggable={false}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
          className={TRIGGER_CLASS}
        >
          <IconDotsVertical size={16} stroke={2} aria-hidden="true" />
        </button>
      </Tooltip>

      <AnchoredLayer
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        align="end"
        width={PANEL_WIDTH}
        role="menu"
        aria-label={`${lead.name} actions`}
        className="max-h-[70vh] overflow-y-auto py-1"
      >
        {rows.map((row) => {
          if (row.kind === "separator") {
            return <hr key={row.id} className="my-1 border-hairline" />;
          }
          if (row.kind === "label") {
            return (
              <p
                key={row.id}
                className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle"
              >
                {row.label}
              </p>
            );
          }
          const RowIcon = row.icon;
          if (row.disabled) {
            return (
              <div
                key={row.id}
                aria-disabled="true"
                title={row.hint}
                className={cn(ITEM_CLASS, "cursor-not-allowed opacity-45")}
              >
                <RowIcon
                  size={18}
                  stroke={1.75}
                  className="shrink-0"
                  aria-hidden="true"
                />
                {row.label}
              </div>
            );
          }
          return (
            <button
              key={row.id}
              type="button"
              role="menuitem"
              onClick={() => {
                row.onSelect();
                setOpen(false);
              }}
              className={cn(ITEM_CLASS, row.danger && "hover:text-danger")}
            >
              <RowIcon
                size={18}
                stroke={1.75}
                className="shrink-0"
                aria-hidden="true"
              />
              {row.label}
            </button>
          );
        })}
      </AnchoredLayer>
    </>
  );
}
