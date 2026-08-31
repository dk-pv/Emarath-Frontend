"use client";

import { useState } from "react";
import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Popover } from "@/components/ui/Popover";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
// The same three options the create/edit follow-up forms use; "All Activities" is
// simply the unset state, so the dropdown needs no option of its own for it.
import { TYPE_OPTIONS } from "@/components/activities/activity-form-parts";
import { cn } from "@/lib/cn";
import type {
  ActivityDateWindow,
  ActivityType,
} from "@/services/activities-service";
import type { SelectOption } from "@/types";

/**
 * The popup's checkbox grid, in the reference's reading order: the four single-day
 * windows on the first two rows, the two wider ones beneath.
 */
const WINDOW_LABEL: Record<ActivityDateWindow, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  yesterday: "Yesterday",
  thisWeek: "This Week",
  thisMonth: "This Month",
};

const DAY_WINDOWS: ActivityDateWindow[] = [
  "overdue",
  "today",
  "tomorrow",
  "yesterday",
];
const SPAN_WINDOWS: ActivityDateWindow[] = ["thisWeek", "thisMonth"];

export interface ActivityFilterState {
  windows: readonly ActivityDateWindow[];
  from: Date | null;
  to: Date | null;
  type: ActivityType | null;
  assignedAgent: string | null;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilterState = {
  windows: [],
  from: null,
  to: null,
  type: null,
  assignedAgent: null,
};

/** How many of the popup's controls are set — the toolbar's `Filter/2` count. */
export function activeFilterCount(state: ActivityFilterState): number {
  return (
    state.windows.length +
    (state.from ? 1 : 0) +
    (state.to ? 1 : 0) +
    (state.type ? 1 : 0) +
    (state.assignedAgent ? 1 : 0)
  );
}

type ActivityFilterPanelProps = {
  /** The filters currently driving the list. */
  value: ActivityFilterState;
  /** Applied only when Filter (or Clear all) is pressed — never on each keystroke. */
  onApply: (next: ActivityFilterState) => void;
  agents: readonly SelectOption[];
};

/**
 * The Workpex Activities filter popup: a grid of quick-date checkboxes, a From/To
 * range, the follow-up-type and assignee dropdowns, `Clear all`, and a `Filter`
 * button that commits.
 *
 * Deliberately not the shared `FilterPanel` — that renders one labelled control per
 * field, which cannot express this layout (a checkbox grid, a paired date range and
 * a commit button). It is built from the same design-system primitives the shared
 * panel uses, so nothing new is introduced visually.
 *
 * The popup edits a *draft*: typing in it changes nothing until Filter is pressed,
 * matching the reference's explicit commit. The draft resyncs from `value` whenever
 * the applied filters change, so reopening never shows a stale edit.
 */
export function ActivityFilterPanel({
  value,
  onApply,
  agents,
}: ActivityFilterPanelProps) {
  const count = activeFilterCount(value);

  return (
    <Popover
      align="end"
      portal
      triggerClassName="rounded-control"
      trigger={
        <span className={cn(TOOLBAR_BUTTON_CLASS, "relative")}>
          <IconFilter size={18} stroke={1.75} />
          Filter
          {count > 0 && <span className="text-ink-muted">/{count}</span>}
          <IconChevronDown size={16} stroke={1.75} className="text-ink-muted" />
        </span>
      }
    >
      {(close) => (
        <FilterDraft
          applied={value}
          agents={agents}
          onApply={onApply}
          close={close}
        />
      )}
    </Popover>
  );
}

/**
 * The popup's body and its draft.
 *
 * Lives in its own component because `Popover` mounts its children only while open:
 * every open starts a fresh draft seeded from the applied filters, so a cancelled
 * edit is discarded and no effect is needed to resynchronise.
 */
function FilterDraft({
  applied,
  agents,
  onApply,
  close,
}: {
  applied: ActivityFilterState;
  agents: readonly SelectOption[];
  onApply: (next: ActivityFilterState) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState<ActivityFilterState>(applied);

  const toggleWindow = (window: ActivityDateWindow) =>
    setDraft((prev) => ({
      ...prev,
      windows: prev.windows.includes(window)
        ? prev.windows.filter((w) => w !== window)
        : [...prev.windows, window],
    }));

  const checkbox = (window: ActivityDateWindow) => (
    <label
      key={window}
      className="flex cursor-pointer items-center gap-2 text-sm text-ink"
    >
      <Checkbox
        checked={draft.windows.includes(window)}
        onChange={() => toggleWindow(window)}
      />
      {WINDOW_LABEL[window]}
    </label>
  );

  return (
    <div className="w-[34rem] max-w-[calc(100vw-2rem)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Filters</h2>
        <button
          type="button"
          onClick={() => {
            onApply(EMPTY_ACTIVITY_FILTERS);
            close();
          }}
          className="focus-ring rounded-control px-1 text-sm text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          Clear all
        </button>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-x-4 gap-y-3">
        {DAY_WINDOWS.map(checkbox)}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-x-4 gap-y-3">
        {SPAN_WINDOWS.map(checkbox)}
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5">
        <div className="grid grid-cols-[6rem_1fr] items-center gap-4">
          <span className="text-sm font-medium text-ink">Date</span>
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              numeric
              value={draft.from}
              onChange={(from) => setDraft((prev) => ({ ...prev, from }))}
              placeholder="From"
            />
            <DatePicker
              numeric
              value={draft.to}
              onChange={(to) => setDraft((prev) => ({ ...prev, to }))}
              placeholder="To"
            />
          </div>
        </div>

        <div className="grid grid-cols-[6rem_1fr] items-center gap-4">
          <span className="text-sm font-medium text-ink">Activities</span>
          <SearchableSelect
            searchable={false}
            clearable
            options={TYPE_OPTIONS}
            value={draft.type}
            onChange={(type) =>
              setDraft((prev) => ({
                ...prev,
                type: (type as ActivityType | null) ?? null,
              }))
            }
            placeholder="All Activities"
          />
        </div>

        <div className="grid grid-cols-[6rem_1fr] items-center gap-4">
          <span className="text-sm font-medium text-ink">Assigned To</span>
          <SearchableSelect
            clearable
            options={agents}
            value={draft.assignedAgent}
            onChange={(assignedAgent) =>
              setDraft((prev) => ({ ...prev, assignedAgent }))
            }
            placeholder="Assigned To"
          />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button
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
