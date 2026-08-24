"use client";

import { useState } from "react";
import { IconSearch, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";

/**
 * Workpex's toolbar "Search" control: a compact button sitting in the toolbar
 * cluster (leads-list-default-scroll-left-…png) that expands into a search input
 * on click, and collapses back once it is emptied and loses focus. An active
 * query keeps it expanded so the term stays visible.
 *
 * With `clearable` (Leads), an active query keeps the term inside the input and
 * adds an inline clear ✕ — "[🔍 da ×]" — so the query reads back as itself in the
 * toolbar, with no separate chip row below it. ✕ clears and collapses. Without
 * `clearable` (Activities, Kanban) the control keeps its plain expand-on-click
 * input, unchanged.
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder = "Search",
  clearable = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Leads: keep the term in the input with an inline clear ✕ (no chip row below). */
  clearable?: boolean;
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
        // A bare re-render never blurs a focused input, so the list loading won't
        // close it mid-type. Escape on an empty query collapses back to the button.
        onKeyDown={(event) => {
          if (event.key === "Escape" && value === "") setOpen(false);
        }}
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
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          className="focus-ring absolute right-field-x flex size-4 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          <IconX size={14} stroke={2} />
        </button>
      )}
    </span>
  );
}
