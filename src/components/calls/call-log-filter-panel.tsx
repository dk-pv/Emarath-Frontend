"use client";

import { useId, useState } from "react";
import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Popover } from "@/components/ui/Popover";
import { Select } from "@/components/ui/Select";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { cn } from "@/lib/cn";
import type { SelectOption } from "@/types";
import type { CallOutcome, CallTimeMetric } from "@/services/calls-service";

/**
 * What the Recent Call Log's own Filter narrows, per the Workpex reference:
 * Call Status, Lead Status, Time Metric and a flagged-only toggle.
 *
 * Agent and the date bounds are deliberately not here — the dashboard's own
 * Filter already carries Select User and Date From/To for the whole page, and
 * the API still accepts both, so nothing was lost by matching the reference.
 */
export type CallLogFilterState = {
  outcome: CallOutcome | null;
  leadStatus: string | null;
  timeMetric: CallTimeMetric | null;
  flaggedOnly: boolean;
};

export const EMPTY_CALL_LOG_FILTERS: CallLogFilterState = {
  outcome: null,
  leadStatus: null,
  timeMetric: null,
  flaggedOnly: false,
};

/** The tabs and this dropdown are two views of one outcome, as the reference has both. */
const CALL_STATUS_OPTIONS: SelectOption[] = [
  { label: "Answered", value: "ANSWERED" },
  { label: "No answer", value: "NO_ANSWER" },
  { label: "Busy", value: "BUSY" },
];

const TIME_METRIC_OPTIONS: SelectOption[] = [
  { label: "Call Duration", value: "CALL_DURATION" },
  { label: "Call Timing", value: "CALL_TIMING" },
];

export function callLogFilterCount(value: CallLogFilterState): number {
  return (
    (value.outcome ? 1 : 0) +
    (value.leadStatus ? 1 : 0) +
    (value.timeMetric ? 1 : 0) +
    (value.flaggedOnly ? 1 : 0)
  );
}

/** Label on the left, control on the right — the reference's row, not a stacked field. */
function FilterRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <label
        htmlFor={htmlFor}
        className="w-28 shrink-0 text-sm font-medium text-ink"
      >
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * The Recent Call Log's Filter (CALL-06.1), built to the Workpex reference: a
 * popover of label/control rows that commits on its own Filter button rather
 * than on every keystroke, so a multi-field change is one refetch.
 *
 * The draft survives closing and reopening — only Clear all or an apply resets
 * it — which is what the reference's apply-button flow implies.
 */
export function CallLogFilterPanel({
  value,
  leadStatuses,
  onApply,
}: {
  value: CallLogFilterState;
  leadStatuses: readonly SelectOption[];
  onApply: (next: CallLogFilterState) => void;
}) {
  const [draft, setDraft] = useState(value);
  const ids = useId();
  const activeCount = callLogFilterCount(value);

  // The applied value is the source of truth: a Clear all elsewhere, or the tabs
  // changing the outcome, must show through here rather than leaving a stale
  // draft. Adjusted during render against the last applied value — an effect
  // would render the stale draft once before correcting it.
  const [lastApplied, setLastApplied] = useState(value);
  if (lastApplied !== value) {
    setLastApplied(value);
    setDraft(value);
  }

  const set = <K extends keyof CallLogFilterState>(
    key: K,
    next: CallLogFilterState[K],
  ) => setDraft((current) => ({ ...current, [key]: next }));

  return (
    <Popover
      align="end"
      // Fixed-positioned so the panel is placed against the viewport rather than
      // the trigger's box: right-aligned to a Filter button that has wrapped left
      // on a tablet, an absolute panel runs off the screen edge.
      portal
      // `group` lets the trigger's own `aria-expanded` drive the open state,
      // which is the only signal Popover exposes to a trigger node.
      triggerClassName="group rounded-control"
      trigger={
        <span
          className={cn(
            TOOLBAR_BUTTON_CLASS,
            "relative border border-transparent",
            // Open state, per the reference: a green wash inside a green outline.
            "group-aria-expanded:border-brand group-aria-expanded:bg-brand/15 group-aria-expanded:text-ink",
          )}
        >
          <IconFilter size={18} stroke={1.75} />
          Filter
          <IconChevronDown
            size={16}
            stroke={1.75}
            className="text-ink-muted transition-transform duration-(--duration-shell) ease-shell group-aria-expanded:rotate-180"
          />
          {activeCount > 0 && (
            <Badge tone="brand" aria-label={`${activeCount} active filters`}>
              {activeCount}
            </Badge>
          )}
        </span>
      }
    >
      {/* Below `lg` the toolbar wraps and the Filter button moves left, so a
          full-width panel right-aligned to it would run off the screen edge. */}
      <div className="w-[22rem] max-w-[calc(100vw-2rem)] p-5 lg:w-[34rem]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink">Call Log Filter</h3>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_CALL_LOG_FILTERS);
              onApply(EMPTY_CALL_LOG_FILTERS);
            }}
            className="focus-ring rounded-control text-sm text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
          >
            Clear all
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <FilterRow label="Call Status" htmlFor={`${ids}-outcome`}>
            <Select
              id={`${ids}-outcome`}
              placeholder="Select Status"
              options={CALL_STATUS_OPTIONS}
              value={draft.outcome ?? ""}
              onChange={(event) =>
                set(
                  "outcome",
                  (event.target.value || null) as CallOutcome | null,
                )
              }
            />
          </FilterRow>

          <FilterRow label="Lead Status" htmlFor={`${ids}-lead-status`}>
            <Select
              id={`${ids}-lead-status`}
              placeholder="Select Status"
              options={leadStatuses}
              value={draft.leadStatus ?? ""}
              onChange={(event) =>
                set("leadStatus", event.target.value || null)
              }
            />
          </FilterRow>

          <FilterRow label="Time Metric" htmlFor={`${ids}-time-metric`}>
            <Select
              id={`${ids}-time-metric`}
              placeholder="Select Time Metric"
              options={TIME_METRIC_OPTIONS}
              value={draft.timeMetric ?? ""}
              onChange={(event) =>
                set(
                  "timeMetric",
                  (event.target.value || null) as CallTimeMetric | null,
                )
              }
            />
          </FilterRow>

          <label className="flex items-center gap-3 text-sm text-ink">
            <Checkbox
              checked={draft.flaggedOnly}
              onChange={(event) => set("flaggedOnly", event.target.checked)}
            />
            Show flagged calls only
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={() => onApply(draft)}>
            Filter
          </Button>
        </div>
      </div>
    </Popover>
  );
}
