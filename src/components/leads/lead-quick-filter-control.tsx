"use client";

import { useRef } from "react";
import { IconChevronDown, IconFilter, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import {
  DISABLED_PRESET_HINT,
  QUICK_PRESETS,
} from "@/components/leads/lead-quick-filters";

type LeadQuickFilterControlProps = {
  /** The active preset id, or null when none is applied. */
  active: string | null;
  /** Apply a preset, or clear (null). Re-selecting the active preset clears it. */
  onChange: (id: string | null) => void;
};

/**
 * The Leads "Quick Filter" toolbar control (LEAD-04.1), matched to
 * `leads-quick-filter-dropdown-open.png`: the toolbar shows the **active preset's
 * name** with a clear ✕ and a green wash (not a generic "Quick Filter" label), the
 * menu is a scrollable single-select list, and the active row is tinted green.
 *
 * A Leads-specific control, not the shared `LeadQuickFilterMenu` (the Kanban board
 * still uses that): the Leads toolbar names the active preset and carries a ✕, which
 * the board's smaller control does not — so it is kept separate rather than changing
 * the board's menu. Both read the same `QUICK_PRESETS`, one source of truth.
 */
export function LeadQuickFilterControl({
  active,
  onChange,
}: LeadQuickFilterControlProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);

  const activePreset = QUICK_PRESETS.find(
    (preset) => preset.enabled && preset.id === active,
  );
  const isActive = activePreset !== undefined;

  return (
    <div ref={root} className="relative">
      <div
        className={cn(
          TOOLBAR_BUTTON_CLASS,
          "gap-1.5",
          // A preset turns the control green (AC3), keeping the borderless form.
          isActive && "bg-brand-subtle text-brand-strong hover:bg-brand-subtle",
        )}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={toggle}
          className="focus-ring-inset flex items-center gap-1.5 rounded-control"
        >
          <IconFilter size={18} stroke={1.75} />
          {activePreset ? activePreset.label : "Quick Filter"}
        </button>
        {isActive && (
          <button
            type="button"
            aria-label="Clear quick filter"
            onClick={() => {
              onChange(null);
              close();
            }}
            className="focus-ring flex size-4 shrink-0 items-center justify-center rounded-full text-brand-strong transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
          >
            <IconX size={14} stroke={2} />
          </button>
        )}
        <button
          type="button"
          aria-label="Toggle quick filter menu"
          onClick={toggle}
          className="focus-ring-inset flex shrink-0 items-center rounded-control"
        >
          <IconChevronDown
            size={16}
            stroke={1.75}
            className={isActive ? "text-brand-strong" : "text-ink-muted"}
          />
        </button>
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-label="Quick filter"
          className="scrollbar-slim absolute top-[calc(100%+8px)] right-0 z-50 flex max-h-[70vh] w-56 flex-col overflow-y-auto rounded-surface border border-hairline bg-surface py-1 shadow-lg"
        >
          {QUICK_PRESETS.map((preset) => {
            if (!preset.enabled) {
              return (
                <div
                  key={preset.id}
                  aria-disabled="true"
                  title={DISABLED_PRESET_HINT}
                  className="flex cursor-not-allowed items-center px-4 py-2.5 text-[15px] text-ink opacity-45"
                >
                  {preset.label}
                </div>
              );
            }

            const selected = active === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                aria-current={selected ? "true" : undefined}
                onClick={() => {
                  onChange(selected ? null : preset.id);
                  close();
                }}
                className={cn(
                  "focus-ring-inset flex items-center px-4 py-2.5 text-left text-[15px] transition-colors duration-(--duration-shell) ease-shell",
                  selected
                    ? "bg-brand-subtle font-medium text-brand-strong"
                    : "text-ink hover:bg-canvas",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
