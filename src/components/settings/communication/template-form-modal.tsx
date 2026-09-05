"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import {
  createMessageTemplate,
  updateMessageTemplate,
  TEMPLATE_TYPE_OPTIONS,
  type MessageTemplate,
  type MessageTemplateType,
  type TemplateInput,
} from "@/services/message-templates-service";

export interface TemplateFormState {
  mode: "create" | "edit";
  template: MessageTemplate | null;
}

type Draft = {
  name: string;
  type: MessageTemplateType | null;
  content: string;
  isActive: boolean;
};

type FieldKey = keyof Draft;

/** The reference's modal opens with the Status switch on, reading "Status : Active". */
const EMPTY: Draft = { name: "", type: null, content: "", isActive: true };

const toDraft = (template: MessageTemplate): Draft => ({
  name: template.name,
  type: template.type,
  content: template.content,
  isActive: template.status === "ACTIVE",
});

/** Markup with no text is an empty editor, however many tags the browser left in it. */
export function editorTextOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z]+;/gi, "")
    .trim();
}

function validate(draft: Draft): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  if (draft.name.trim() === "") errors.name = "Template Name is required.";
  if (draft.type === null) errors.type = "Template Type is required.";
  if (editorTextOf(draft.content) === "") {
    errors.content = "Template Content is required.";
  }
  return errors;
}

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Template Name",
  type: "Template Type",
  content: "Template Content",
  isActive: "Status",
};

/** Attaches each API message to the field it names, as the other settings forms do. */
function mapApiErrors(messages: string[]): {
  fields: Partial<Record<FieldKey, string>>;
  rest: string[];
} {
  const fields: Partial<Record<FieldKey, string>> = {};
  const rest: string[] = [];

  for (const message of messages) {
    const lower = message.toLowerCase();
    const key = (Object.keys(FIELD_LABELS) as FieldKey[]).find(
      (candidate) =>
        lower.includes(candidate.toLowerCase()) ||
        lower.includes(FIELD_LABELS[candidate].toLowerCase()),
    );
    if (key && !fields[key]) fields[key] = message;
    else if (!key) rest.push(message);
  }
  return { fields, rest };
}

/**
 * Add / Edit Template — the Workpex modal from the reference.
 *
 * One modal for both modes, on the shared `Modal`: editing PATCHes the same record so a
 * rename never leaves a second copy behind. Submit sends exactly one request and the
 * modal stays open if the API refuses, with the reason attached to the field it names.
 */
export function TemplateFormModal({
  state,
  onClose,
  onSaved,
}: {
  state: TemplateFormState | null;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}) {
  if (!state) return null;

  /*
    Keyed by the record being edited, so the form is a fresh mount per template rather
    than a component that has to remember to reset itself. Cancelling unmounts it
    entirely, which is why a reopened modal cannot show the last abandoned draft.
  */
  return (
    <TemplateForm
      key={state.template?.id ?? "new"}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function TemplateForm({
  state,
  onClose,
  onSaved,
}: {
  state: TemplateFormState;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    state.template ? toDraft(state.template) : EMPTY,
  );
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [apiErrors, setApiErrors] = useState<Partial<Record<FieldKey, string>>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends FieldKey>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setTouched((current) => ({ ...current, [key]: true }));
    setApiErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  };

  const errors = validate(draft);
  const errorFor = (key: FieldKey) =>
    apiErrors[key] ?? (touched[key] ? errors[key] : undefined);

  const submit = async () => {
    if (busy) return;

    if (Object.keys(errors).length > 0) {
      setTouched({ name: true, type: true, content: true, isActive: true });
      setFormError("Fix the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    setApiErrors({});
    try {
      const input: TemplateInput = {
        name: draft.name.trim(),
        // Guarded by `validate` above, which refuses a null type.
        type: draft.type as MessageTemplateType,
        content: draft.content,
        isActive: draft.isActive,
      };

      const saved =
        state.mode === "edit" && state.template
          ? await updateMessageTemplate(state.template.id, input)
          : await createMessageTemplate(input);

      onSaved(saved.name, state.mode);
    } catch (error: unknown) {
      // The modal deliberately stays open: a refused save must not look like a success.
      if (error instanceof ApiError) {
        const { fields, rest } = mapApiErrors(error.messages);
        setApiErrors(fields);
        setFormError(
          rest[0] ??
            (Object.keys(fields).length > 0
              ? "Fix the highlighted fields and try again."
              : error.message),
        );
      } else {
        setFormError("Could not save this template.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      size="lg"
      title={state.mode === "edit" ? "Edit Template" : "Add Template"}
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
            aria-label="Submit Template"
            onClick={() => void submit()}
            isLoading={busy}
          >
            Submit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {formError && <FormError>{formError}</FormError>}

        {/*
          The reference labels these two fields inside the box and floats the label onto
          the border once the field is in use — the state its Template Type capture shows.
        */}
        <FloatingField
          id="template-name"
          label="Template Name"
          filled={draft.name !== ""}
          error={errorFor("name")}
        >
          <Input
            size="lg"
            id="template-name"
            value={draft.name}
            aria-label="Template Name"
            aria-invalid={errorFor("name") ? true : undefined}
            onChange={(event) => set("name", event.target.value)}
          />
        </FloatingField>

        <FloatingField
          id="template-type"
          label="Template Type"
          filled={draft.type !== null}
          error={errorFor("type")}
        >
          <SearchableSelect
            portal
            size="lg"
            id="template-type"
            aria-label="Template Type"
            searchable={false}
            placeholder=""
            invalid={Boolean(errorFor("type"))}
            options={[...TEMPLATE_TYPE_OPTIONS]}
            value={draft.type}
            onChange={(next) => set("type", next as MessageTemplateType | null)}
          />
        </FloatingField>

        {/* Content carries an ordinary label above the editor, as the reference draws it. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink">
            Template Content
            <Required />
          </span>
          <RichTextEditor
            id="template-content"
            value={draft.content}
            onChange={(html) => set("content", html)}
            invalid={Boolean(errorFor("content"))}
            aria-describedby={
              errorFor("content") ? "template-content-error" : undefined
            }
          />
          {errorFor("content") && (
            <p
              id="template-content-error"
              role="alert"
              className="text-sm text-danger"
            >
              {errorFor("content")}
            </p>
          )}
        </div>

        <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control bg-canvas px-4 py-2">
          <label htmlFor="template-status" className="text-sm text-ink-muted">
            Status : {draft.isActive ? "Active" : "Verification Pending"}
          </label>
          <Switch
            id="template-status"
            aria-label="Template status"
            checked={draft.isActive}
            onChange={(event) => set("isActive", event.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
}

/** The reference marks each required field with a red asterisk after its label. */
function Required() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-danger">
      *
    </span>
  );
}

/**
 * A field whose label sits inside the control until it is used, then lifts onto the
 * border — the Workpex treatment its Template Type capture shows mid-focus.
 *
 * Local to this modal: no other Emarath form draws its labels this way, so nothing shared
 * changes to accommodate it.
 */
function FloatingField({
  id,
  label,
  filled,
  error,
  children,
}: {
  id: string;
  label: string;
  filled: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || filled;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative"
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={() => setFocused(false)}
      >
        {/*
          One label in two places rather than a native placeholder: the reference's
          asterisk is red while the label beside it is grey, which a `placeholder`
          attribute cannot express — it is one uncoloured string.
        */}
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute z-10 transition-all duration-(--duration-shell) ease-shell",
            lifted
              ? "-top-2 left-3 rounded-sm bg-surface px-1 text-xs"
              : "top-1/2 left-4 -translate-y-1/2 text-base",
            error
              ? "text-danger"
              : focused
                ? "text-brand-strong"
                : "text-ink-subtle",
          )}
        >
          {label}
          <Required />
        </label>
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
