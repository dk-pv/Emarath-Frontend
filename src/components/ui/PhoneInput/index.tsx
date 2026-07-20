"use client";

import { useMemo, useRef, useState } from "react";
import { IconChevronDown, IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO2,
  flagEmoji,
  type Country,
} from "@/constants/countries";

export type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  defaultCountry?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
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
  placeholder,
  invalid,
  disabled,
  id,
}: PhoneInputProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [query, setQuery] = useState("");
  const initial =
    COUNTRIES.find((country) => country.iso2 === defaultCountry) ??
    COUNTRIES[0];
  const [country, setCountry] = useState<Country>(initial);

  useDismissable(root, isOpen, () => {
    close();
    setQuery("");
  });

  // The local number is whatever remains of the stored value after the dial code.
  const dialDigits = country.dialCode.replace("+", "");
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
          "flex h-control-md w-full items-center rounded-control border bg-surface transition-colors duration-(--duration-shell) ease-shell focus-within:border-brand",
          invalid ? "border-danger" : "border-hairline",
          disabled && "opacity-50",
        )}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={`Country code ${country.dialCode}`}
          onClick={toggle}
          className="flex h-full shrink-0 items-center gap-1 rounded-l-control px-2 text-sm text-ink hover:bg-canvas focus-ring-inset"
        >
          <span aria-hidden="true">{flagEmoji(country.iso2)}</span>
          <span className="text-ink-muted">{country.dialCode}</span>
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
          onChange={(event) => emit(country, event.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 rounded-r-control bg-transparent px-3 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-64 w-72 overflow-hidden rounded-surface border border-hairline bg-surface shadow-lg">
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
                aria-label="Search country"
                className="h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink focus-ring"
              />
            </span>
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
                    aria-selected={option.iso2 === country.iso2}
                    onClick={() => {
                      setCountry(option);
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
