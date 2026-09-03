"use client";

import { useRef } from "react";
import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Input, type InputProps } from "@/components/ui/Input";
import {
  HIDE_NATIVE_SEARCH_CLEAR,
  SearchClearButton,
  clearSearchInput,
} from "./search-clear";

export type SearchInputProps = Omit<InputProps, "type">;

/**
 * A plain search box: leading magnifier, and a ✕ once it holds a term. Clearing runs the
 * caller's own `onChange` with an empty value, so every controlled caller resets exactly as it
 * would if the term were deleted by hand — no call site passes a clear handler of its own.
 */
export function SearchInput({ className, ref, ...props }: SearchInputProps) {
  const inner = useRef<HTMLInputElement>(null);
  const hasQuery = String(props.value ?? "").length > 0;

  return (
    <span className="relative block w-full">
      <IconSearch
        aria-hidden="true"
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 left-field-x size-4 -translate-y-1/2 text-ink-muted"
      />
      <Input
        ref={(node: HTMLInputElement | null) => {
          inner.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        className={cn(
          "pl-9",
          HIDE_NATIVE_SEARCH_CLEAR,
          hasQuery ? "pr-9" : undefined,
          className,
        )}
        {...props}
      />
      {hasQuery && (
        <SearchClearButton
          onClick={() => clearSearchInput(inner.current, props.onChange)}
        />
      )}
    </span>
  );
}
