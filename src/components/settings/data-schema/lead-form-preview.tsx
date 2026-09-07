"use client";

import { IconFileDescription } from "@tabler/icons-react";
import { Modal } from "@/components/ui/Modal";
import type { BuilderField } from "./lead-form-builder";

/**
 * The builder's Preview.
 *
 * Renders the **current draft**, never a saved record: the point is to see the form
 * before committing to it, so nothing here calls an API and nothing is written
 * (ADR-0073). Read-only throughout — every control is disabled.
 */
export function LeadFormPreview({
  open,
  onClose,
  fields,
  sections,
}: {
  open: boolean;
  onClose: () => void;
  fields: BuilderField[];
  sections: string[];
}) {
  const visible = fields.filter((field) => field.isVisible);
  const ungrouped = visible.filter((field) => field.sectionName === null);
  const grouped = sections
    .map((section) => ({
      section,
      fields: visible.filter((field) => field.sectionName === section),
    }))
    .filter((group) => group.fields.length > 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Lead Form"
    >
      <div className="flex flex-col gap-4">
        {/* The reference's own subtitle, under the dialog's "Lead Form" heading. */}
        <p className="-mt-2 flex items-center gap-2 text-sm text-ink-muted">
          <IconFileDescription size={16} stroke={1.75} aria-hidden="true" />
          Preview
        </p>

        {visible.length === 0 && (
          <p className="text-sm text-ink-muted">
            Every field on this form is hidden, so the form would render empty.
          </p>
        )}

        {ungrouped.map((field) => (
          <PreviewField key={field.fieldKey} field={field} />
        ))}

        {grouped.map((group) => (
          <section key={group.section} className="flex flex-col gap-4">
            <h3 className="border-b border-hairline pb-1 text-sm font-semibold text-ink">
              {group.section}
            </h3>
            {group.fields.map((field) => (
              <PreviewField key={field.fieldKey} field={field} />
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}

/**
 * One field as the Lead form would draw it — the reference shows the label inside the
 * box with its required marker, so that is what the preview shows.
 */
function PreviewField({ field }: { field: BuilderField }) {
  const isDropdown =
    field.type === "DROP_DOWN" ||
    field.type === "SELECT" ||
    field.type === "MULTI_SELECT";

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={
          field.type === "TEXTBOX"
            ? "flex min-h-20 items-start rounded-control border border-hairline bg-surface px-4 py-3"
            : "flex min-h-control-lg items-center rounded-control border border-hairline bg-surface px-4 py-2"
        }
      >
        <span className="text-sm text-ink">
          {field.label}
          {field.isRequired && <span className="text-danger"> *</span>}
        </span>
      </div>

      {/*
        A Drop Down shows the options it is actually configured with, so a preview proves
        the option list rather than implying one.
      */}
      {isDropdown && field.options.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {field.options.slice(0, 6).map((option) => (
            <span
              key={option}
              className="max-w-[min(14rem,60vw)] truncate rounded-full bg-canvas px-2.5 py-0.5 text-xs text-ink-muted"
            >
              {option}
            </span>
          ))}
          {field.options.length > 6 && (
            <span className="px-1 py-0.5 text-xs text-ink-subtle">
              +{field.options.length - 6}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
