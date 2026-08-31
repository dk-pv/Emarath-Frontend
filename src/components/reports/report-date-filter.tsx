"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Radio } from "@/components/ui/Radio";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { cn } from "@/lib/cn";
import {
  DATE_FIELD_OPTIONS,
  DATE_PERIODS,
  dateKey,
  parseDateKey,
  type DatePeriodKey,
  type LeadsByStatusDateField,
} from "@/services/leads-by-status-report-service";

export type DateFilterValue = {
  field: LeadsByStatusDateField;
  period: DatePeriodKey | null;
  /** The Custom range as calendar dates (YYYY-MM-DD), end inclusive. */
  from?: string;
  to?: string;
};

type ReportDateFilterProps = {
  /** What is applied — seeds the draft each time the panel opens. */
  value: DateFilterValue;
  onApply: (value: DateFilterValue) => void;
  onClear: () => void;
};

/**
 * Measured from the Workpex reference: the panel is ~590px wide with 24px padding,
 * centred on the "By Date" chip; narrower viewports clamp inside the content column.
 */
const MAX_PANEL = 590;

const CLEARED: DateFilterValue = { field: "created", period: null };

/** 20px control, 8px to a 16px ink label — the radio and checkbox rows share it. */
const OPTION_LABEL_CLASS =
  "inline-flex cursor-pointer items-center gap-2 text-base text-ink";

/**
 * The report toolbar's "By Date" panel (RPT-02.3): which lead date the window applies
 * to (Created / Status Changed) and the window itself — Today … Last Year, or a Custom
 * From/To. A draft until "Filter" publishes it, so picking never refetches mid-choice.
 * Placement and dismissal come from `useAnchoredPanel`, the same code the Filter
 * builder beside it uses.
 */
export function ReportDateFilter({
  value,
  onApply,
  onClear,
}: ReportDateFilterProps) {
  const { open, setOpen, pos, triggerRef, panelRef } =
    useAnchoredPanel(MAX_PANEL);
  const [draft, setDraft] = useState<DateFilterValue>(value);

  const toggle = () => {
    if (!open) setDraft(value);
    setOpen(!open);
  };
  // One window at a time: Workpex draws these as checkboxes, but a lead can't be in two
  // windows, so checking one unchecks the rest (and re-checking clears it).
  const togglePeriod = (period: DatePeriodKey) =>
    setDraft((d) => ({ ...d, period: d.period === period ? null : period }));
  const setDate = (key: "from" | "to", date: Date | null) =>
    setDraft((d) => ({ ...d, [key]: date ? dateKey(date) : undefined }));

  const heading =
    DATE_FIELD_OPTIONS.find((option) => option.value === draft.field)?.label ??
    "Created Date";

  const panel = pos && (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="By Date filter"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className="fixed z-50 rounded-surface bg-surface p-6 shadow-lg"
    >
      <div className="mb-6 flex items-center justify-between">
        {/* The heading names the date the window applies to — the checked radio. */}
        <h2 className="text-xl font-semibold text-ink">{heading}</h2>
        <button
          type="button"
          onClick={() => {
            setDraft(CLEARED);
            onClear();
          }}
          className="focus-ring rounded-sm text-base text-ink transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
        >
          Clear all
        </button>
      </div>

      <div className="mb-7 flex flex-wrap items-center gap-x-7 gap-y-3">
        {DATE_FIELD_OPTIONS.map((option) => (
          <label key={option.value} className={OPTION_LABEL_CLASS}>
            <Radio
              name="report-date-field"
              value={option.value}
              checked={draft.field === option.value}
              onChange={() => setDraft((d) => ({ ...d, field: option.value }))}
            />
            {option.label}
          </label>
        ))}
      </div>

      <h3 className="mb-6 text-lg font-semibold text-ink">By Date</h3>
      <div className="grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-4">
        {DATE_PERIODS.map((preset) => (
          <label key={preset.key} className={OPTION_LABEL_CLASS}>
            <Checkbox
              checked={draft.period === preset.key}
              onChange={() => togglePeriod(preset.key)}
            />
            {preset.label}
          </label>
        ))}
      </div>

      {draft.period === "custom" && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-[9px]">
          <div className="min-w-0 flex-1">
            <DatePicker
              numeric
              value={parseDateKey(draft.from) ?? null}
              onChange={(date) => setDate("from", date)}
              placeholder="From Date"
            />
          </div>
          <div className="min-w-0 flex-1">
            <DatePicker
              numeric
              value={parseDateKey(draft.to) ?? null}
              onChange={(date) => setDate("to", date)}
              placeholder="To Date"
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        {/* 78px wide, like the Filter builder's — wider than six characters need. */}
        <Button
          size="sm"
          className="min-w-[78px]"
          onClick={() => {
            onApply(draft);
            setOpen(false);
          }}
        >
          Filter
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        className={cn(
          TOOLBAR_BUTTON_CLASS,
          "relative",
          // Workpex tints the chip while its panel is open.
          open && "bg-brand-subtle",
        )}
      >
        <IconCalendar size={18} stroke={1.75} aria-hidden="true" />
        By Date
        <IconChevronDown size={16} stroke={1.75} className="text-ink-muted" />
        {value.period && (
          <Badge tone="brand" aria-label="1 selected">
            1
          </Badge>
        )}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}
