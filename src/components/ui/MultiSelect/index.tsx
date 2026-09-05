"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { cn } from "@/lib/cn";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chip } from "@/components/ui/Chip";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import type { SelectOption } from "@/types";

export type MultiSelectProps = {
  options: readonly SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** A type-ahead box in the panel — Workpex's Assigned and Tags dropdowns. */
  searchable?: boolean;
  /**
   * Inline-create extension point for the future Master modules (Tags, …).
   * Dormant by default: with `allowCreate` off — as on the current Assigned and
   * Tags fields — the component is unchanged. A future Master consumer flips
   * `allowCreate` and supplies `onCreate`. Not wired to any backend (LEAD-06.2 scope).
   */
  allowCreate?: boolean;
  createLabel?: (query: string) => string;
  onCreate?: (query: string) => void;
  /**
   * Caps the chips drawn in the control, the rest collapsing into a "+N" counter —
   * Workpex's filter row ("ADNAN S +12"), where the control must stay one line tall.
   * Unset (the default) keeps every chip visible, as the drawers and reports need.
   */
  maxVisibleChips?: number;
  /** Wires the control to a visible <label htmlFor>. */
  id?: string;
  /**
   * Accessible name for the trigger where the visible label is not wired to its id, or
   * where the control needs a name of its own — the same escape hatch `SearchableSelect`
   * offers. Falls back to the existing "Select options" behaviour when omitted.
   */
  "aria-label"?: string;
};

/** Chips sit inside the control, so the box grows rather than clipping the selection. */
const CONTROL_CLASS =
  "flex min-h-control-md w-full flex-wrap items-center gap-1 rounded-control border border-hairline bg-surface p-1 has-[:disabled]:opacity-50";

const OPENER_CLASS =
  "flex h-control-sm min-w-0 flex-1 items-center justify-between gap-2 rounded-control px-2 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring disabled:cursor-not-allowed disabled:hover:bg-surface";

const PANEL_CLASS =
  "absolute top-[calc(100%+8px)] left-0 z-50 max-h-64 w-full min-w-56 overflow-y-auto rounded-surface border border-hairline bg-surface py-1 shadow-lg scrollbar-slim";

const OPTION_CLASS =
  "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  searchable,
  allowCreate = false,
  createLabel = (query) => `Create “${query}”`,
  onCreate,
  maxVisibleChips,
  id,
  "aria-label": ariaLabel,
}: MultiSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const { isOpen, close, toggle } = useDisclosure();
  const [query, setQuery] = useState("");

  /** Escape hands focus back to the opener; an outside click must not steal it. */
  const dismiss = useCallback(() => {
    close();
    setQuery("");
    if (root.current?.contains(document.activeElement)) opener.current?.focus();
  }, [close]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!searchable || !term) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(term),
    );
  }, [options, query, searchable]);

  useDismissable(root, isOpen, dismiss);

  const toggleValue = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((current) => current !== optionValue)
        : [...value, optionValue],
    );
  };

  /** Roving focus across the enabled options only — a disabled box cannot take focus. */
  const focusStep = (from: HTMLElement, delta: number) => {
    const nodes = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        'input[type="checkbox"]:not(:disabled)',
      ) ?? [],
    );
    const next = nodes[nodes.indexOf(from) + delta];
    next?.focus();
  };

  const onOptionKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusStep(event.currentTarget, 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusStep(event.currentTarget, -1);
    }
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

  // Chips follow the option order so the trigger reads in the same order as the list.
  const selected = options.filter((option) => value.includes(option.value));
  const capped = maxVisibleChips !== undefined;
  const shown = capped ? selected.slice(0, maxVisibleChips) : selected;
  const overflow = selected.length - shown.length;
  const hasVisiblePlaceholder = value.length === 0 && placeholder !== undefined;

  return (
    <div ref={root} className={cn("relative", className)}>
      {/* Capped mode is a single-line control: the chips truncate rather than wrap, and
          the height is fixed rather than a minimum, so the box matches the plain selects
          beside it in Workpex's filter row instead of standing 2px taller. */}
      <div
        className={cn(
          CONTROL_CLASS,
          capped && "h-control-md min-h-0 flex-nowrap",
        )}
      >
        {shown.map((option) => (
          <Chip
            key={option.value}
            className={capped ? "min-w-0" : undefined}
            onRemove={disabled ? undefined : () => toggleValue(option.value)}
            removeLabel={`Remove ${option.label}`}
          >
            {option.label}
          </Chip>
        ))}
        {overflow > 0 && (
          <span
            className="shrink-0 text-sm text-ink-muted"
            aria-label={`${overflow} more selected`}
          >
            +{overflow}
          </span>
        )}

        <button
          id={id}
          ref={opener}
          type="button"
          disabled={disabled}
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          aria-label={
            ariaLabel ?? (hasVisiblePlaceholder ? undefined : "Select options")
          }
          onClick={toggle}
          className={OPENER_CLASS}
        >
          {hasVisiblePlaceholder && (
            <span className="truncate text-ink-subtle">{placeholder}</span>
          )}
          <IconChevronDown
            aria-hidden="true"
            stroke={1.75}
            className="ml-auto size-4 shrink-0 text-ink-muted"
          />
        </button>
      </div>

      {isOpen && (
        <div id={panelId} className={PANEL_CLASS}>
          {searchable && (
            <div className="sticky top-0 border-b border-hairline bg-surface p-2">
              <PanelSearch
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search options"
              />
            </div>
          )}

          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-subtle">
              No results found
            </p>
          ) : (
            visible.map((option) => (
              <label key={option.value} className={OPTION_CLASS}>
                <Checkbox
                  checked={value.includes(option.value)}
                  disabled={option.disabled}
                  onChange={() => toggleValue(option.value)}
                  onKeyDown={onOptionKeyDown}
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))
          )}

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                onCreate?.(trimmedQuery);
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
