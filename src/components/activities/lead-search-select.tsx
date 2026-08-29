"use client";

import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/cn";
import { useDismissable } from "@/hooks/use-dismissable";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { fetchLeads, type LeadListItem } from "@/services/leads-service";

/** One page of matches is all the panel shows; the query narrows instead of paging. */
const RESULT_LIMIT = 10;

const PANEL_CLASS =
  "absolute top-[calc(100%+6px)] left-0 z-50 max-h-60 w-full overflow-y-auto rounded-surface border border-hairline bg-surface py-1 shadow-lg scrollbar-slim";

const OPTION_CLASS =
  "flex w-full cursor-pointer flex-col items-start px-4 py-2 text-left transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas";

/** The chosen-lead box, matching the read-only Lead field the drawer shows on a lead. */
const SELECTED_CLASS =
  "flex h-control-md items-center gap-2 rounded-control border bg-canvas px-3 text-sm text-ink";

export type LeadSearchSelectProps = {
  value: LeadListItem | null;
  onChange: (lead: LeadListItem | null) => void;
  invalid?: boolean;
  id?: string;
};

/**
 * The Add Follow-up drawer's **"Search Leads"** field (ACT-03.2), as Workpex renders
 * it when the drawer is opened from the Activities page rather than from a lead:
 * a magnifier search box in place of the fixed Lead value.
 *
 * Searches server-side through the existing `fetchLeads` — the same scoped,
 * paginated endpoint the Leads list and the Kanban board use, so a user can only
 * ever pick a lead they may see, and 15,000+ rows are never pulled into the browser.
 *
 * The expanded/results state of this field was never captured in `ui-reference/`
 * (see `project-docs/ui-audit/activities.md` §10), so the panel follows the house
 * dropdown idiom (`SearchableSelect`) rather than inventing a new one.
 */
export function LeadSearchSelect({
  value,
  onChange,
  invalid,
  id,
}: LeadSearchSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const term = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

  // Results carry the term they answered, so "loading" is derived rather than a
  // second state the effect has to set synchronously.
  const [results, setResults] = useState<{
    term: string;
    rows: readonly LeadListItem[];
  }>({ term: "", rows: [] });

  useDismissable(root, query !== "", () => setQuery(""));

  useEffect(() => {
    if (term === "") return;
    const controller = new AbortController();
    let cancelled = false;
    fetchLeads({ page: 1, size: RESULT_LIMIT, search: term }, controller.signal)
      .then((result) => {
        if (!cancelled) setResults({ term, rows: result.rows });
      })
      .catch(() => {
        // A failed lookup shows "No leads found" rather than breaking the form.
        if (!cancelled) setResults({ term, rows: [] });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [term]);

  if (value) {
    return (
      <div
        className={cn(
          SELECTED_CLASS,
          invalid ? "border-danger" : "border-hairline",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{value.name}</span>
        <button
          type="button"
          aria-label="Clear lead"
          onClick={() => onChange(null)}
          className="focus-ring shrink-0 rounded-control text-ink-muted hover:text-ink"
        >
          <IconX size={16} stroke={2} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const searching = term !== "" && results.term !== term;
  const open = query.trim() !== "";

  return (
    <div ref={root} className="relative">
      <SearchInput
        id={id}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search Leads"
        aria-label="Search Leads"
        aria-invalid={invalid || undefined}
      />

      {open && (
        <ul role="listbox" aria-label="Lead results" className={PANEL_CLASS}>
          {searching ? (
            <li className="px-4 py-6 text-center text-sm text-ink-subtle">
              Searching…
            </li>
          ) : results.rows.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-ink-subtle">
              No leads found
            </li>
          ) : (
            results.rows.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    onChange(lead);
                    setQuery("");
                  }}
                  className={OPTION_CLASS}
                >
                  <span className="w-full truncate text-sm text-ink">
                    {lead.name}
                  </span>
                  <span className="w-full truncate text-xs text-ink-muted">
                    {lead.primaryPhone}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
