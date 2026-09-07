"use client";

import { useRef, useState } from "react";
import { IconGripVertical, IconPlus, IconTrash } from "@tabler/icons-react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  CUSTOM_FIELD_TYPE_OPTIONS,
  MAX_FIELD_LABEL,
  createCustomField,
  updateCustomField,
} from "@/services/data-schema-service";
import type {
  LeadCustomField,
  LeadCustomFieldType,
} from "@/services/leads-custom-fields-service";

export type CustomFieldFormState =
  | { mode: "create" }
  | { mode: "edit"; field: LeadCustomField };

type DraftOption = { key: string; label: string };

let optionKey = 0;
const newOption = (label = ""): DraftOption => ({
  key: `option-${(optionKey += 1)}`,
  label,
});

/**
 * Add / Edit Custom Field.
 *
 * Remounted per target by the caller's `key`, so opening a different field never shows
 * the previous one's draft.
 */
export function CustomFieldDrawer({
  state,
  onClose,
  onSaved,
}: {
  state: CustomFieldFormState | null;
  onClose: () => void;
  onSaved: (field: LeadCustomField, mode: "create" | "edit") => void;
}) {
  if (!state) return null;
  return (
    <CustomFieldForm
      key={state.mode === "edit" ? state.field.id : "create"}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function CustomFieldForm({
  state,
  onClose,
  onSaved,
}: {
  state: CustomFieldFormState;
  onClose: () => void;
  onSaved: (field: LeadCustomField, mode: "create" | "edit") => void;
}) {
  const editing = state.mode === "edit" ? state.field : null;

  const [type, setType] = useState<LeadCustomFieldType | null>(
    editing?.type ?? null,
  );
  const [label, setLabel] = useState(editing?.name ?? "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [options, setOptions] = useState<DraftOption[]>(() =>
    editing && editing.options.length > 0
      ? [...editing.options]
          .sort((a, b) => a.position - b.position)
          .map((option) => newOption(option.label))
      : [newOption()],
  );

  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isDropDown = type === "DROP_DOWN";
  const trimmed = label.trim();

  const labelError =
    trimmed === ""
      ? "Field Label is required."
      : trimmed.length > MAX_FIELD_LABEL
        ? `Field Label must be ${MAX_FIELD_LABEL} characters or fewer.`
        : undefined;
  const typeError = type === null ? "Field Type is required." : undefined;

  const filled = options.map((option) => option.label.trim()).filter(Boolean);
  const optionError = !isDropDown
    ? undefined
    : filled.length === 0
      ? "A Drop Down field needs at least one option."
      : new Set(filled.map((value) => value.toLowerCase())).size !==
          filled.length
        ? "An option cannot be listed twice."
        : undefined;

  const invalid = Boolean(labelError ?? typeError ?? optionError);

  const setOption = (key: string, value: string) => {
    setFormError(null);
    setOptions((current) =>
      current.map((option) =>
        option.key === key ? { ...option, label: value } : option,
      ),
    );
  };

  const submit = async () => {
    if (busy) return;
    if (invalid || type === null) {
      setTouched(true);
      setFormError("Fix the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    const payload = {
      name: trimmed,
      type,
      isActive,
      // Position is sent explicitly rather than implied by the array's order.
      ...(isDropDown
        ? {
            options: options
              .map((option) => option.label.trim())
              .filter(Boolean)
              .map((value, index) => ({ label: value, position: index + 1 })),
          }
        : {}),
    };

    try {
      const saved = editing
        ? await updateCustomField(editing.id, payload)
        : await createCustomField(payload);
      onSaved(saved, editing ? "edit" : "create");
    } catch (error: unknown) {
      // The drawer stays open: a refused save must not look like a success.
      setFormError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save this custom field.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      onClose={busy ? () => undefined : onClose}
      title={editing ? "Edit Custom Field" : "Add Custom Field"}
      footer={
        <>
          <Button
            variant="ghost"
            aria-label="Cancel"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            aria-label="Save Custom Field"
            onClick={() => void submit()}
            isLoading={busy}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {formError && <FormError>{formError}</FormError>}

        <FormField
          label="Field Type"
          required
          error={touched ? typeError : undefined}
        >
          <SearchableSelect
            portal
            size="lg"
            id="custom-field-type"
            aria-label="Field Type"
            searchable={false}
            placeholder="Field Type"
            options={[...CUSTOM_FIELD_TYPE_OPTIONS]}
            value={type}
            onChange={(next) => {
              setTouched(true);
              setFormError(null);
              setType(next as LeadCustomFieldType | null);
            }}
            invalid={touched && Boolean(typeError)}
          />
        </FormField>

        <FormField
          label="Field Label"
          required
          error={touched ? labelError : undefined}
        >
          {(control) => (
            <Input
              {...control}
              size="lg"
              value={label}
              placeholder="Field Label"
              onChange={(event) => {
                setTouched(true);
                setFormError(null);
                setLabel(event.target.value);
              }}
            />
          )}
        </FormField>

        {/* The reference's filled status row, with its information icon. */}
        <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
          <SettingLabel htmlFor="custom-field-status" className="cursor-pointer">
            Status : {isActive ? "Active" : "Inactive"}
          </SettingLabel>
          <Switch
            id="custom-field-status"
            aria-label="Custom field status"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
        </div>

        {/*
          The option editor. No capture shows it, so it follows the project's own
          drag-and-reorder idiom rather than introducing a second one (ADR-0072).
        */}
        {isDropDown && (
          <OptionEditor
            options={options}
            error={touched ? optionError : undefined}
            onChange={setOption}
            onAdd={() => {
              setFormError(null);
              setOptions((current) => [...current, newOption()]);
            }}
            onRemove={(key) => {
              setFormError(null);
              setOptions((current) =>
                current.length === 1
                  ? current
                  : current.filter((option) => option.key !== key),
              );
            }}
            onReorder={(from, to) => {
              setOptions((current) => {
                if (from === to) return current;
                const next = current.filter((option) => option.key !== from);
                const moved = current.find((option) => option.key === from);
                if (!moved) return current;
                next.splice(
                  next.findIndex((option) => option.key === to),
                  0,
                  moved,
                );
                return next;
              });
            }}
          />
        )}
      </div>
    </Drawer>
  );
}

/**
 * The Drop Down field's options: add, edit, remove and reorder, in the order the form
 * will offer them.
 *
 * The held row lives in a ref as well as in state — `dragover` can fire in the same tick
 * as `dragstart`, and a handler reading only the state would drop the first reorder.
 */
function OptionEditor({
  options,
  error,
  onChange,
  onAdd,
  onRemove,
  onReorder,
}: {
  options: DraftOption[];
  error?: string;
  onChange: (key: string, value: string) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onReorder: (from: string, to: string) => void;
}) {
  const dragging = useRef<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-muted">
          Options <span className="text-danger">*</span>
        </span>
        <Button size="sm" variant="ghost" aria-label="Add Option" onClick={onAdd}>
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          Add Option
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {options.map((option, index) => (
          <li
            key={option.key}
            draggable
            onDragStart={() => {
              dragging.current = option.key;
              setDragKey(option.key);
            }}
            onDragEnd={() => {
              dragging.current = null;
              setDragKey(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              const held = dragging.current;
              if (held && held !== option.key) onReorder(held, option.key);
            }}
            className={cn(
              "flex items-center gap-2",
              dragKey === option.key && "opacity-60",
            )}
          >
            <span
              aria-hidden="true"
              className="shrink-0 cursor-grab text-ink-subtle"
            >
              <IconGripVertical size={16} stroke={1.75} />
            </span>
            <Input
              className="min-w-0 flex-1"
              aria-label={`Option ${index + 1}`}
              value={option.label}
              placeholder={`Option ${index + 1}`}
              onChange={(event) => onChange(option.key, event.target.value)}
              onKeyDown={(event) => {
                // Arrow keys reorder from the keyboard: HTML5 drag reaches neither a
                // keyboard nor a touch screen.
                if (!event.altKey) return;
                const target =
                  options[index + (event.key === "ArrowUp" ? -1 : 1)];
                if (
                  (event.key === "ArrowUp" || event.key === "ArrowDown") &&
                  target
                ) {
                  event.preventDefault();
                  onReorder(option.key, target.key);
                }
              }}
            />
            <Tooltip content="Remove">
              <button
                type="button"
                aria-label={`Remove Option ${index + 1}`}
                disabled={options.length === 1}
                onClick={() => onRemove(option.key)}
                className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconTrash size={16} stroke={1.75} aria-hidden="true" />
              </button>
            </Tooltip>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
