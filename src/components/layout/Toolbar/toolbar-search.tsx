"use client";

import { useRef, useState } from "react";
import { IconChevronDown, IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import type { SelectOption } from "@/types";

/** The bar's leading "search in" selector — the Leads list's Lead / Duplicate Lead. */
export type ToolbarSearchScope = {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
};

/**
 * Workpex's toolbar "Search" control: a compact button sitting in the toolbar
 * cluster (leads-list-default-scroll-left-…png) that expands into a search input
 * on click, and collapses back once it is emptied and loses focus. An active
 * query keeps it expanded so the term stays visible.
 *
 * With `scope` (Leads) the expanded control is Workpex's full search bar: a
 * canvas-tinted scope segment ("Lead ˅") that opens a small caret menu, the input
 * filling the toolbar row, and a ✕ that clears and collapses. With `clearable`
 * alone, an active query keeps the term inside a compact input with an inline
 * clear ✕. Without either (Activities, Kanban) the control keeps its plain
 * expand-on-click input, unchanged.
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder = "Search",
  clearable = false,
  scope,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Keep the term in the input with an inline clear ✕ (no chip row below). */
  clearable?: boolean;
  /** Renders the full search bar with this selector at its left. */
  scope?: ToolbarSearchScope;
}) {
  const [open, setOpen] = useState(false);
  const hasQuery = value.trim().length > 0;
  const expanded = open || hasQuery;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={TOOLBAR_BUTTON_CLASS}
      >
        <IconSearch size={18} stroke={1.75} />
        Search
      </button>
    );
  }

  // A bare re-render never blurs a focused input, so the list loading won't
  // close it mid-type. Escape on an empty query collapses back to the button.
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && value === "") setOpen(false);
  };
  const collapse = () => {
    onChange("");
    setOpen(false);
  };

  if (scope) {
    return (
      // Measured from the reference: the bar is the toolbar pills' height, fills the
      // row beside "New Lead" (everything after it wraps beneath), and is one bordered
      // surface — segment, divider, magnifier, input, ✕.
      <span className="flex h-control-sm min-w-0 flex-1 basis-[calc(100%-10rem)] items-center rounded-control border border-hairline bg-surface">
        <ScopeSelect scope={scope} />
        <IconSearch
          aria-hidden="true"
          stroke={1.75}
          className="ml-3 size-4 shrink-0 text-ink"
        />
        <input
          autoFocus
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-ink outline-none placeholder:text-ink-subtle"
        />
        <button
          type="button"
          aria-label="Close search"
          onClick={collapse}
          className="focus-ring-inset flex h-full w-9 shrink-0 items-center justify-center text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          <IconX size={16} stroke={1.75} aria-hidden="true" />
        </button>
      </span>
    );
  }

  // Leads keeps the term visible with an inline clear ✕; the ✕ only shows once
  // there is something to clear, so an empty expanded box stays uncluttered.
  const showClear = clearable && hasQuery;

  return (
    <span className="relative inline-flex h-control-sm w-56 items-center">
      <IconSearch
        aria-hidden="true"
        stroke={1.75}
        className="pointer-events-none absolute left-field-x size-4 text-ink-muted"
      />
      <input
        autoFocus
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "focus-ring h-control-sm w-full rounded-control border border-hairline bg-surface pl-8 text-sm text-ink",
          showClear ? "pr-8" : "pr-2",
        )}
      />
      {showClear && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={collapse}
          className="focus-ring absolute right-field-x flex size-4 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          <IconX size={14} stroke={2} />
        </button>
      )}
    </span>
  );
}

/**
 * The bar's scope segment and its menu (reference: a white, shadowed panel with an
 * up-caret under the segment; the current choice in bold). Owns its open state and
 * closes on pick, outside press or Escape.
 */
function ScopeSelect({ scope }: { scope: ToolbarSearchScope }) {
  const root = useRef<HTMLSpanElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);
  const current =
    scope.options.find((option) => option.value === scope.value)?.label ??
    scope.value;

  return (
    <span ref={root} className="relative flex h-full shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Search in: ${current}`}
        onClick={toggle}
        className="focus-ring-inset flex h-full items-center gap-2 rounded-l-[calc(var(--radius-control)-1px)] border-r border-hairline bg-canvas px-4 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-hairline/40"
      >
        {current}
        <IconChevronDown
          size={16}
          stroke={1.75}
          aria-hidden="true"
          className={cn(
            "text-ink-muted transition-transform duration-(--duration-shell) ease-shell",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          aria-label="Search in"
          // Reference: the panel sits 16px under the bar with its caret — a rotated
          // square tucked under the top edge — centred beneath the segment (88px wide
          // → 44px in); 16px rows on a 12px inset, the current choice in bold.
          className="absolute top-[calc(100%+16px)] left-0 z-50 min-w-40 rounded-surface bg-surface py-3 shadow-lg before:absolute before:-top-1.5 before:left-[38px] before:size-3 before:rotate-45 before:rounded-[2px] before:bg-surface before:content-['']"
        >
          {scope.options.map((option) => {
            const selected = option.value === scope.value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    scope.onChange(option.value);
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center px-5 py-2 text-left text-base whitespace-nowrap text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring-inset",
                    selected && "font-semibold",
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </span>
  );
}
