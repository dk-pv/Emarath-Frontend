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
  /** Escapes an ancestor `overflow-hidden` (a report's results Card). */
  portal?: boolean;
  /**
   * Names the panel, as the Call Log Filter reference does. With a title the
   * panel grows a header row carrying "Clear all" on the right; without one it
   * keeps the untitled form every other module already uses.
   */
  title?: string;
  /**
   * `solid` is the GPS Map trigger (GPS-MAP-overview.mp4): the active count rides in
   * the label as "Filter/1" and the pill fills brand while any filter is applied,
   * instead of the default's neutral pill plus count badge. Opt-in, so the eight
   * other consumers keep the trigger they were built against.
   */
  triggerVariant?: "default" | "solid";
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
  portal = false,
  title,
  triggerVariant = "default",
}: FilterPanelProps) {
  const solid = triggerVariant === "solid";
  const applied = solid && activeCount > 0;
  return (
    <Popover
      align="end"
      portal={portal}
      // `group` lets the trigger's own `aria-expanded` drive the open state below,
      // which is the only signal Popover exposes to a trigger node.
      triggerClassName="group rounded-control"
      trigger={
        <span
          className={cn(
            TOOLBAR_BUTTON_CLASS,
            "relative border border-transparent",
            // Open state, per the reference: a green wash inside a green outline.
            "group-aria-expanded:border-brand group-aria-expanded:bg-brand/15 group-aria-expanded:text-ink",
            applied &&
              "border-brand bg-brand text-white group-aria-expanded:bg-brand group-aria-expanded:text-white",
          )}
        >
          <IconFilter size={18} stroke={1.75} />
          {solid && activeCount > 0 ? (
            <span aria-label={`${activeCount} active filters`}>
              Filter/{activeCount}
            </span>
          ) : (
            "Filter"
          )}
          <IconChevronDown
            size={16}
            stroke={1.75}
            // The chevron points back at the button once the panel is open.
            className={cn(
              "transition-transform duration-(--duration-shell) ease-shell group-aria-expanded:rotate-180",
              applied ? "text-white" : "text-ink-muted",
            )}
          />
          {!solid && activeCount > 0 && (
            <Badge tone="brand" aria-label={`${activeCount} active filters`}>
              {activeCount}
            </Badge>
          )}
        </span>
      }
    >
      <div className="w-80 max-w-full p-4">
        {title && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-ink">{title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={activeCount === 0}
            >
              Clear all
            </Button>
          </div>
        )}

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

        {/* Untitled panels keep their footer control; a titled one already
            carries Clear all in its header, as the reference shows. */}
        {!title && (
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
        )}
      </div>
    </Popover>
  );
}
