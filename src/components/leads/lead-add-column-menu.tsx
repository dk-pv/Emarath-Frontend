"use client";

import { useRef } from "react";
import type { Icon } from "@tabler/icons-react";
import {
  IconCalendar,
  IconCalendarTime,
  IconForms,
  IconHash,
  IconLetterT,
  IconPlus,
} from "@tabler/icons-react";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

/**
 * The field types the Add Column menu offers, from
 * `leads-add-column-dropdown-open-field-type.png`: each a labelled row with its
 * glyph in a soft-green square.
 */
const FIELD_TYPES: { id: string; label: string; Icon: Icon }[] = [
  { id: "text", label: "Text", Icon: IconLetterT },
  { id: "textbox", label: "Text Box", Icon: IconForms },
  { id: "number", label: "Number", Icon: IconHash },
  { id: "date", label: "Date", Icon: IconCalendar },
  { id: "datetime", label: "Date Time", Icon: IconCalendarTime },
];

/**
 * The Leads "Add Column" toolbar control (LEAD-05.1). Workpex opens a "Field Type"
 * menu; choosing a type then leads to a form that names the column — a step no
 * screenshot captures, so it is intentionally not built. Selecting a type only
 * closes the menu here, and nothing is persisted, until that flow (and its API)
 * exist. Built from the same disclosure/dismiss hooks as the other poppers rather
 * than a new primitive.
 */
export function LeadAddColumnMenu() {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();

  useDismissable(root, isOpen, close);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        className="inline-flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink focus-ring"
      >
        <IconPlus size={18} stroke={1.75} />
        Add Column
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-56 rounded-surface border border-hairline bg-surface py-1 shadow-lg"
        >
          <p className="px-4 py-2 text-sm text-ink-subtle">Field Type</p>
          {FIELD_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              onClick={close}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[15px] text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-subtle focus-ring-inset"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-strong">
                <Icon size={18} stroke={1.75} aria-hidden="true" />
              </span>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
