"use client";

import { useRef } from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

/** The page sizes the Lead Detail sections offer, smallest first. */
export const ROWS_PER_PAGE_OPTIONS = [3, 5, 10] as const;

/** The reference prints the size zero-padded — "03", not "3". */
export function padPageSize(value: number): string {
  return String(value).padStart(2, "0");
}

export type RowsPerPageProps = {
  value: number;
  onChange: (value: number) => void;
  options?: readonly number[];
  /** Names the control for assistive tech, e.g. "Rows per page, Notes". */
  "aria-label"?: string;
};

/**
 * The "Rows per page" control the Lead Detail sections carry, matched to the reference:
 * a bordered pill that opens its options *upward* in a bubble with a downward tail, the
 * current size filled brand-green. The trigger turns green while open, matching the
 * reference's open state, and sits on the hairline border when closed.
 *
 * Opening upward is the point of the component: these controls sit at the bottom of a
 * section, where a downward panel would be pushed off the section (and, at the foot of
 * the page, off the viewport).
 */
export function RowsPerPage({
  value,
  onChange,
  options = ROWS_PER_PAGE_OPTIONS,
  "aria-label": ariaLabel = "Rows per page",
}: RowsPerPageProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();

  useDismissable(root, isOpen, close);

  const Chevron = isOpen ? IconChevronUp : IconChevronDown;

  return (
    <div ref={root} className="flex items-center gap-3">
      <span className="text-sm whitespace-nowrap text-ink-muted">
        Rows per page
      </span>

      <div className="relative">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onClick={toggle}
          className={cn(
            "focus-ring flex h-control items-center gap-2 rounded-control border bg-surface px-3 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell",
            isOpen ? "border-brand" : "border-hairline hover:border-brand/60",
          )}
        >
          {padPageSize(value)}
          <Chevron
            size={16}
            stroke={2}
            className="text-brand-strong"
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-label={ariaLabel}
            // Opens upward: `bottom-full` puts the panel above the trigger, and the
            // 10px gap leaves room for the tail that points back down at it.
            className="absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-24 -translate-x-1/2 rounded-surface border border-brand bg-surface p-1.5 shadow-lg"
          >
            {options.map((option) => {
              const selected = option === value;
              return (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option);
                    close();
                  }}
                  className={cn(
                    "focus-ring-inset flex w-full items-center justify-center rounded-control py-2 text-sm transition-colors duration-(--duration-shell) ease-shell",
                    selected
                      ? "bg-brand font-medium text-white"
                      : "text-ink hover:bg-canvas",
                  )}
                >
                  {padPageSize(option)}
                </button>
              );
            })}

            {/* The bubble's tail — a rotated square showing only its two outer edges,
                so it reads as one shape with the panel above it. */}
            <span
              aria-hidden="true"
              className="absolute top-full left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-r border-b border-brand bg-surface"
            />
          </div>
        )}
      </div>
    </div>
  );
}
