"use client";

import { useRef, useState } from "react";
import type { Icon } from "@tabler/icons-react";
import {
  IconArrowLeft,
  IconCalendar,
  IconCalendarTime,
  IconForms,
  IconHash,
  IconLetterT,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { ApiError } from "@/lib/api-client";
import {
  createLeadCustomField,
  type LeadCustomField,
  type LeadCustomFieldType,
} from "@/services/leads-custom-fields-service";

/**
 * The field types the Add Column menu offers, from
 * `leads-add-column-dropdown-open-field-type.png`: each a labelled row with its
 * glyph in a soft-green square.
 */
const FIELD_TYPES: { type: LeadCustomFieldType; label: string; Icon: Icon }[] =
  [
    { type: "TEXT", label: "Text", Icon: IconLetterT },
    { type: "TEXTBOX", label: "Text Box", Icon: IconForms },
    { type: "NUMBER", label: "Number", Icon: IconHash },
    { type: "DATE", label: "Date", Icon: IconCalendar },
    { type: "DATETIME", label: "Date Time", Icon: IconCalendarTime },
  ];

/**
 * The Leads "Add Column" toolbar control (LEAD-05.1, ADR-0051). From
 * `leads-add-column-dropdown-open-field-type.png`: Add Column opens a "Field Type"
 * menu of five types; choosing one opens a small name form that creates a persisted
 * custom field. The name-entry step has no screenshot, so it reuses this menu's own
 * input styling (flagged). On success the parent refreshes, so the new column appears
 * in Manage Columns and the table.
 */
export function LeadAddColumnMenu({
  onCreated,
}: {
  onCreated: (field: LeadCustomField) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [type, setType] = useState<LeadCustomFieldType | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setType(null);
    setName("");
    setBusy(false);
    setError(null);
  };
  const closeAndReset = () => {
    close();
    reset();
  };
  useDismissable(root, isOpen, closeAndReset);

  const submit = async () => {
    if (!type) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Field name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const field = await createLeadCustomField({ name: trimmed, type });
      onCreated(field);
      closeAndReset();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.messages.join(" · ") || err.message
          : "Couldn’t create the column",
      );
      setBusy(false);
    }
  };

  const activeType = FIELD_TYPES.find((entry) => entry.type === type);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeAndReset() : toggle())}
        className={TOOLBAR_BUTTON_CLASS}
      >
        <IconPlus size={18} stroke={1.75} />
        Add Column
      </button>

      {isOpen && !activeType && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-56 rounded-surface border border-hairline bg-surface py-1 shadow-lg"
        >
          <p className="px-4 py-2 text-sm text-ink-subtle">Field Type</p>
          {FIELD_TYPES.map(({ type: fieldType, label, Icon }) => (
            <button
              key={fieldType}
              type="button"
              role="menuitem"
              onClick={() => {
                setType(fieldType);
                setError(null);
              }}
              className="focus-ring-inset flex w-full items-center gap-3 px-3 py-2 text-left text-[15px] text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-strong">
                <Icon size={18} stroke={1.75} aria-hidden="true" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}

      {isOpen && activeType && (
        <div
          role="dialog"
          aria-label={`New ${activeType.label} column`}
          className="absolute top-[calc(100%+8px)] right-0 z-50 w-72 rounded-surface border border-hairline bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Back to field types"
              onClick={() => {
                setType(null);
                setError(null);
              }}
              className="focus-ring flex size-6 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
            >
              <IconArrowLeft size={16} stroke={2} />
            </button>
            <span className="flex size-6 items-center justify-center rounded-control bg-brand-subtle text-brand-strong">
              <activeType.Icon size={15} stroke={1.75} aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-ink">
              {activeType.label} column
            </span>
          </div>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="Column name"
            aria-label="Column name"
            maxLength={180}
            className="focus-ring h-control-sm w-full rounded-control border border-hairline bg-surface px-field-x text-sm text-ink"
          />
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={closeAndReset}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={() => void submit()} isLoading={busy}>
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
