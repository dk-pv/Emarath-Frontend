"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  IconChevronDown,
  IconFilter,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { useToast } from "@/components/ui/Toast";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useAnchoredPanel } from "@/hooks/use-anchored-panel";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { fetchAssignableAgents, fetchLookup } from "@/services/lookups-service";
import {
  FIELD_OPTIONS,
  LEAD_FILTER_FIELDS,
  activeConditionCount,
  emptyRow,
  fieldDef,
  operatorOptions,
  valueControl,
  type LeadFilterOperator,
  type LeadFilterRow,
} from "@/components/leads/lead-filter-config";
import type { AdvancedFilterState } from "@/hooks/use-advanced-filter";
import type { SelectOption } from "@/types";

type LeadFilterBuilderProps = {
  /** The shared filter state — draft rows, applied payload and saved presets. */
  filter: AdvancedFilterState;
  /** Names the panel for assistive tech; the surface it filters ("Leads"/"Board"). */
  label?: string;
};

/**
 * Workpex's filter panel measures 774×243 with 27px padding, so its three condition
 * controls are exactly 234px each with 9px gaps (`kanban-filters-popover-open-columns-1-6.png`,
 * `leads-filters-popup-open.png` — both panels are pixel-identical). Narrower viewports
 * clamp inside the content column instead.
 */
const MAX_PANEL = 774;

/**
 * The advanced lead filter (Workpex "Filter", ADR-0039/0040/0052) — a condition builder
 * of Field · Operator · Value rows with per-row remove, "+ New Condition", "Clear All",
 * the caller's saved-filter checkbox row, and "Save & Filter" / "Update & Filter" /
 * "Filter".
 *
 * Shared by the Leads list and the Kanban board (KAN-07.1 AC1/AC5): both filter leads
 * with the identical field/operator vocabulary, so one component serves both rather than
 * a second builder that could drift. All state lives in `useAdvancedFilter`.
 *
 * The operator set and value control are driven entirely by the field's kind
 * (`lead-filter-config`) — numeric, date, text, enum, user, tags — so behaviour is one
 * source of truth, never per-field JSX. The panel is portaled and `position: fixed`,
 * clamped inside the main content column (`[data-app-main]`) so it never renders under
 * the sidebar whether the rail is expanded or collapsed, and stays within the viewport.
 */
export function LeadFilterBuilder({
  filter,
  label = "Leads",
}: LeadFilterBuilderProps) {
  const {
    rows,
    setRows: onRowsChange,
    appliedCount: activeCount,
    saved,
    selectedId,
    apply: onApply,
    clear: onClear,
    selectPreset,
    savePreset,
    updatePreset,
  } = filter;
  const { toast } = useToast();
  const { open, setOpen, pos, triggerRef, panelRef } =
    useAnchoredPanel(MAX_PANEL);
  // The "Save & Filter" name prompt; `null` = closed.
  const [saveName, setSaveName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [optionsByField, setOptionsByField] = useState<
    Record<string, SelectOption[]>
  >({});

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

  const patch = (id: string, next: Partial<LeadFilterRow>) =>
    onRowsChange(
      rows.map((row) => (row.id === id ? { ...row, ...next } : row)),
    );
  const setField = (id: string, field: string | null) =>
    patch(id, { field, operator: null, values: [] });
  /**
   * Changing the operator keeps the chosen values when the new operator renders the
   * same control (Is ⇄ Isn't, Contains ⇄ Doesn't Contain, …) — Workpex shows a preset
   * flipped to "Isn't" with its chips intact. Values are dropped only when the control
   * itself changes (single ⇄ range, or to a valueless Is Empty), where they'd be wrong.
   */
  const setOperator = (id: string, operator: LeadFilterOperator | null) => {
    const row = rows.find((r) => r.id === id);
    const def = fieldDef(row?.field ?? null);
    const keepValues =
      def && row && row.operator && operator
        ? valueControl(def.kind, row.operator) ===
          valueControl(def.kind, operator)
        : false;
    patch(id, { operator, values: keepValues && row ? row.values : [] });
  };
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
        return placeholderBox("No value needed", false);
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
            // One chip then "+N", so the row stays one control tall — Workpex renders
            // a four-user selection as "Ansar UAE +3", never a stack of four chips.
            maxVisibleChips={1}
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

  /** Complete rows drive whether a preset can be saved/updated at all. */
  const completeCount = activeConditionCount(rows);

  /** Shared save/update flow: run, report, apply, close. Errors keep the panel open. */
  const runSave = async (op: Promise<unknown>, okTitle: string) => {
    setBusy(true);
    try {
      await op;
      toast({ title: okTitle, tone: "success" });
      setSaveName(null);
      setOpen(false);
    } catch (error: unknown) {
      toast({
        title: "Couldn’t save the filter",
        description: error instanceof ApiError ? error.message : undefined,
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  };

  const panel = pos && (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${label} filter`}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className="fixed z-50 rounded-surface bg-surface p-[27px] shadow-lg"
    >
      <div className="mb-[18px] flex items-center justify-between">
        <h2 className="text-xl font-semibold text-ink">Filters</h2>
        <button
          type="button"
          onClick={onClear}
          className="focus-ring rounded-sm text-sm font-medium text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          Clear All
        </button>
      </div>

      {/* The caller's saved presets (ADR-0052). Checking one loads its conditions into
          the builder to edit; single-select, so checking another replaces the draft.
          Hidden entirely when the user has none, rather than showing an empty rule. */}
      {saved.length > 0 && (
        <div className="-mx-[27px] mb-[18px] flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-hairline px-[27px] pb-5">
          {saved.map((preset) => (
            <ScopeCheckbox
              key={preset.id}
              label={preset.name}
              checked={selectedId === preset.id}
              onToggle={() =>
                selectPreset(selectedId === preset.id ? null : preset.id)
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const def = fieldDef(row.field);
          return (
            <div
              key={row.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-[9px]"
            >
              {/* Equal thirds, not fixed widths: Workpex's three controls each measure
                  234px across the 720px content width with 9px gaps. */}
              <div className="min-w-0 flex-1">
                <SearchableSelect
                  options={FIELD_OPTIONS}
                  value={row.field}
                  onChange={(value) => setField(row.id, value)}
                  placeholder="Select"
                />
              </div>
              <div className="min-w-0 flex-1">
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
              {/* No remove control on a lone row — Workpex's single-condition panel runs
                  its three controls to the right padding edge with no × column, and the
                  last row can't be removed anyway (removing it re-adds an empty one). */}
              {rows.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove condition"
                  onClick={() => removeRow(row.id)}
                  className="focus-ring flex size-control-md shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger"
                >
                  <IconX size={18} stroke={1.75} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-[18px] flex items-center justify-between gap-3">
        {/* Grey, not brand — Workpex draws "+ New Condition" in the same neutral as
            "Clear All", never in the primary colour. */}
        <button
          type="button"
          onClick={addRow}
          className="focus-ring inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          New Condition
        </button>
        <div className="flex items-center gap-[9px]">
          {/* With a preset checked the primary save action overwrites it (Workpex
              "Update & Filter"); with none checked it creates a new one. Both need at
              least one complete condition — an empty preset would filter nothing. */}
          {selectedId ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || completeCount === 0}
              onClick={() => {
                void runSave(updatePreset(), "Filter updated");
              }}
            >
              Update &amp; Filter
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || completeCount === 0}
              onClick={() => setSaveName("")}
            >
              Save &amp; Filter
            </Button>
          )}
          {/* Workpex's "Filter" is 78px wide — wider than its six characters need, and
              wider than the shared button's padding gives. */}
          <Button
            size="sm"
            className="min-w-[78px]"
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
        className={cn(
          TOOLBAR_BUTTON_CLASS,
          "relative",
          // Workpex tints the chip while its panel is open.
          open && "bg-brand-subtle",
        )}
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

      {/* "Save & Filter" names the preset before creating it — the shared Modal, so the
          prompt matches every other one in the app rather than a bespoke inline form. */}
      <Modal
        open={saveName !== null}
        onClose={() => {
          if (!busy) setSaveName(null);
        }}
        title="Save filter"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setSaveName(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={busy || !saveName?.trim()}
              onClick={() => {
                void runSave(
                  savePreset(saveName?.trim() ?? ""),
                  "Filter saved",
                );
              }}
            >
              Save &amp; Filter
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Name</span>
          <Input
            value={saveName ?? ""}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="e.g. UAE TEAM"
            maxLength={120}
            autoFocus
          />
        </label>
      </Modal>
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
  // The shared Checkbox already is Workpex's box — 20px, 4px radius, brand tick — and
  // 12px separates it from the label in the UAE TEAM / GLOBAL TEAM row.
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-ink">
      <Checkbox checked={checked} onChange={onToggle} />
      <span className="max-w-40 truncate">{label}</span>
    </label>
  );
}

/**
 * The value slot before a field/operator is chosen. Workpex draws it as a third
 * dropdown — same border, same chevron as the two beside it — so the row reads as
 * three controls, not two controls and a label.
 */
function placeholderBox(text: string, chevron = true) {
  return (
    <div className="flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm text-ink-subtle">
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {chevron && (
        <IconChevronDown
          aria-hidden="true"
          stroke={1.75}
          className="size-4 shrink-0 text-ink-muted"
        />
      )}
    </div>
  );
}
