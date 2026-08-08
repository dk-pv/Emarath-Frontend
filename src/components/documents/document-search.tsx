"use client";

import { IconSearch } from "@tabler/icons-react";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";

type DocumentSearchProps = {
  /** Whether the control is expanded into its input (the parent owns this so it can hide the
   * sibling toolbar controls while search is active, as the Workpex reference does). */
  expanded: boolean;
  value: string;
  onChange: (value: string) => void;
  /** Open the input (from the collapsed pill). */
  onExpand: () => void;
  /** Collapse back to the pill — only reached from an empty input. */
  onCollapse: () => void;
};

/**
 * The Documents "Search" control (DOC-07.1), from `documents-overview.mp4`: a borderless
 * "Search" pill that, on click, expands into a wide inline input ("Search here…") which takes
 * over the toolbar — the reference hides All Documents and Add Document while search is active,
 * so the parent renders only this control when `expanded`. It collapses back on Escape from an
 * empty input (the same guard ToolbarSearch uses — a list re-render must not steal focus and
 * close it); an active query keeps it expanded so the term stays visible.
 */
export function DocumentSearch({
  expanded,
  value,
  onChange,
  onExpand,
  onCollapse,
}: DocumentSearchProps) {
  if (!expanded) {
    return (
      <button type="button" onClick={onExpand} className={TOOLBAR_BUTTON_CLASS}>
        <IconSearch size={18} stroke={1.75} />
        Search
      </button>
    );
  }

  return (
    <span className="relative inline-flex h-control-sm w-96 max-w-full items-center">
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
        onKeyDown={(event) => {
          if (event.key === "Escape" && value === "") onCollapse();
        }}
        placeholder="Search here..."
        aria-label="Search here..."
        className="focus-ring h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink"
      />
    </span>
  );
}
