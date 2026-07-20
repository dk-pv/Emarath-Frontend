"use client";

import { useMemo, useRef, useState } from "react";
import { IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import type { SelectOption } from "@/types";

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
};

const TRIGGER_CLASS =
  "flex h-control-md w-full items-center gap-2 rounded-control border bg-surface px-field-x text-sm transition-colors duration-(--duration-shell) ease-shell focus-ring disabled:cursor-not-allowed disabled:opacity-50";

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
          invalid ? "border-danger" : "border-hairline",
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
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
              <span className="relative block">
                <IconSearch
                  aria-hidden="true"
                  stroke={1.75}
                  className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-ink-muted"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search"
                  aria-label="Search options"
                  className="h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink focus-ring"
                />
              </span>
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
        </div>
      )}
    </div>
  );
}
