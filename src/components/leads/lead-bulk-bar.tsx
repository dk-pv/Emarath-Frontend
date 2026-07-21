"use client";

import {
  IconHistory,
  IconListCheck,
  IconTag,
  IconTrash,
  IconUserShare,
  IconX,
} from "@tabler/icons-react";

/**
 * The bulk action bar shown while leads are selected (LEAD-09.2), traced from
 * `leads-list-all-rows-selected-bulk-action-bar.png`: a floating rounded card
 * over the list — a count block ("100 / Lead Selected"), a divider, then Update,
 * Delete, Assignee, Status and Tags, with a green round ✕ straddling the right
 * edge to clear the selection.
 *
 * Only clearing is wired; each bulk action opens its own dialog in Workpex, and
 * those states are not captured, so the buttons are inert until those screenshots
 * and their APIs exist. `sticky bottom` keeps the bar centred over the content
 * region and above the pagination without any sidebar-width maths.
 */
const ACTIONS = [
  { key: "update", label: "Update", Icon: IconHistory },
  { key: "delete", label: "Delete", Icon: IconTrash },
  { key: "assignee", label: "Assignee", Icon: IconUserShare },
  { key: "status", label: "Status", Icon: IconListCheck },
  { key: "tags", label: "Tags", Icon: IconTag },
] as const;

export function LeadBulkBar({
  count,
  onClear,
}: {
  count: number;
  onClear: () => void;
}) {
  return (
    <div className="pointer-events-none sticky bottom-6 z-40 flex justify-center">
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-3xl border border-hairline bg-surface py-2.5 pr-8 pl-3 shadow-lg">
        <div className="flex flex-col items-center px-4">
          <span className="text-2xl leading-none font-bold text-ink">
            {count}
          </span>
          <span className="mt-1 text-sm font-semibold whitespace-nowrap text-ink">
            Lead Selected
          </span>
        </div>

        <span className="mx-1 h-11 w-px shrink-0 bg-hairline" />

        {ACTIONS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            className="flex flex-col items-center gap-1 rounded-control px-3 py-1.5 text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring"
          >
            <Icon size={22} stroke={1.6} aria-hidden="true" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}

        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="absolute top-1/2 right-0 flex size-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-brand text-surface shadow-md transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong focus-ring"
        >
          <IconX size={18} stroke={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
