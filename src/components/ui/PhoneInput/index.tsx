"use client";

import { useMemo, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { cn } from "@/lib/cn";
import type { Size } from "@/types";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO2,
  flagEmoji,
  type Country,
} from "@/constants/countries";

/** Matches the shared Input scale, so a phone field lines up with the boxes beside it. */
const CONTROL_HEIGHT: Record<Size, string> = {
  sm: "h-control-sm",
  md: "h-control-md",
  lg: "h-control-lg",
};

export type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  /**
   * ISO2 of the dialling country, for a caller that persists the country alongside
   * the number. Left out, the selection stays internal and `defaultCountry` seeds it.
   */
  country?: string;
  onCountryChange?: (iso2: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  /** Control height on the shared scale; the drawers use the default. */
  size?: Size;
};

/**
 * International phone entry (LEAD-06.2): a searchable country/dial-code selector
 * and a number field, matching the Workpex drawer. The two combine into one
 * stored string — dial digits followed by the local number, no "+", the format
 * the Leads list already holds (e.g. "971542327276").
 */
export function PhoneInput({
  value,
  onChange,
  defaultCountry = DEFAULT_COUNTRY_ISO2,
  country,
  onCountryChange,
  placeholder,
  invalid,
  disabled,
  id,
  size = "md",
}: PhoneInputProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [query, setQuery] = useState("");
  const initial =
    COUNTRIES.find((option) => option.iso2 === defaultCountry) ??
    COUNTRIES[0];
  const [picked, setPicked] = useState<Country>(initial);
  // The prop wins when given, so a stored country survives a reload; otherwise the
  // selection is this component's own, exactly as it was.
  const selected = COUNTRIES.find((option) => option.iso2 === country) ?? picked;

  const choose = (next: Country) => {
    setPicked(next);
    onCountryChange?.(next.iso2);
  };

  useDismissable(root, isOpen, () => {
    close();
    setQuery("");
  });

  // The local number is whatever remains of the stored value after the dial code.
  const dialDigits = selected.dialCode.replace("+", "");
  const localNumber = value.startsWith(dialDigits)
    ? value.slice(dialDigits.length)
    : value;

  const emit = (nextCountry: Country, nextNumber: string) => {
    const digits = nextNumber.replace(/\D/g, "");
    // Empty when no number is entered, so a required phone fails validation even
    // though a dial code is always selected.
    onChange(digits ? `${nextCountry.dialCode.replace("+", "")}${digits}` : "");
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (option) =>
        option.name.toLowerCase().includes(term) ||
        option.dialCode.includes(term),
    );
  }, [query]);

  return (
    <div ref={root} className="relative">
      <div
        className={cn(
          "flex w-full items-center rounded-control border bg-surface transition-colors duration-(--duration-shell) ease-shell focus-within:border-brand",
          CONTROL_HEIGHT[size],
          invalid ? "border-danger" : "border-hairline",
          disabled && "opacity-50",
        )}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Country code ${selected.dialCode}`}
          onClick={toggle}
          className="flex h-full shrink-0 items-center gap-1 rounded-l-control px-2 text-sm text-ink hover:bg-canvas focus-ring-inset"
        >
          <span aria-hidden="true">{flagEmoji(selected.iso2)}</span>
          <span className="text-ink-muted">{selected.dialCode}</span>
          <IconChevronDown
            aria-hidden="true"
            stroke={1.75}
            className="size-3.5 text-ink-muted"
          />
        </button>

        <span className="h-5 w-px shrink-0 bg-hairline" />

        <input
          id={id}
          type="tel"
          inputMode="tel"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          value={localNumber}
          onChange={(event) => emit(selected, event.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 rounded-r-control bg-transparent px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>

      {/*
        `max-w-full` keeps the panel inside its own field: 18rem anchored to the field's
        left edge runs off the screen wherever the field is narrower than that — a phone
        field in a two-column form at 1024px, or the whole form at 390px — and an absolute
        panel has no way to shift back. Bounded to the field it can only ever be as wide
        as its anchor, which no viewport can crop.
      */}
      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-64 w-72 max-w-full overflow-hidden rounded-surface border border-hairline bg-surface shadow-lg">
          <div className="border-b border-hairline p-2">
            <PanelSearch
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search country"
            />
          </div>
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
                <li key={option.iso2}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.iso2 === selected.iso2}
                    onClick={() => {
                      choose(option);
                      emit(option, localNumber);
                      close();
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
                  >
                    <span aria-hidden="true">{flagEmoji(option.iso2)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {option.name}
                    </span>
                    <span className="shrink-0 text-ink-muted">
                      {option.dialCode}
                    </span>
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
