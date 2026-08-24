"use client";

import { useRef } from "react";
import {
  IconArrowNarrowDown,
  IconArrowNarrowUp,
  IconArrowsSort,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { LEAD_SORT_FIELDS } from "@/components/leads/lead-sort-fields";
import type { SortState } from "@/types";

type LeadSortControlProps = {
  sort: SortState | undefined;
  onSortChange: (sort: SortState) => void;
  /** Clears the sort back to the default order (Workpex's "Sort ✕"). */
  onClear: () => void;
};

/**
 * The Leads "Sort" toolbar control (LEAD-03.3), matched to
 * `leads-sort-dropdown-open.png`: the toolbar button opens a scrollable field menu,
 * each row a field icon + label; the active field is tinted and carries a direction
 * arrow. Picking a field sorts ascending; picking the active field again flips the
 * direction. A sort is cleared from the button's own ✕ (`onClear`).
 *
 * A Leads-specific control, not the shared `LeadSortMenu` (which the Kanban board
 * still uses): the Leads menu carries the full 28-field Workpex set with field-type
 * icons, scrolling and an active tint that the shared dropdown does not, so it is not
 * folded back in here to keep the board's smaller menu untouched.
 */
export function LeadSortControl({
  sort,
  onSortChange,
  onClear,
}: LeadSortControlProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);

  const isActive = sort !== undefined;

  const select = (key: string) => {
    const next: SortState = {
      key,
      direction: sort?.key === key && sort.direction === "asc" ? "desc" : "asc",
    };
    onSortChange(next);
    close();
  };

  return (
    <div ref={root} className="relative">
      <div className={cn(TOOLBAR_BUTTON_CLASS, "gap-1.5")}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={toggle}
          className="focus-ring-inset flex items-center gap-1.5 rounded-control"
        >
          <IconArrowsSort size={18} stroke={1.75} />
          Sort
        </button>
        {isActive && (
          <button
            type="button"
            aria-label="Clear sort"
            onClick={() => {
              onClear();
              close();
            }}
            className="focus-ring flex size-4 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
          >
            <IconX size={14} stroke={2} />
          </button>
        )}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-label="Sort leads"
          className="scrollbar-slim absolute top-[calc(100%+8px)] right-0 z-50 flex max-h-[70vh] w-64 flex-col overflow-y-auto rounded-surface border border-hairline bg-surface py-1 shadow-lg"
        >
          {LEAD_SORT_FIELDS.map((field) => {
            const Icon = field.icon;

            if (!field.sortable) {
              return (
                <div
                  key={field.label}
                  aria-disabled="true"
                  title={field.hint}
                  className="flex cursor-not-allowed items-center gap-3 px-3 py-2 text-[15px] text-ink opacity-45"
                >
                  <Icon size={18} stroke={1.75} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{field.label}</span>
                </div>
              );
            }

            const active = sort?.key === field.key;
            const Arrow =
              active && sort?.direction === "desc"
                ? IconArrowNarrowDown
                : IconArrowNarrowUp;

            return (
              <button
                key={field.label}
                type="button"
                role="menuitem"
                aria-current={active ? "true" : undefined}
                onClick={() => select(field.key)}
                className={cn(
                  "focus-ring-inset flex items-center gap-3 px-3 py-2 text-left text-[15px] transition-colors duration-(--duration-shell) ease-shell",
                  active
                    ? "bg-brand-subtle text-brand-strong"
                    : "text-ink hover:bg-canvas",
                )}
              >
                <Icon
                  size={18}
                  stroke={1.75}
                  className={cn(
                    "shrink-0",
                    active ? "text-brand-strong" : "text-ink-muted",
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{field.label}</span>
                {active && <Arrow size={16} stroke={2} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
