"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  IconCheck,
  IconChevronDown,
  IconFilter,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { cn } from "@/lib/cn";
import { fetchAssignableAgents, fetchLookup } from "@/services/lookups-service";
import {
  FIELD_OPTIONS,
  LEAD_FILTER_FIELDS,
  emptyRow,
  fieldDef,
  operatorOptions,
  valueControl,
  type LeadFilterOperator,
  type LeadFilterRow,
} from "@/components/leads/lead-filter-config";
import type { SelectOption } from "@/types";

type LeadFilterBuilderProps = {
  rows: LeadFilterRow[];
  onRowsChange: (rows: LeadFilterRow[]) => void;
  onApply: () => void;
  onClear: () => void;
  activeCount: number;
};

/** The three top scope checkboxes (Workpex). Their saved-filter behaviour is deferred. */
const SCOPES = [
  { key: "lead", label: "LEAD FILTER" },
  { key: "won", label: "WON" },
  { key: "day", label: "DAY LEAD FILTER" },
] as const;
type ScopeKey = (typeof SCOPES)[number]["key"];

const GAP = 8;
const MAX_PANEL = 640;

/**
 * The Leads advanced filter (Workpex "Filter", ADR-0039/0040) — a condition builder of
 * Field · Operator · Value rows with per-row remove, "+ New Condition", "Clear All",
 * "Save & Filter" (deferred) and "Filter", plus the three top scope checkboxes.
 *
 * The operator set and value control are driven entirely by the field's kind
 * (`lead-filter-config`) — numeric, date, text, enum, user, tags — so behaviour is one
 * source of truth, never per-field JSX. The panel is portaled and `position: fixed`,
 * clamped inside the main content column (`[data-app-main]`) so it never renders under
 * the sidebar whether the rail is expanded or collapsed, and stays within the viewport.
 */
export function LeadFilterBuilder({
  rows,
  onRowsChange,
  onApply,
  onClear,
  activeCount,
}: LeadFilterBuilderProps) {
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState<Record<ScopeKey, boolean>>({
    lead: false,
    won: false,
    day: false,
  });
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [optionsByField, setOptionsByField] = useState<
    Record<string, SelectOption[]>
  >({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Value options: the enum lookups + the assignable agents + the tag catalogue, once.
  useEffect(() => {
    const controller = new AbortController();
    const enumFields = LEAD_FILTER_FIELDS.filter(
      (f) => f.kind === "enum" && f.lookup,
    );
    Promise.all([
      ...enumFields.map((f) =>
        fetchLookup(f.lookup!, controller.signal)
          .then(
            (opts) =>
              [
                f.key,
                opts.map((o) => ({ value: o.value, label: o.label })),
              ] as const,
          )
          .catch(() => [f.key, []] as const),
      ),
      fetchAssignableAgents(controller.signal)
        .then(
          (list) =>
            [
              "assignedAgent",
              list.map((a) => ({ value: a.id, label: a.name })),
            ] as const,
        )
        .catch(() => ["assignedAgent", []] as const),
      fetchLookup("tags", controller.signal)
        .then(
          (opts) =>
            [
              "tags",
              opts.map((o) => ({ value: o.value, label: o.label })),
            ] as const,
        )
        .catch(() => ["tags", []] as const),
    ]).then((entries) => setOptionsByField(Object.fromEntries(entries)));
    return () => controller.abort();
  }, []);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const t = trigger.getBoundingClientRect();
    const main = document
      .querySelector("[data-app-main]")
      ?.getBoundingClientRect();
    const mainLeft = main ? main.left : 0;
    const vw = window.innerWidth;
    const available = vw - mainLeft - GAP * 2;
    const width = Math.max(280, Math.min(MAX_PANEL, available));
    let left = t.right - width;
    left = Math.min(left, vw - GAP - width);
    left = Math.max(left, mainLeft + GAP);
    setPos({ top: t.bottom + GAP, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  // Dismiss on outside click / Escape (the panel is portaled, so check both nodes).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const patch = (id: string, next: Partial<LeadFilterRow>) =>
    onRowsChange(
      rows.map((row) => (row.id === id ? { ...row, ...next } : row)),
    );
  const setField = (id: string, field: string | null) =>
    patch(id, { field, operator: null, values: [] });
  const setOperator = (id: string, operator: LeadFilterOperator | null) =>
    patch(id, { operator, values: [] });
  const setValues = (id: string, values: string[]) => patch(id, { values });
  const setValueAt = (row: LeadFilterRow, index: number, value: string) => {
    const values = [...row.values];
    values[index] = value;
    setValues(row.id, values);
  };
  const setDateAt = (row: LeadFilterRow, index: number, date: Date | null) =>
    setValueAt(row, index, date ? date.toISOString() : "");
  const addRow = () => onRowsChange([...rows, emptyRow()]);
  const removeRow = (id: string) => {
    const next = rows.filter((row) => row.id !== id);
    onRowsChange(next.length > 0 ? next : [emptyRow()]);
  };
  const asDate = (iso: string | undefined) => (iso ? new Date(iso) : null);

  const numberInput = (
    row: LeadFilterRow,
    index: number,
    placeholder: string,
  ) => (
    <Input
      type="number"
      value={row.values[index] ?? ""}
      onChange={(e) => setValueAt(row, index, e.target.value)}
      placeholder={placeholder}
    />
  );

  const renderValue = (row: LeadFilterRow) => {
    const def = fieldDef(row.field);
    if (!def || !row.operator) return placeholderBox("Select Value");
    const control = valueControl(def.kind, row.operator);
    switch (control) {
      case "none":
        return placeholderBox("No value needed");
      case "number":
        return numberInput(row, 0, "Enter value...");
      case "numberRange":
        return (
          <div className="flex items-center gap-2">
            {numberInput(row, 0, "From")}
            {numberInput(row, 1, "To")}
          </div>
        );
      case "text":
        return (
          <Input
            type="text"
            value={row.values[0] ?? ""}
            onChange={(e) => setValueAt(row, 0, e.target.value)}
            placeholder="Enter value..."
          />
        );
      case "date":
        return (
          <DatePicker
            numeric
            value={asDate(row.values[0])}
            onChange={(d) => setDateAt(row, 0, d)}
            placeholder="Select Date"
          />
        );
      case "dateRange":
        return (
          <div className="flex items-center gap-2">
            <DatePicker
              numeric
              value={asDate(row.values[0])}
              onChange={(d) => setDateAt(row, 0, d)}
              placeholder="From Date"
            />
            <DatePicker
              numeric
              value={asDate(row.values[1])}
              onChange={(d) => setDateAt(row, 1, d)}
              placeholder="To Date"
            />
          </div>
        );
      default:
        return (
          <MultiSelect
            searchable
            options={optionsByField[def.key] ?? []}
            value={row.values}
            onChange={(values) => setValues(row.id, values)}
            placeholder={
              control === "userMulti" ? "Select User" : "Select Value"
            }
          />
        );
    }
  };

  const panel = pos && (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Leads filter"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className="fixed z-50 rounded-surface border border-hairline bg-surface p-5 shadow-lg"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Filters</h2>
        <button
          type="button"
          onClick={onClear}
          className="focus-ring rounded-sm text-sm font-medium text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          Clear All
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-hairline pb-4">
        {SCOPES.map((scope) => (
          <ScopeCheckbox
            key={scope.key}
            label={scope.label}
            checked={scopes[scope.key]}
            onToggle={() =>
              setScopes((s) => ({ ...s, [scope.key]: !s[scope.key] }))
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const def = fieldDef(row.field);
          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-start"
            >
              <div className="sm:w-44 sm:shrink-0">
                <SearchableSelect
                  options={FIELD_OPTIONS}
                  value={row.field}
                  onChange={(value) => setField(row.id, value)}
                  placeholder="Select"
                />
              </div>
              <div className="sm:w-40 sm:shrink-0">
                <SearchableSelect
                  searchable={false}
                  options={def ? operatorOptions(def.kind) : []}
                  value={row.operator}
                  onChange={(value) =>
                    setOperator(row.id, value as LeadFilterOperator | null)
                  }
                  placeholder="Operator"
                  disabled={!def}
                />
              </div>
              <div className="min-w-0 flex-1">{renderValue(row)}</div>
              <button
                type="button"
                aria-label="Remove condition"
                onClick={() => removeRow(row.id)}
                className="focus-ring flex size-control-md shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger"
              >
                <IconX size={18} stroke={1.75} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-brand-strong transition-colors duration-(--duration-shell) ease-shell hover:text-brand"
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          New Condition
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Saved filters are not available yet"
          >
            Save &amp; Filter
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply();
              setOpen(false);
            }}
          >
            Filter
          </Button>
        </div>
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
        onClick={() => setOpen((v) => !v)}
        className={cn(TOOLBAR_BUTTON_CLASS, "relative")}
      >
        <IconFilter size={18} stroke={1.75} />
        Filter
        <IconChevronDown size={16} stroke={1.75} className="text-ink-muted" />
        {activeCount > 0 && (
          <Badge tone="brand" aria-label={`${activeCount} active filters`}>
            {activeCount}
          </Badge>
        )}
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}

function ScopeCheckbox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="focus-ring inline-flex items-center gap-2 rounded-sm text-sm font-medium text-ink"
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-[4px] border transition-colors duration-(--duration-shell) ease-shell",
          checked
            ? "border-brand bg-brand text-white"
            : "border-hairline bg-surface",
        )}
      >
        {checked && <IconCheck size={12} stroke={3} aria-hidden="true" />}
      </span>
      <span className="max-w-40 truncate">{label}</span>
    </button>
  );
}

function placeholderBox(text: string) {
  return (
    <div className="flex h-control-md items-center rounded-control border border-hairline bg-canvas px-3 text-sm text-ink-subtle">
      {text}
    </div>
  );
}
