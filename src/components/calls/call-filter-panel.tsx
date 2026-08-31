"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconFilter } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { CallRange } from "@/services/calls-service";

/**
 * The Filters popup's quick presets, in the reference's order
 * (calldashboard filter popup): All, Today, Yesterday, This Week, This Month.
 */
export type PeriodId =
  "all" | "today" | "yesterday" | "this-week" | "this-month";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This Week" },
  { id: "this-month", label: "This Month" },
];

/** Everything the one Filter drives: the whole dashboard reads this. */
export type CallFilterState = {
  period: PeriodId;
  /** "Select User" — a user id, or null for everyone in scope. */
  agentId: string | null;
  /** Custom Date From/To; either bound overrides that side of the preset. */
  dateFrom: Date | null;
  dateTo: Date | null;
};

export const DEFAULT_CALL_FILTERS: CallFilterState = {
  period: "today",
  agentId: null,
  dateFrom: null,
  dateTo: null,
};

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * "All" is not unbounded: the API caps an aggregation window at 366 days, so All
 * means the last year — which is also every call this system currently holds.
 */
const ALL_DAYS = 365;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** How many legs beyond the default period are active — the Filter/N badge. */
export function callFilterCount(state: CallFilterState): number {
  let count = 0;
  if (state.period !== DEFAULT_CALL_FILTERS.period) count += 1;
  if (state.agentId) count += 1;
  if (state.dateFrom || state.dateTo) count += 1;
  return count;
}

/**
 * The filter state as the half-open window plus agent the API takes. Dates are
 * resolved in the user's own timezone so "Today" is their day, not the server's;
 * a picked "To" day is inclusive, so it sends the following midnight.
 */
export function resolveCallRange(state: CallFilterState): CallRange {
  const todayStart = startOfDay(new Date());
  const tomorrow = new Date(todayStart.getTime() + DAY_MS);

  let from = todayStart;
  let to = tomorrow;
  if (state.period === "all") {
    from = new Date(todayStart.getTime() - ALL_DAYS * DAY_MS);
  } else if (state.period === "yesterday") {
    from = new Date(todayStart.getTime() - DAY_MS);
    to = todayStart;
  } else if (state.period === "this-week") {
    from = new Date(todayStart);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); // Monday-first
  } else if (state.period === "this-month") {
    from = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  }

  if (state.dateFrom) from = startOfDay(state.dateFrom);
  if (state.dateTo) to = new Date(startOfDay(state.dateTo).getTime() + DAY_MS);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    agentId: state.agentId,
  };
}

/** The label beside "Summary |" — the active preset, or the custom range. */
export function periodLabel(state: CallFilterState): string {
  if (state.dateFrom || state.dateTo) return "Custom";
  return PERIODS.find((p) => p.id === state.period)?.label ?? "Today";
}

/**
 * A preset row: the checkbox glyph exactly as the reference draws it, but with
 * radio semantics, because picking one clears the others. Rendering a real
 * checkbox group would tell assistive tech the boxes combine, which they do not.
 */
function PresetRow({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="focus-ring inline-flex items-center gap-2 rounded-control px-1 py-1 text-sm text-ink"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-check border transition-colors duration-(--duration-shell) ease-shell",
          checked
            ? "border-brand bg-brand text-white"
            : "border-hairline bg-surface",
        )}
      >
        {checked && <IconCheck size={14} stroke={3} />}
      </span>
      {label}
    </button>
  );
}

/**
 * The draft lives in its own component so it is re-seeded by mounting whenever
 * the popup opens. Syncing it in an effect instead would both render twice and
 * trip the React Compiler's set-state-in-effect rule.
 */
function FilterDraft({
  applied,
  agents,
  onApply,
  onClear,
  close,
}: {
  applied: CallFilterState;
  agents: { id: string; name: string }[];
  onApply: (next: CallFilterState) => void;
  onClear: () => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState<CallFilterState>(applied);
  const set = <K extends keyof CallFilterState>(
    key: K,
    value: CallFilterState[K],
  ) => setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-3">
        <h3 className="text-base font-semibold text-ink">Filters</h3>
        <button
          type="button"
          onClick={() => {
            onClear();
            close();
          }}
          className="focus-ring rounded-control text-sm text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          Clear all
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="Period"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-hairline px-4 pb-4"
      >
        {PERIODS.map((period) => (
          <PresetRow
            key={period.id}
            label={period.label}
            checked={draft.period === period.id}
            onSelect={() => {
              // A preset and a custom range are alternatives, not layers: picking
              // a preset drops the custom dates, as the reference behaves.
              setDraft((prev) => ({
                ...prev,
                period: period.id,
                dateFrom: null,
                dateTo: null,
              }));
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        <div className="flex items-center gap-4">
          <label
            htmlFor="call-filter-user"
            className="w-24 shrink-0 text-sm text-ink"
          >
            Select User
          </label>
          <Select
            id="call-filter-user"
            className="flex-1"
            placeholder="Assigned To"
            value={draft.agentId ?? ""}
            options={agents.map((agent) => ({
              label: agent.name,
              value: agent.id,
            }))}
            onChange={(event) => set("agentId", event.target.value || null)}
          />
        </div>

        <div className="flex items-start gap-4">
          <span className="w-24 shrink-0 pt-2 text-sm text-ink">Date</span>
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePicker
              numeric
              placeholder="From"
              value={draft.dateFrom}
              onChange={(date) => set("dateFrom", date)}
            />
            <DatePicker
              numeric
              placeholder="To"
              value={draft.dateTo}
              onChange={(date) => set("dateTo", date)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end px-4 pb-4">
        <Button
          size="sm"
          onClick={() => {
            onApply(draft);
            close();
          }}
        >
          Filter
        </Button>
      </div>
    </div>
  );
}

/**
 * The Call Dashboard's one Filter — the green button and the Filters popup from
 * the Workpex reference. What it applies drives every section of the page (KPIs,
 * leaderboard, the three analytics panels and the Recent Call Log), which is why
 * the state lives in the dashboard root and this component only edits a draft.
 *
 * The agent list reuses the same assignable-agents lookup the follow-up and lead
 * forms use; if that call fails the dropdown is simply empty and every other leg
 * still works.
 */
export function CallFilterPanel({
  value,
  onChange,
}: {
  value: CallFilterState;
  onChange: (next: CallFilterState) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const count = callFilterCount(value);

  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then(setAgents)
      .catch(() => {
        /* an unavailable roster must not disable the rest of the filter */
      });
    return () => controller.abort();
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={toggle}
        className="focus-ring inline-flex h-control-sm items-center gap-2 rounded-control bg-brand px-3 text-sm font-medium text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong"
      >
        <IconFilter size={16} stroke={1.75} aria-hidden="true" />
        Filter
        {count > 0 && <span className="tabular-nums">/{count}</span>}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Filters"
          className="absolute top-[calc(100%+8px)] right-0 z-50 w-[min(34rem,calc(100vw-2rem))] rounded-surface border border-hairline bg-surface shadow-lg"
        >
          <FilterDraft
            applied={value}
            agents={agents}
            onApply={onChange}
            onClear={() => onChange(DEFAULT_CALL_FILTERS)}
            close={close}
          />
        </div>
      )}
    </div>
  );
}
