"use client";

import { IconX, type Icon } from "@tabler/icons-react";

export type BulkAction = {
  key: string;
  label: string;
  Icon: Icon;
  /** Omitted for an action Workpex shows but this module has no API for yet. */
  onClick?: () => void;
};

export type BulkActionBarProps = {
  count: number;
  /** The already-pluralised noun beneath the count, e.g. "Activities Selected". */
  label: string;
  actions: readonly BulkAction[];
  onClear: () => void;
  /** True while a bulk action runs; the wired actions disable to prevent re-entry. */
  busy?: boolean;
};

/**
 * The floating bar Workpex shows while rows are selected: a count block over its
 * noun, a divider, the actions, and a green round ✕ straddling the right edge to
 * clear the selection.
 *
 * Extracted from the Leads bar so Activities reuses it rather than becoming a third
 * copy — the shell is identical across modules and only the noun and the action set
 * differ. `sticky bottom` keeps it centred over the content region and above the
 * pagination without any sidebar-width maths.
 */
export function BulkActionBar({
  count,
  label,
  actions,
  onClear,
  busy = false,
}: BulkActionBarProps) {
  return (
    <div className="pointer-events-none sticky bottom-6 z-40 flex justify-center">
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-3xl border border-hairline bg-surface py-2.5 pr-8 pl-3 shadow-lg">
        <div className="flex flex-col items-center px-4">
          <span className="text-2xl leading-none font-bold text-ink">
            {count}
          </span>
          <span className="mt-1 text-sm font-semibold whitespace-nowrap text-ink">
            {label}
          </span>
        </div>

        <span className="mx-1 h-11 w-px shrink-0 bg-hairline" />

        {actions.map(
          ({ key, label: actionLabel, Icon: ActionIcon, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              disabled={Boolean(onClick) && busy}
              className="flex flex-col items-center gap-1 rounded-control px-3 py-1.5 text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ActionIcon size={22} stroke={1.6} aria-hidden="true" />
              <span className="text-xs font-medium">{actionLabel}</span>
            </button>
          ),
        )}

        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className="focus-ring absolute top-1/2 right-0 flex size-9 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-brand text-surface shadow-md transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong"
        >
          <IconX size={18} stroke={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
