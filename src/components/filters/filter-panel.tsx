"use client";

import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Popover } from "@/components/ui/Popover";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { cn } from "@/lib/cn";
import { FilterFieldControl } from "./filter-field-control";
import type { FilterCondition, FilterField } from "@/types";

type FilterPanelProps = {
  fields: readonly FilterField[];
  activeCount: number;
  valueOf: (key: string) => FilterCondition["value"];
  onChange: (key: string, value: FilterCondition["value"]) => void;
  onClear: () => void;
};

/**
 * The shared filter control: a trigger carrying the active-filter count and a popover
 * of one control per module-supplied field (FND-03.2 AC2, AC3, AC5).
 *
 * Workpex opens filters in a popover on Leads/Reports/GPS and a drawer on Manage
 * Columns; this is the popover form, matching leads-filters-popup-open.png.
 */
export function FilterPanel({
  fields,
  activeCount,
  valueOf,
  onChange,
  onClear,
}: FilterPanelProps) {
  return (
    <Popover
      align="end"
      trigger={
        <span className={cn(TOOLBAR_BUTTON_CLASS, "relative")}>
          <IconFilter size={18} stroke={1.75} />
          Filter
          <IconChevronDown size={16} stroke={1.75} className="text-ink-muted" />
          {activeCount > 0 && (
            <Badge tone="brand" aria-label={`${activeCount} active filters`}>
              {activeCount}
            </Badge>
          )}
        </span>
      }
    >
      <div className="w-80 max-w-[90vw] p-4">
        <div className="flex flex-col gap-3">
          {fields.map((field) => (
            <FormField key={field.key} label={field.label}>
              <FilterFieldControl
                field={field}
                value={valueOf(field.key)}
                onChange={(value) => onChange(field.key, value)}
              />
            </FormField>
          ))}
        </div>

        <div className="mt-4 flex justify-end border-t border-hairline pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={activeCount === 0}
          >
            Clear all
          </Button>
        </div>
      </div>
    </Popover>
  );
}
