"use client";

import { useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";

/**
 * Workpex's toolbar "Search" control: a compact button sitting in the toolbar
 * cluster (leads-list-default-scroll-left-…png) that expands into a search input
 * on click, and collapses back once it is emptied and loses focus. An active
 * query keeps it expanded so the term stays visible.
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const expanded = open || value.length > 0;

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
        // Collapse back to the button only on Escape when the query is empty, so a
        // re-render (e.g. the list loading) never steals focus and closes it.
        onKeyDown={(event) => {
          if (event.key === "Escape" && value === "") setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="focus-ring h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink"
      />
    </span>
  );
}
