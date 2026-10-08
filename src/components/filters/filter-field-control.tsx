"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import { Input } from "@/components/ui/Input";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import type { FilterCondition, FilterField } from "@/types";

type FilterFieldControlProps = {
  field: FilterField;
  value: FilterCondition["value"];
  onChange: (value: FilterCondition["value"]) => void;
};

/** Maps a field definition to the matching shared control. No control is bespoke. */
export function FilterFieldControl({
  field,
  value,
  onChange,
}: FilterFieldControlProps) {
  if (field.type === "multi") {
    return (
      <MultiSelect
        options={field.options}
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
        placeholder={`Any ${field.label.toLowerCase()}`}
      />
    );
  }

  if (field.type === "select") {
    return (
      <Select
        aria-label={field.label}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value || null)}
        options={[
          { label: `Any ${field.label.toLowerCase()}`, value: "" },
          ...field.options,
        ]}
      />
    );
  }

  if (field.type === "date") {
    return (
      <DatePicker
        value={typeof value === "string" && value ? new Date(value) : null}
        onChange={(date) => onChange(date ? date.toISOString() : null)}
        placeholder={field.label}
      />
    );
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        aria-label={field.label}
        value={value === null ? "" : String(value)}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
        placeholder={`Min ${field.label.toLowerCase()}`}
      />
    );
  }

  return (
    <Input
      aria-label={field.label}
      value={typeof value === "string" ? value : ""}
      onChange={(event) => onChange(event.target.value || null)}
      placeholder={field.label}
    />
  );
}
