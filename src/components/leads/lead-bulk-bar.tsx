"use client";

import {
  IconHistory,
  IconListCheck,
  IconTag,
  IconTrash,
  IconUserShare,
  IconX,
} from "@tabler/icons-react";

type LeadBulkBarProps = {
  count: number;
  onClear: () => void;
  /** Opens the reassign flow (Workpex "Assignee"). LEAD-09.2. */
  onReassign: () => void;
  /** Opens the delete confirmation (Workpex "Delete"). LEAD-09.2. */
  onDelete: () => void;
  /** True while a bulk action runs; the wired actions disable to prevent re-entry. */
  busy?: boolean;
};

/**
 * The bulk action bar shown while leads are selected (LEAD-09.2), traced from
 * `leads-list-all-rows-selected-bulk-action-bar.png`: a floating rounded card
 * over the list — a count block ("100 / Lead Selected"), a divider, then Update,
 * Delete, Assignee, Status and Tags, with a green round ✕ straddling the right
 * edge to clear the selection.
 *
 * Delete and Assignee are wired (LEAD-09.1 API). Update, Status and Tags are shown
 * because Workpex shows them, but they are out of LEAD-09.2's scope (export/reassign/
 * delete) and have no API yet, so they stay inert. There is deliberately no Export
 * here — the Workpex bar has none (ADR-0011). `sticky bottom` keeps the bar centred
 * over the content region and above the pagination without any sidebar-width maths.
 */
export function LeadBulkBar({
  count,
  onClear,
  onReassign,
  onDelete,
  busy = false,
}: LeadBulkBarProps) {
  const actions = [
    { key: "update", label: "Update", Icon: IconHistory, onClick: undefined },
    { key: "delete", label: "Delete", Icon: IconTrash, onClick: onDelete },
    {
      key: "assignee",
      label: "Assignee",
      Icon: IconUserShare,
      onClick: onReassign,
    },
    { key: "status", label: "Status", Icon: IconListCheck, onClick: undefined },
    { key: "tags", label: "Tags", Icon: IconTag, onClick: undefined },
  ] as const;

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

        {actions.map(({ key, label, Icon, onClick }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            disabled={Boolean(onClick) && busy}
            className="flex flex-col items-center gap-1 rounded-control px-3 py-1.5 text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-50"
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
