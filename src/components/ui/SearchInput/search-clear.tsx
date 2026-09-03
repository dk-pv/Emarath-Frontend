"use client";

import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/**
 * `type="search"` makes WebKit draw its own clear glyph, which ignores our tokens and would
 * sit beside the one below. Every search box in the app hides it and renders `SearchClearButton`
 * instead, so the ✕ looks and behaves the same in every browser.
 */
export const HIDE_NATIVE_SEARCH_CLEAR =
  "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-cancel-button]:hidden";

/**
 * The ✕ every search box shows once there is something to clear — the toolbar's collapsible
 * Search, the plain `SearchInput`, the dropdown `PanelSearch`, Documents and Manage Columns all
 * render this one button, so the affordance is identical wherever a search appears.
 *
 * Positioned absolutely against the box's own `relative` wrapper.
 */
export function SearchClearButton({
  onClick,
  label = "Clear search",
  className,
}: {
  onClick: () => void;
  /** "Close search" where the ✕ also collapses the control back to its button. */
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "focus-ring absolute top-1/2 right-field-x flex size-4 -translate-y-1/2 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink",
        className,
      )}
    >
      <IconX size={14} stroke={2} aria-hidden="true" />
    </button>
  );
}

/**
 * Empties a controlled search box and runs the caller's own `onChange` with the emptied input,
 * so whatever it does alongside setting state — a page reset, a debounced refetch — still
 * happens. Every search handler in the app reads only `event.target.value`, so the emptied
 * input is all one needs; that keeps the ✕ entirely inside the shared search components, and no
 * call site has to pass (or can forget) a clear handler of its own.
 */
export function clearSearchInput(
  input: HTMLInputElement | null,
  onChange?: React.ChangeEventHandler<HTMLInputElement>,
): void {
  if (!input) return;
  input.value = "";
  onChange?.({
    target: input,
    currentTarget: input,
  } as React.ChangeEvent<HTMLInputElement>);
  input.focus();
}
