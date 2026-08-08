"use client";

import { IconTrash, IconUsers, IconX } from "@tabler/icons-react";

type DocumentBulkBarProps = {
  count: number;
  onClear: () => void;
  /** Opens the bulk delete confirmation (Workpex "Delete"). DOC-08.1. */
  onDelete: () => void;
  /** True while the bulk delete runs; the wired action disables to prevent re-entry. */
  busy?: boolean;
};

/**
 * The bulk action bar shown while documents are selected (DOC-08.1), traced from
 * `documents-overview.mp4`: a floating rounded card over the list — a count block
 * ("1 / Document Selected"), a divider, then Manage Access and Delete, with a green round ✕
 * straddling the right edge to clear the selection.
 *
 * Delete is wired (DOC-08.1). Manage Access is shown because Workpex shows it, but a bulk
 * access editor is DOC-09.1's scope, not this task's, so it stays inert — the same way the
 * Leads bulk bar shows Update/Status/Tags. `sticky bottom` keeps the bar centred over the
 * content region and above the pagination without any sidebar-width maths.
 */
export function DocumentBulkBar({
  count,
  onClear,
  onDelete,
  busy = false,
}: DocumentBulkBarProps) {
  const actions = [
    { key: "access", label: "Manage Access", Icon: IconUsers, onClick: undefined },
    { key: "delete", label: "Delete", Icon: IconTrash, onClick: onDelete },
  ];

  return (
    <div className="pointer-events-none sticky bottom-6 z-40 flex justify-center">
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-3xl border border-hairline bg-surface py-2.5 pr-8 pl-3 shadow-lg">
        <div className="flex flex-col items-center px-4">
          <span className="text-2xl leading-none font-bold text-ink">
            {count}
          </span>
          <span className="mt-1 text-sm font-semibold whitespace-nowrap text-ink">
            {count === 1 ? "Document Selected" : "Documents Selected"}
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
