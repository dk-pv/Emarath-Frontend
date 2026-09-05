"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown, IconPlus, IconX } from "@tabler/icons-react";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { useMounted } from "@/components/ui/Modal";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";
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
  /**
   * Renders the panel fixed in `<body>` instead of absolutely inside the trigger's box, so
   * an ancestor that scrolls or hides its overflow can no longer crop it — the same escape
   * hatch `Popover` and `Tooltip` offer, using the same anchoring hook.
   */
  portal?: boolean;
  /** Accessible name for the trigger where no visible <label> is wired to its id. */
  "aria-label"?: string;
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

const PORTAL_PANEL_CLASS =
  "fixed z-50 max-h-64 min-w-56 overflow-hidden rounded-surface border border-hairline bg-surface shadow-lg";

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
  portal = false,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [query, setQuery] = useState("");
  const mounted = useMounted();
  const [anchor, setAnchor] = useState<React.CSSProperties | null>(null);

  // Stable: the anchoring hook memoises on its callbacks, so a fresh closure each render
  // would re-run its effect on every render that effect itself causes. `close` and the
  // state setter are both stable, so this is too.
  const dismiss = useCallback(() => {
    close();
    setQuery("");
  }, [close]);

  // A portalled panel lives in <body>, so it must count as "inside" for dismissal.
  useDismissable([root, panelRef], isOpen, dismiss);
  // A fixed panel would drift away from a scrolling trigger, so it re-anchors on open and
  // detaches if the trigger scrolls out of view.
  // Stable for the same reason as `dismiss`.
  const position = useCallback((style: React.CSSProperties) => {
    // The panel matches its trigger's width, as an inline one does via `w-full`; the hook
    // supplies placement and clamping, not the trigger's own measurements.
    setAnchor({
      ...style,
      width: triggerRef.current?.getBoundingClientRect().width,
    });
  }, []);

  useAnchoredPosition({
    enabled: portal && isOpen,
    triggerRef,
    align: "start",
    onPosition: position,
    onDetach: dismiss,
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

  /** Inline by default; portalled only once anchored, so it never flashes at 0,0. */
  const renderPanel = (panel: React.ReactElement) => {
    if (!portal) return panel;
    if (!mounted || anchor === null) return null;
    return createPortal(panel, document.body);
  };

  return (
    <div ref={root} className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
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

      {isOpen &&
        renderPanel(
          <div
            ref={panelRef}
            className={portal ? PORTAL_PANEL_CLASS : PANEL_CLASS}
            style={portal ? (anchor ?? undefined) : undefined}
          >
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
          </div>,
        )}
    </div>
  );
}
