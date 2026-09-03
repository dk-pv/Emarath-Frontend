"use client";

import { useRef } from "react";
import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import {
  HIDE_NATIVE_SEARCH_CLEAR,
  SearchClearButton,
  clearSearchInput,
} from "@/components/ui/SearchInput/search-clear";

const INPUT_CLASS =
  "focus-ring h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink";

export type PanelSearchProps = Omit<
  React.ComponentProps<"input">,
  "type" | "size"
> & {
  /** Names the box for assistive tech, e.g. "Search tags". */
  "aria-label": string;
};

/**
 * The search box inside a dropdown panel — MultiSelect, SearchableSelect, PhoneInput and
 * the Tags picker all filter their options through this one control. It carries the same ✕
 * as every other search in the app once it holds a term, so a filtered option list can be
 * reset without deleting the text by hand.
 */
export function PanelSearch({ className, ref, ...props }: PanelSearchProps) {
  const inner = useRef<HTMLInputElement>(null);
  const hasQuery = String(props.value ?? "").length > 0;

  return (
    <span className="relative block">
      <IconSearch
        aria-hidden="true"
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={(node: HTMLInputElement | null) => {
          inner.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        type="search"
        placeholder="Search"
        className={cn(
          INPUT_CLASS,
          HIDE_NATIVE_SEARCH_CLEAR,
          hasQuery && "pr-8",
          className,
        )}
        {...props}
      />
      {hasQuery && (
        <SearchClearButton
          onClick={() => clearSearchInput(inner.current, props.onChange)}
          className="right-2"
        />
      )}
    </span>
  );
}
