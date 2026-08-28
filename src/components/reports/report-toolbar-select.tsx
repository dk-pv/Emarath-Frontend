"use client";

import { useMemo, useState } from "react";
import { IconChevronDown, type Icon } from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { Popover } from "@/components/ui/Popover";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { cn } from "@/lib/cn";
import type { SelectOption } from "@/types";

export type ReportToolbarSelectProps = {
  label: string;
  icon: Icon;
  options: readonly SelectOption[];
  /** Selected values. A single-select carries 0 or 1 entries. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Checkboxes and multiple selections; otherwise picking a value replaces the selection. */
  multiple?: boolean;
  searchable?: boolean;
  /** Single-select only: the row that clears the selection (e.g. "Any time"). */
  clearLabel?: string;
};

const OPTION_CLASS =
  "flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring-inset";

/**
 * A report toolbar filter: the borderless Workpex pill (icon · label · chevron, plus a count
 * when something is selected) that opens a popover of options.
 *
 * One control for every toolbar filter a report offers — Sales Agent and Pipeline and By Date
 * all differ only in their options and whether they take one value or several, so they share
 * this instead of three near-identical popovers. Styling comes from `TOOLBAR_BUTTON_CLASS`,
 * the same constant the Filter and Export controls use, so the whole bar stays one row of
 * matching pills.
 */
export function ReportToolbarSelect({
  label,
  icon: Glyph,
  options,
  value,
  onChange,
  multiple = false,
  searchable = false,
  clearLabel,
}: ReportToolbarSelectProps) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [options, query]);

  const selected = new Set(value);

  const pick = (optionValue: string) => {
    if (!multiple) {
      onChange(selected.has(optionValue) ? [] : [optionValue]);
      return;
    }
    const next = new Set(selected);
    if (!next.delete(optionValue)) next.add(optionValue);
    onChange([...next]);
  };

  return (
    <Popover
      align="end"
      trigger={
        <span className={cn(TOOLBAR_BUTTON_CLASS, "relative")}>
          <Glyph size={18} stroke={1.75} aria-hidden="true" />
          {label}
          <IconChevronDown size={16} stroke={1.75} className="text-ink-muted" />
          {value.length > 0 && (
            <Badge tone="brand" aria-label={`${value.length} selected`}>
              {value.length}
            </Badge>
          )}
        </span>
      }
    >
      <div className="flex w-64 max-w-[90vw] flex-col">
        {searchable && (
          <div className="border-b border-hairline p-2">
            <PanelSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={`Search ${label.toLowerCase()}`}
            />
          </div>
        )}

        <div className="scrollbar-slim max-h-64 overflow-y-auto py-1">
          {clearLabel && !multiple && (
            <button
              type="button"
              onClick={() => onChange([])}
              className={cn(OPTION_CLASS, value.length === 0 && "font-medium")}
            >
              {clearLabel}
            </button>
          )}

          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">
              No results found
            </p>
          ) : (
            visible.map((option) => (
              <button
                key={option.value}
                type="button"
                // A toggle button, not a listbox option: `role="option"` would be invalid
                // ARIA outside a listbox, so single-select rows report `aria-pressed`.
                aria-pressed={multiple ? undefined : selected.has(option.value)}
                onClick={() => pick(option.value)}
                className={cn(
                  OPTION_CLASS,
                  !multiple && selected.has(option.value) && "font-medium",
                )}
              >
                {multiple && (
                  <Checkbox
                    readOnly
                    checked={selected.has(option.value)}
                    tabIndex={-1}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </Popover>
  );
}
