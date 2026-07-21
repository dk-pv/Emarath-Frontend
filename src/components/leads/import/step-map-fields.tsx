"use client";

import { useMemo, useState } from "react";
import { IconInfoCircle, IconLink } from "@tabler/icons-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import type { FieldMapping } from "@/components/leads/import/import-data";
import type { ImportFieldOption } from "@/services/leads-import-service";
import type { SelectOption } from "@/types";

const GRID = "grid grid-cols-[1fr_72px_1fr] items-center";

type StepMapFieldsProps = {
  columns: string[];
  fields: readonly ImportFieldOption[];
  mapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
};

/**
 * Step 3 — Map Fields, matching the walkthrough: two columns (the file's columns,
 * detected server-side, and the target fields) joined by a link marker that fills
 * green once mapped, searchable field dropdowns with a clear affordance, and a
 * Clear Mapping control that confirms before resetting. Required fields are starred.
 */
export function StepMapFields({
  columns,
  fields,
  mapping,
  onMappingChange,
}: StepMapFieldsProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const fieldOptions = useMemo<SelectOption[]>(
    () =>
      fields.map((field) => ({
        value: field.value,
        label: field.required ? `${field.label} *` : field.label,
      })),
    [fields],
  );

  const requiredLabels = useMemo(
    () =>
      fields
        .filter((field) => field.required)
        .map((field) => field.label)
        .join(", "),
    [fields],
  );

  const setColumn = (column: string, value: string | null) =>
    onMappingChange({ ...mapping, [column]: value });

  const reset = () => {
    const cleared: FieldMapping = {};
    for (const column of columns) cleared[column] = null;
    onMappingChange(cleared);
    setConfirmReset(false);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Map Your Fields</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Match file columns to system fields.{" "}
            <span className="font-semibold text-ink">Customer Name</span>,{" "}
            <span className="font-semibold text-ink">Primary Phone</span> and{" "}
            <span className="font-semibold text-ink">More</span>{" "}
            <Tooltip content={`Required: ${requiredLabels}`}>
              <span className="inline-flex align-middle text-info">
                <IconInfoCircle size={16} stroke={1.75} aria-hidden="true" />
              </span>
            </Tooltip>{" "}
            are required to complete the import.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirmReset(true)}
          className="shrink-0 rounded-full border border-danger/50 px-4 py-1.5 text-sm font-medium text-danger transition-colors duration-(--duration-shell) ease-shell hover:bg-danger hover:text-white focus-ring"
        >
          Clear Mapping
        </button>
      </div>

      <div className={cn(GRID, "mt-6")}>
        <div className="rounded-control bg-canvas px-4 py-3 text-sm font-medium text-ink">
          Your Column
        </div>
        <div aria-hidden="true" />
        <div className="rounded-control bg-canvas px-4 py-3 text-sm font-medium text-ink">
          Fields in Workpex
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {columns.map((column) => {
          const value = mapping[column] ?? null;
          const mapped = Boolean(value);

          return (
            <li key={column} className={GRID}>
              <div className="truncate rounded-control border border-hairline px-4 py-3 text-sm text-ink">
                {column}
              </div>

              <div className="relative flex items-center justify-center">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1 top-1/2 border-t border-dashed border-hairline"
                />
                <span
                  className={cn(
                    "relative z-10 flex size-7 items-center justify-center rounded-full",
                    mapped
                      ? "bg-brand text-white"
                      : "border border-hairline bg-surface text-ink-subtle",
                  )}
                >
                  <IconLink size={14} stroke={1.75} aria-hidden="true" />
                </span>
              </div>

              <SearchableSelect
                options={fieldOptions}
                value={value}
                onChange={(next) => setColumn(column, next)}
                clearable
                placeholder="Not mapped yet"
              />
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={reset}
        title="Reset Field Mapping"
        description="By resetting the field mappings, you will override the current settings."
        confirmLabel="Reset"
        tone="brand"
      />
    </div>
  );
}
