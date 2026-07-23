"use client";

import { IconChartFunnel, IconChevronDown } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { useLookup } from "@/hooks/use-lookup";

/**
 * The Lead Pipeline switcher (KAN-06.1 AC1/AC2) — the brand pill + dropdown on the
 * board header (`kanban-lead-pipeline-dropdown-open-card-hover.png`). The pipelines
 * come from the shared `pipelines` lookup (ADR-0005), so the list stays canonical;
 * selecting one lifts the choice to the board, which regroups by that pipeline.
 *
 * Reuses the shared `Dropdown`, so the current pipeline is marked with the app's
 * standard selected-check rather than Workpex's green row fill — the design-system
 * convention for a selected menu item.
 */
export function PipelineSwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (pipeline: string) => void;
}) {
  const { options, isLoading } = useLookup("pipelines");

  const items: DropdownItem[] = options.map((option) => ({
    type: "item",
    id: option.value,
    label: option.label,
    selected: option.value === value,
    onSelect: () => onChange(option.value),
  }));

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span className="inline-flex h-control-sm items-center gap-2 rounded-control bg-brand-subtle px-3 text-sm font-medium text-brand-strong">
          <IconChartFunnel size={16} stroke={1.75} aria-hidden="true" />
          <span className="truncate">{isLoading ? "Lead Pipeline" : value}</span>
          <IconChevronDown size={16} stroke={1.75} aria-hidden="true" />
        </span>
      }
    />
  );
}
