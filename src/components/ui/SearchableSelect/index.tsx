"use client";

import { useMemo, useRef, useState } from "react";
import { IconChevronDown, IconPlus, IconX } from "@tabler/icons-react";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import type { SelectOption, Size } from "@/types";

export type SearchableSelectProps = {
  options: readonly SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** A type-ahead box in the panel. Off for short fixed lists, matching Workpex. */
  searchable?: boolean;
  /** Shows a clear (×) once a value is set — Workpex's Lead Status / Lead Pipeline. */
  clearable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  id?: string;
  /**
   * Inline-create extension point for the future Master modules (Products, Tags,
   * Languages, …). Dormant by default: when `allowCreate` is off — as on every
   * current Lead form field — the component behaves exactly as before. A future
   * Master consumer flips `allowCreate` and supplies `onCreate` to add a value
   * without touching this component. Not wired to any backend yet (LEAD-06.2 scope).
   */
  allowCreate?: boolean;
  createLabel?: (query: string) => string;
  onCreate?: (query: string) => void;
  /**
   * Trigger height on the shared control scale. Only the height moves — the label stays
   * `text-sm` at every size, unlike `Input`, whose `lg` also steps the type up.
   */
  size?: Size;
};

const TRIGGER_CLASS =
  "flex w-full items-center gap-2 rounded-control border bg-surface px-field-x text-sm transition-colors duration-(--duration-shell) ease-shell focus-ring disabled:cursor-not-allowed disabled:opacity-50";

const TRIGGER_HEIGHT: Record<Size, string> = {
  sm: "h-control-sm",
  md: "h-control-md",
  lg: "h-control-lg",
};

const PANEL_CLASS =
  "absolute top-[calc(100%+6px)] left-0 z-50 max-h-64 w-full min-w-56 overflow-hidden rounded-surface border border-hairline bg-surface shadow-lg";

const OPTION_CLASS =
  "flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas";

/**
 * Single-select with an optional type-ahead — the Workpex New Lead dropdowns
 * (Product, Country, Category open with a search box; Language, Source and the
 * like open as a plain list). Filtering is client-side; the panel shows a
 * "No results found" state, and the active option is highlighted like the video.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select",
  searchable = true,
  clearable = false,
  disabled,
  loading,
  invalid,
  id,
  allowCreate = false,
  createLabel = (query) => `Create “${query}”`,
  onCreate,
  size = "md",
}: SearchableSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [query, setQuery] = useState("");

  useDismissable(root, isOpen, () => {
    close();
    setQuery("");
  });

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [options, query]);

  const choose = (next: string) => {
    onChange(next);
    close();
    setQuery("");
  };

  // Dormant unless a future Master consumer opts in (see the prop docs above).
  const trimmedQuery = query.trim();
  const canCreate =
    allowCreate &&
    Boolean(onCreate) &&
    trimmedQuery !== "" &&
    !options.some(
      (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase(),
    );

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggle}
        className={cn(
          TRIGGER_CLASS,
          TRIGGER_HEIGHT[size],
          invalid ? "border-danger" : "border-hairline",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            !selected && "text-ink-subtle",
          )}
        >
          {loading ? "Loading…" : (selected?.label ?? placeholder)}
        </span>

        {clearable && selected && !disabled && (
          <IconX
            role="button"
            aria-label="Clear"
            stroke={2}
            className="size-4 shrink-0 text-ink-muted hover:text-ink"
            onClick={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
          />
        )}
        <IconChevronDown
          aria-hidden="true"
          stroke={1.75}
          className="size-4 shrink-0 text-ink-muted"
        />
      </button>

      {isOpen && (
        <div className={PANEL_CLASS}>
          {searchable && (
            <div className="border-b border-hairline p-2">
              <PanelSearch
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search options"
              />
            </div>
          )}

          <ul
            role="listbox"
            className="max-h-52 overflow-y-auto py-1 scrollbar-slim"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-ink-subtle">
                No results found
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.value === value}
                    disabled={option.disabled}
                    onClick={() => choose(option.value)}
                    // One rem per level on top of OPTION_CLASS's own px-4 (1rem). A
                    // measurement, not a palette value, so it stays inline rather than
                    // becoming a set of padding classes only this list would ever use.
                    style={
                      option.depth
                        ? { paddingLeft: `${1 + option.depth}rem` }
                        : undefined
                    }
                    className={cn(
                      OPTION_CLASS,
                      option.value === value && "bg-sidebar-active/40 text-ink",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onCreate?.(trimmedQuery);
                close();
                setQuery("");
              }}
              className="flex w-full items-center gap-2 border-t border-hairline px-4 py-2.5 text-left text-sm text-brand hover:bg-canvas"
            >
              <IconPlus
                aria-hidden="true"
                stroke={2}
                className="size-4 shrink-0"
              />
              <span className="truncate">{createLabel(trimmedQuery)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
