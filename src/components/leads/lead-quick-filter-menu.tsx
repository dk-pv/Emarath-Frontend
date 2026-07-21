"use client";

import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import {
  DISABLED_PRESET_HINT,
  QUICK_PRESETS,
} from "@/components/leads/lead-quick-filters";

type LeadQuickFilterMenuProps = {
  /** The active preset id, or null when none is applied. */
  active: string | null;
  /** Apply a preset, or clear (null). Re-selecting the active preset clears it. */
  onChange: (id: string | null) => void;
};

/**
 * The Leads "Quick Filter" toolbar control (LEAD-04.1), composed from the shared
 * Dropdown — the same primitive the Sort menu uses.
 *
 * Reproduces `ui-reference/leads/Quick-Filter.mp4`: a scrolling single-select menu
 * of presets, and a trigger that turns green while a preset is applied (AC3).
 * Selecting a preset applies it in one click; re-selecting it clears (AC2/AC5).
 * Activity-driven presets are shown but disabled until the Activities module lands.
 */
export function LeadQuickFilterMenu({
  active,
  onChange,
}: LeadQuickFilterMenuProps) {
  const isActive = active !== null;

  const items: DropdownItem[] = QUICK_PRESETS.map((preset) => ({
    type: "item",
    id: preset.id,
    label: preset.label,
    disabled: !preset.enabled,
    hint: preset.enabled ? undefined : DISABLED_PRESET_HINT,
    selected: preset.enabled && active === preset.id,
    onSelect: preset.enabled
      ? () => onChange(active === preset.id ? null : preset.id)
      : undefined,
  }));

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span
          className={cn(
            "inline-flex h-control-md items-center gap-2 rounded-control border px-field-x text-sm transition-colors duration-(--duration-shell) ease-shell",
            isActive
              ? "border-brand/40 bg-brand-subtle text-brand-strong"
              : "border-hairline bg-surface text-ink",
          )}
        >
          <IconFilter size={18} stroke={1.75} />
          Quick Filter
          <IconChevronDown
            size={16}
            stroke={1.75}
            className={isActive ? "text-brand-strong" : "text-ink-muted"}
          />
        </span>
      }
    />
  );
}
