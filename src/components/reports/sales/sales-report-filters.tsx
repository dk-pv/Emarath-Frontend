"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconCalendar,
  IconChevronDown,
  IconFileExport,
  IconFileTypePdf,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { DateTimeField } from "@/components/ui/DateTimeField";
import { Dropdown } from "@/components/ui/Dropdown";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { useDismissable } from "@/hooks/use-dismissable";
import { cn } from "@/lib/cn";
import {
  dateKey,
  keyBound,
  rangeError,
  type DateTimeBound,
} from "@/lib/date-time-range";
import { chipLabel } from "@/lib/sales-reports";
import type { DatePeriodKey } from "@/services/leads-by-status-report-service";

/**
 * The Workpex analytics pills (Oct 2026 toolbar, 1.6× crops): 30px tall, 6px sides — the glyphs
 * carry their own inset — 4px gaps, 13px medium labels, a green tint when set or open.
 */
export const PILL_CLASS = "h-7.5 gap-1 px-1.5 text-[13px] font-medium";
export const PILL_SET_CLASS = "bg-brand/30 text-ink hover:bg-brand/30";

/** The panels' shared surface (Oct 2026 captures): 10px corners, a hairline, a soft shadow. */
const PANEL_CLASS =
  "fixed z-50 rounded-[10px] border border-hairline bg-surface shadow-lg";

/**
 * A toolbar chip: glyph, label, and the chevron behind a white rule. The rule always shows on
 * the date chip; on the others only while hovered or open — as the captures draw them.
 */
export function Chip({
  icon: Glyph,
  label,
  set,
  open,
  alwaysSplit = false,
}: {
  icon: Icon;
  label: string;
  set: boolean;
  open: boolean;
  alwaysSplit?: boolean;
}) {
  return (
    <span
      className={cn(
        TOOLBAR_BUTTON_CLASS,
        PILL_CLASS,
        "group/chip whitespace-nowrap",
        (set || open) && PILL_SET_CLASS,
      )}
    >
      <Glyph size={16} stroke={1.75} aria-hidden="true" />
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "-my-0.5 h-5 w-0.5 bg-surface",
          !alwaysSplit && !open && "hidden group-hover/chip:block",
        )}
      />
      <IconChevronDown
        size={14}
        stroke={2}
        aria-hidden="true"
        className="-ml-0.5 text-ink-muted"
      />
    </span>
  );
}

/** A chip that opens a portaled panel centred under it (`useAnchoredPanel`). */
function ChipPanel({
  chip,
  label,
  width,
  minWidth,
  className,
  children,
}: {
  chip: (open: boolean) => React.ReactNode;
  /** The panel's accessible name. */
  label: string;
  width: number;
  minWidth?: number;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const { open, setOpen, pos, triggerRef, panelRef } = useAnchoredPanel(
    width,
    minWidth,
  );
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className="focus-ring block rounded-control"
      >
        {chip(open)}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={label}
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className={cn(PANEL_CLASS, className)}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </div>
  );
}

export type SalesDateValue = {
  period: DatePeriodKey | null;
  /** The Custom range's date keys, end inclusive. */
  from?: string;
  to?: string;
};

/**
 * The window (`analytics-sales-funnel-date-filter-open*-2026-10.png`): the chip names the
 * applied period, cut to Workpex's eight characters; its panel is "By Date" with Clear all,
 * then "Choose Date" over a list of the presets — picking one applies it at once. Custom Date
 * adds the From/To fields the other report panels use, applied with Filter.
 */
export function SalesDateFilter({
  value,
  periods,
  onApply,
  onClear,
}: {
  value: SalesDateValue;
  periods: readonly { key: DatePeriodKey; label: string }[];
  onApply: (value: SalesDateValue) => void;
  onClear: () => void;
}) {
  const label = periodLabel(value, periods);

  return (
    <div title={label ?? undefined}>
      <ChipPanel
        label="By Date"
        width={514}
        className="min-h-[162px] px-4 pt-4 pb-6"
        chip={(open) => (
          <Chip
            icon={IconCalendar}
            label={label ? chipLabel(label) : "By Date"}
            set={label !== null}
            open={open}
            alwaysSplit={label !== null}
          />
        )}
      >
        {(close) => (
          <DatePanel
            value={value}
            periods={periods}
            onApply={(next) => {
              onApply(next);
              close();
            }}
            onClear={onClear}
          />
        )}
      </ChipPanel>
    </div>
  );
}

function DatePanel({
  value,
  periods,
  onApply,
  onClear,
}: {
  value: SalesDateValue;
  periods: readonly { key: DatePeriodKey; label: string }[];
  onApply: (value: SalesDateValue) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState<SalesDateValue>(value);
  const custom = draft.period === "custom";
  const customError = custom
    ? rangeError(keyBound(draft.from), keyBound(draft.to))
    : null;
  const setBound = (key: "from" | "to", { day, time }: DateTimeBound) =>
    setDraft((d) => ({ ...d, [key]: day ? dateKey(day, time) : undefined }));

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-ink">By Date</h2>
        <button
          type="button"
          onClick={() => {
            setDraft({ period: null });
            onClear();
          }}
          className="focus-ring rounded-sm text-[13px] text-ink-soft transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          Clear all
        </button>
      </div>

      <div className="mt-[30px] flex items-center">
        <span className="w-[102px] shrink-0 text-[13px] text-ink-soft">
          Choose Date
        </span>
        <PeriodSelect
          value={draft.period}
          periods={periods}
          onChange={(period) => {
            if (period === "custom") setDraft({ period });
            else onApply({ period });
          }}
        />
      </div>

      {custom && (
        <div className="mt-4 flex flex-col gap-2 pl-[102px]">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-[9px]">
            <div className="min-w-0 flex-1">
              <DateTimeField
                edge="start"
                placeholder="From Date"
                value={keyBound(draft.from)}
                onChange={(bound) => setBound("from", bound)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <DateTimeField
                edge="end"
                placeholder="To Date"
                value={keyBound(draft.to)}
                onChange={(bound) => setBound("to", bound)}
              />
            </div>
          </div>
          {customError && (
            <p role="alert" className="text-xs text-danger">
              {customError}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              size="sm"
              className="min-w-[78px]"
              disabled={customError !== null || !draft.from || !draft.to}
              onClick={() => onApply(draft)}
            >
              Filter
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * "Choose Date": a bordered field, green while open, over a scrolling list of the presets —
 * a green wash on hover, the applied one greyed (Workpex's own list, not the OS select).
 */
function PeriodSelect({
  value,
  periods,
  onChange,
}: {
  value: DatePeriodKey | null;
  periods: readonly { key: DatePeriodKey; label: string }[];
  onChange: (period: DatePeriodKey) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useDismissable(root, open, () => setOpen(false));
  const current = periods.find((preset) => preset.key === value);

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "focus-ring flex h-8.25 w-full items-center justify-between rounded-[5px] border bg-surface px-2.75 text-left text-[13px] font-medium text-ink transition-colors duration-(--duration-shell) ease-shell",
          open ? "border-brand" : "border-hairline hover:border-brand",
        )}
      >
        <span className="truncate">{current?.label ?? "Select"}</span>
        <IconChevronDown
          size={16}
          stroke={1.75}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-ink-muted transition-transform duration-(--duration-shell) ease-shell",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Choose Date"
          className="scrollbar-slim absolute top-[calc(100%+6px)] left-0 z-10 flex max-h-[210px] w-full flex-col gap-1 overflow-y-auto rounded-[10px] border border-hairline bg-surface p-2 shadow-lg"
        >
          {periods.map((preset) => (
            <li
              key={preset.key}
              role="option"
              aria-selected={preset.key === value}
              tabIndex={0}
              onClick={() => {
                setOpen(false);
                onChange(preset.key);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setOpen(false);
                onChange(preset.key);
              }}
              className={cn(
                "focus-ring-inset flex h-8 shrink-0 cursor-pointer items-center rounded-md px-3 text-[13px] transition-colors duration-(--duration-shell) ease-shell hover:bg-brand/15",
                preset.key === value ? "text-ink-subtle" : "text-ink-soft",
              )}
            >
              {preset.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The applied window's name: a preset's label, the Custom range, or null for all time. */
export function periodLabel(
  value: SalesDateValue,
  periods: readonly { key: DatePeriodKey; label: string }[],
): string | null {
  if (!value.period) return null;
  if (value.period === "custom") {
    return [value.from, value.to].filter(Boolean).join(" – ") || "Custom Date";
  }
  return periods.find((preset) => preset.key === value.period)?.label ?? null;
}

export interface SalesAgentOption {
  id: string;
  name: string;
  /** The manager they report to, when that manager is also listed. */
  reportingToId?: string | null;
}

/** The agents in reporting order: each manager, then the people who report to them. */
export function agentTree(
  agents: readonly SalesAgentOption[],
): { agent: SalesAgentOption; depth: number }[] {
  const ids = new Set(agents.map((agent) => agent.id));
  const children = new Map<string, SalesAgentOption[]>();
  const roots: SalesAgentOption[] = [];
  for (const agent of agents) {
    const manager = agent.reportingToId;
    if (manager && ids.has(manager) && manager !== agent.id) {
      children.set(manager, [...(children.get(manager) ?? []), agent]);
    } else roots.push(agent);
  }
  const rows: { agent: SalesAgentOption; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (agent: SalesAgentOption, depth: number) => {
    if (seen.has(agent.id)) return;
    seen.add(agent.id);
    rows.push({ agent, depth });
    for (const child of children.get(agent.id) ?? []) visit(child, depth + 1);
  };
  roots.forEach((agent) => visit(agent, 0));
  // A reporting loop has no root; its members still list, at the top level.
  agents.forEach((agent) => visit(agent, 0));
  return rows;
}

/**
 * Sales Agent (`analytics-sales-funnel-sales-agent-dropdown-2026-10.png`): a search box over the
 * agents the caller can see, each nested under the manager they report to with Workpex's dashed
 * guide lines. One agent at a time; picking the chosen one again goes back to all agents.
 */
export function SalesAgentFilter({
  agents,
  value,
  onChange,
}: {
  agents: readonly SalesAgentOption[];
  value: string | null;
  onChange: (agent: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const tree = useMemo(() => agentTree(agents), [agents]);
  const term = query.trim().toLowerCase();
  const rows = term
    ? tree
        .filter((row) => row.agent.name.toLowerCase().includes(term))
        .map((row) => ({ ...row, depth: 0 }))
    : tree;
  const selected = agents.find((agent) => agent.id === value);

  return (
    <ChipPanel
      label="Sales Agent"
      width={299}
      className="flex max-h-[292px] flex-col overflow-hidden"
      chip={(open) => (
        <Chip
          icon={IconUser}
          label={selected?.name ?? "Sales Agent"}
          set={selected !== undefined}
          open={open}
        />
      )}
    >
      {(close) => (
        <>
          <div className="shrink-0 px-4 pt-3">
            <PanelSearch
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search sales agents"
              className="h-7.5 rounded-lg"
            />
          </div>
          <ul className="scrollbar-slim min-h-0 flex-1 overflow-y-auto pt-0.5 pb-2">
            {rows.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-subtle">
                No results found
              </li>
            )}
            {rows.map(({ agent, depth }) => (
              <li key={agent.id}>
                <button
                  type="button"
                  aria-pressed={agent.id === value}
                  onClick={() => {
                    onChange(agent.id === value ? null : agent.id);
                    close();
                  }}
                  style={{ paddingLeft: 16 + depth * 26 }}
                  className={cn(
                    "focus-ring-inset relative flex h-8.5 w-full items-center pr-4 text-left text-sm transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas",
                    agent.id === value
                      ? "font-medium text-ink"
                      : "text-ink-soft",
                  )}
                >
                  {depth > 0 && (
                    <span
                      aria-hidden="true"
                      style={{ left: 22 + (depth - 1) * 26 }}
                      className="absolute inset-y-0 w-4 border-l border-dashed border-ink-subtle before:absolute before:top-1/2 before:left-0 before:w-3.5 before:border-t before:border-dashed before:border-ink-subtle"
                    />
                  )}
                  <span className="truncate">{agent.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChipPanel>
  );
}

/**
 * A one-value list behind a chip, the current value unmarked in the list — the chip names it:
 *
 * - **Lead Pipeline** (`analytics-sales-funnel-pipeline-dropdown-2026-10.png`): always set, a
 *   200px panel of full-width rows, the labels 24px in;
 * - **Lead Source** (`analytics-sales-pipeline-lead-source-dropdown-2026-10.png`): `clearable`,
 *   so the chip reads its name until a source is picked and picking it again clears it; inset,
 *   rounded rows that take a green wash on hover.
 */
export function SalesOptionFilter({
  label,
  icon,
  options,
  value,
  onChange,
  clearable = false,
}: {
  label: string;
  icon: Icon;
  options: readonly { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
}) {
  const current = options.find((option) => option.value === value);

  return (
    <ChipPanel
      label={label}
      width={200}
      minWidth={200}
      className={cn(
        "scrollbar-slim max-h-80 overflow-y-auto",
        clearable ? "flex flex-col gap-0.5 p-2" : "py-2",
      )}
      chip={(open) => (
        <Chip
          icon={icon}
          label={current?.label ?? value ?? label}
          set={!clearable || value !== null}
          open={open}
        />
      )}
    >
      {(close) =>
        options.length === 0 ? (
          <p className="px-6 py-3 text-sm text-ink-subtle">
            Nothing to choose from
          </p>
        ) : (
          options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === value}
              onClick={() => {
                onChange(
                  clearable && option.value === value ? null : option.value,
                );
                close();
              }}
              className={cn(
                "focus-ring-inset flex w-full shrink-0 items-center text-left text-sm text-ink-soft transition-colors duration-(--duration-shell) ease-shell",
                clearable
                  ? "h-8 rounded-md px-2.5 hover:bg-brand/15"
                  : "h-8.75 px-6 hover:bg-canvas",
              )}
            >
              <span className="truncate">{option.label}</span>
            </button>
          ))
        )
      }
    </ChipPanel>
  );
}

/**
 * Export (`analytics-sales-funnel-export-menu-2026-10.png`): a menu of one format, PDF. `onPdf`
 * downloads it; a second press while one is on its way does nothing.
 */
export function SalesExportMenu({ onPdf }: { onPdf: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  return (
    <Dropdown
      align="end"
      panelClassName="min-w-31"
      itemClassName="gap-2.5 py-3 text-sm [&_svg]:size-5 [&_svg]:text-danger"
      items={[
        {
          type: "item",
          id: "pdf",
          label: "PDF",
          icon: IconFileTypePdf,
          onSelect: () => {
            if (busy) return;
            setBusy(true);
            void onPdf().finally(() => setBusy(false));
          },
        },
      ]}
      trigger={
        <span
          aria-busy={busy || undefined}
          className={cn(
            TOOLBAR_BUTTON_CLASS,
            PILL_CLASS,
            "in-aria-expanded:bg-brand/30 in-aria-expanded:text-ink in-aria-expanded:hover:bg-brand/30",
            busy && "cursor-progress opacity-70",
          )}
        >
          <IconFileExport size={18} stroke={1.75} aria-hidden="true" />
          Export
        </span>
      }
    />
  );
}
