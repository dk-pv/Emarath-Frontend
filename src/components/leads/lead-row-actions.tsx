"use client";

import {
  IconArrowsExchange2,
  IconBrandWhatsapp,
  IconEdit,
  IconMail,
  IconPin,
  IconTrash,
  IconUserEdit,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * The per-row action icons on the Leads list (LEAD-10.2), traced from
 * `leads-list-scroll-right-amounts-row-actions-edit-lead-tooltip.png`: pin,
 * WhatsApp, email, edit, assign, convert and delete, always visible at the row's
 * right edge.
 *
 * Only the "Edit Lead" tooltip is captured in Workpex; the other labels are
 * written for accessibility and flagged for confirmation. The click behaviours
 * (edit drawer, delete confirmation, assign, convert) are their own backlog tasks
 * and are intentionally inert here — this is the UI only, no API is called.
 */

const ACTION_CLASS =
  "flex size-7 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring";

const ICON_ACTIONS = [
  { key: "pin", label: "Pin lead", Icon: IconPin },
  { key: "whatsapp", label: "WhatsApp", Icon: IconBrandWhatsapp },
  { key: "email", label: "Email", Icon: IconMail },
  { key: "edit", label: "Edit Lead", Icon: IconEdit },
  { key: "assign", label: "Assign", Icon: IconUserEdit },
] as const;

export function LeadRowActions() {
  return (
    <span className="flex items-center gap-0.5">
      {ICON_ACTIONS.map(({ key, label, Icon }) => (
        <Tooltip key={key} content={label}>
          <button type="button" aria-label={label} className={ACTION_CLASS}>
            <Icon size={18} stroke={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      ))}

      {/* Convert is a circular control, filled green once a lead is converted.
          Workpex's trigger for that green state is not captured, so every row
          shows the default outline until the rule is confirmed. */}
      <Tooltip content="Convert">
        <button
          type="button"
          aria-label="Convert"
          className="flex size-6 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring"
        >
          <IconArrowsExchange2 size={14} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>

      <Tooltip content="Delete">
        <button
          type="button"
          aria-label="Delete"
          className={cn(ACTION_CLASS, "hover:text-danger")}
        >
          <IconTrash size={18} stroke={1.75} aria-hidden="true" />
        </button>
      </Tooltip>
    </span>
  );
}
