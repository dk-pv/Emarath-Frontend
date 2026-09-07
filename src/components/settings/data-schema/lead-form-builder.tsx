"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconEye,
  IconEyeOff,
  IconGripVertical,
  IconInfoCircle,
  IconPlus,
} from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  FIELD_TYPE_LABELS,
  MAX_FORM_NAME,
  createLeadForm,
  fetchAvailableFormFields,
  fetchLeadForm,
  updateLeadForm,
  type AvailableFormField,
  type LeadForm,
} from "@/services/data-schema-service";
import {
  CustomFieldDrawer,
  type CustomFieldFormState,
} from "./custom-field-drawer";
import { CreateSectionDrawer } from "./create-section-drawer";
import { LeadFormPreview } from "./lead-form-preview";

/** A row of the builder: a catalogue field plus where this form puts it. */
export type BuilderField = AvailableFormField & {
  isVisible: boolean;
  sectionName: string | null;
};

/** The Quick Add presets. Each names only fields the catalogue already has. */
const QUICK_ADD_PRESETS = [
  {
    key: "contact",
    label: "Contact details",
    description: "Names, phones and email",
    keys: ["firstName", "secondaryPhone", "email", "language", "source"],
  },
  {
    key: "sales",
    label: "Sales",
    description: "Products, quantities and amounts",
    keys: [
      "product",
      "productQty",
      "product2",
      "product2Qty",
      "actualAmount",
      "forecastedAmount",
      "paymentMethod",
    ],
  },
  {
    key: "address",
    label: "Delivery address",
    description: "Country through national code",
    keys: ["country", "state", "street", "city", "nationalCode"],
  },
  {
    key: "followup",
    label: "Follow-up",
    description: "Assignment, tags and call tracking",
    keys: [
      "assignedAgentIds",
      "tagIds",
      "callStatus",
      "callAttempts",
      "msgAttempts",
      "bookingDate",
    ],
  },
] as const;

/**
 * Settings → Data & Schema Management → Form Customization → Add / Edit Lead Form.
 *
 * A page, not a dialog, because the reference gives it its own route
 * (`…/form-customization/create`) and its two panels need the width. The module is fixed
 * to LEAD and has no selector: the reference's own form does not offer one (ADR-0073).
 */
export function LeadFormBuilder({ formId }: { formId?: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [catalogue, setCatalogue] = useState<AvailableFormField[] | null>(null);
  const [existing, setExisting] = useState<LeadForm | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  /** Selected fields, in order. Available is the catalogue minus these. */
  const [selected, setSelected] = useState<BuilderField[]>([]);
  const [sections, setSections] = useState<string[]>([]);

  const [tab, setTab] = useState<"add" | "quick">("add");
  const [availableQuery, setAvailableQuery] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [fieldForm, setFieldForm] = useState<CustomFieldFormState | null>(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dragging = useRef<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const reloadCatalogue = useCallback(
    () => setReloadToken((token) => token + 1),
    [],
  );

  /** The draft is seeded once — from the saved form, or from the four required fields. */
  const seeded = useRef(false);
  const seedDraft = (
    fields: AvailableFormField[],
    form: LeadForm | null,
  ): void => {
    if (!form) {
      // A new form starts with exactly the four the create API requires.
      setSelected(
        fields
          .filter((field) => field.isRequired)
          .map((field) => ({ ...field, isVisible: true, sectionName: null })),
      );
      return;
    }

    const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
    setName(form.name);
    setIsActive(form.isActive);
    setIsDefault(form.isDefault);
    setSections(
      [...form.sections]
        .sort((a, b) => a.position - b.position)
        .map((section) => section.name),
    );
    setSelected(
      [...form.fields]
        .sort((a, b) => a.position - b.position)
        .map((field) => {
          const meta = byKey.get(field.fieldKey);
          return {
            fieldKey: field.fieldKey,
            label: field.label,
            isRequired: field.isRequired,
            source: field.source,
            type: meta?.type ?? "TEXT",
            options: meta?.options ?? [],
            isVisible: field.isVisible,
            sectionName: field.sectionName,
          };
        }),
    );
  };

  /*
    The catalogue and (when editing) the saved form load together. A catalogue refresh
    after creating a field deliberately does NOT reset the draft: `selected` is state the
    user owns from here on, and only new catalogue entries change.
  */
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    Promise.all([
      fetchAvailableFormFields(controller.signal),
      formId ? fetchLeadForm(formId, controller.signal) : Promise.resolve(null),
    ])
      .then(([fields, form]) => {
        if (!active) return;
        setCatalogue(fields);
        setFailed(false);
        if (form) setExisting(form);
        // Seeded once per load; a catalogue refresh after creating a field keeps the draft.
        if (seeded.current) return;
        seeded.current = true;
        seedDraft(fields, form);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setFailed(
          error instanceof ApiError && error.status === 403
            ? "forbidden"
            : "error",
        );
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [formId, reloadToken]);

  const selectedKeys = useMemo(
    () => new Set(selected.map((field) => field.fieldKey)),
    [selected],
  );
  const available = useMemo(
    () => (catalogue ?? []).filter((f) => !selectedKeys.has(f.fieldKey)),
    [catalogue, selectedKeys],
  );

  const trimmed = name.trim();
  const nameError =
    trimmed === ""
      ? "Form Name is required."
      : trimmed.length > MAX_FORM_NAME
        ? `Form Name must be ${MAX_FORM_NAME} characters or fewer.`
        : undefined;

  const add = (field: AvailableFormField) => {
    setFormError(null);
    // The key is the identity, so a field can never be added twice.
    setSelected((current) =>
      current.some((item) => item.fieldKey === field.fieldKey)
        ? current
        : [...current, { ...field, isVisible: true, sectionName: null }],
    );
  };

  const remove = (field: BuilderField) => {
    if (field.isRequired) {
      setFormError(
        `${field.label} is required to create a lead, so it stays on the form.`,
      );
      return;
    }
    setFormError(null);
    setSelected((current) =>
      current.filter((item) => item.fieldKey !== field.fieldKey),
    );
  };

  const patch = (fieldKey: string, change: Partial<BuilderField>) => {
    setFormError(null);
    setSelected((current) =>
      current.map((field) =>
        field.fieldKey === fieldKey ? { ...field, ...change } : field,
      ),
    );
  };

  const reorder = (from: string, to: string) => {
    setSelected((current) => {
      if (from === to) return current;
      const moved = current.find((field) => field.fieldKey === from);
      if (!moved) return current;
      const next = current.filter((field) => field.fieldKey !== from);
      next.splice(
        next.findIndex((field) => field.fieldKey === to),
        0,
        moved,
      );
      return next;
    });
  };

  const applyPreset = (keys: readonly string[]) => {
    setFormError(null);
    const byKey = new Map((catalogue ?? []).map((f) => [f.fieldKey, f]));
    setSelected((current) => {
      const have = new Set(current.map((field) => field.fieldKey));
      const added = keys
        .filter((key) => !have.has(key))
        .map((key) => byKey.get(key))
        .filter((field): field is AvailableFormField => Boolean(field))
        .map((field) => ({ ...field, isVisible: true, sectionName: null }));
      // Appended in the preset's own order, so applying one twice is a no-op.
      return [...current, ...added];
    });
  };

  const submit = async () => {
    if (busy) return;
    if (nameError) {
      setTouched(true);
      setFormError("Fix the highlighted fields and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    const payload = {
      name: trimmed,
      module: "LEAD" as const,
      isActive,
      isDefault,
      // Position is the persisted order, sent explicitly rather than implied.
      fields: selected.map((field, index) => ({
        fieldKey: field.fieldKey,
        position: index + 1,
        isVisible: field.isRequired ? true : field.isVisible,
        sectionName: field.sectionName,
      })),
      sections: sections.map((section, index) => ({
        name: section,
        position: index + 1,
      })),
    };

    try {
      const saved = formId
        ? await updateLeadForm(formId, payload)
        : await createLeadForm(payload);
      toast({
        title: formId ? `${saved.name} saved` : `${saved.name} added`,
        tone: "success",
      });
      router.push("/settings/data-schema/form-customization");
    } catch (error: unknown) {
      // The draft survives: a refused save must not cost the user their work.
      setFormError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save this form.",
      );
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col p-0">
        <ErrorState
          className="py-16"
          title={
            failed === "forbidden"
              ? "You don't have access to these settings"
              : "Couldn't load the form builder"
          }
          description={
            failed === "forbidden"
              ? "Schema management is limited to administrator accounts. Sign in as an administrator and try again."
              : "The field catalogue could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setFailed(false);
            reloadCatalogue();
          }}
        />
      </Card>
    );
  }

  const loading = catalogue === null || (formId !== undefined && !existing);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <div className="shrink-0 border-b border-hairline p-5">
        <h2 className="text-xl font-semibold text-ink">Form Customization</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Control form fields, layout, and visibility
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
        <div className="flex flex-col gap-5 border-b border-hairline p-5">
          {formError && <FormError>{formError}</FormError>}

          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label
                htmlFor="lead-form-name"
                className="flex items-center gap-1 text-sm text-ink-muted"
              >
                Form Name <span className="text-danger">*</span>
              </label>
              <Input
                size="lg"
                id="lead-form-name"
                placeholder="Add a Form Name"
                value={name}
                aria-invalid={touched && nameError ? true : undefined}
                aria-describedby={
                  touched && nameError ? "lead-form-name-error" : undefined
                }
                onChange={(event) => {
                  setTouched(true);
                  setFormError(null);
                  setName(event.target.value);
                }}
              />
              {touched && nameError && (
                <p
                  id="lead-form-name-error"
                  role="alert"
                  className="text-sm text-danger"
                >
                  {nameError}
                </p>
              )}
            </div>

            <div className="flex flex-col justify-end gap-3 sm:flex-row sm:items-end">
              <div className="flex min-h-control-lg flex-1 items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
                <SettingLabel
                  htmlFor="lead-form-status"
                  className="cursor-pointer"
                >
                  Status : {isActive ? "Active" : "Inactive"}
                </SettingLabel>
                <Switch
                  id="lead-form-status"
                  aria-label="Form status"
                  checked={isActive}
                  // The default is what everyone fills in, so it cannot be switched off.
                  disabled={isDefault}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
              </div>

              {/*
                Only while editing. The reference's create screen carries Form Name and
                Status and nothing else — a new form becomes the default by being edited,
                which is also the only moment the "which form loses it" question is real.
              */}
              {formId && (
                <div className="flex min-h-control-lg flex-1 items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
                  <SettingLabel
                    htmlFor="lead-form-default"
                    className="cursor-pointer"
                  >
                    Default Form
                  </SettingLabel>
                  <Switch
                    id="lead-form-default"
                    aria-label="Default form"
                    checked={isDefault}
                    // Clearing the default here would leave the module with none; another
                    // form is made default instead, which clears this one server-side.
                    disabled={existing?.isDefault === true}
                    onChange={(event) => {
                      setIsDefault(event.target.checked);
                      if (event.target.checked) setIsActive(true);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* The reference's two tabs, Add active by default. */}
          <div
            role="tablist"
            aria-label="Field picker"
            className="flex items-center gap-6 border-b border-hairline"
          >
            {(
              [
                ["add", "Add"],
                ["quick", "Quick Add"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "focus-ring -mb-px border-b-2 px-1 pb-3 text-sm transition-colors duration-(--duration-shell) ease-shell",
                  tab === key
                    ? "border-brand font-medium text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2" aria-hidden="true">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          ) : tab === "quick" ? (
            <QuickAdd
              presets={QUICK_ADD_PRESETS}
              catalogue={catalogue ?? []}
              selectedKeys={selectedKeys}
              onApply={applyPreset}
            />
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <Panel
                title="Available Options"
                tone="available"
                count={available.length}
                query={availableQuery}
                onQuery={setAvailableQuery}
                action={
                  <Button
                    size="sm"
                    aria-label="Create Field"
                    onClick={() => setFieldForm({ mode: "create" })}
                  >
                    <IconPlus size={16} stroke={2} aria-hidden="true" />
                    Create Field
                  </Button>
                }
              >
                {available
                  .filter((field) => matches(field, availableQuery))
                  .map((field) => (
                    <FieldRow
                      key={field.fieldKey}
                      field={{
                        ...field,
                        isVisible: true,
                        sectionName: null,
                      }}
                      tone="available"
                      onActivate={() => add(field)}
                    />
                  ))}
              </Panel>

              <Panel
                title="Selected Options"
                tone="selected"
                count={selected.length}
                query={selectedQuery}
                onQuery={setSelectedQuery}
                action={
                  <>
                    <Button
                      size="sm"
                      aria-label="Create Section"
                      onClick={() => setSectionOpen(true)}
                    >
                      <IconPlus size={16} stroke={2} aria-hidden="true" />
                      Create Section
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Preview"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <IconEye size={16} stroke={1.75} aria-hidden="true" />
                      Preview
                    </Button>
                  </>
                }
              >
                {selected
                  .filter((field) => matches(field, selectedQuery))
                  .map((field) => (
                    <FieldRow
                      key={field.fieldKey}
                      field={field}
                      tone="selected"
                      sections={sections}
                      dimmed={dragKey === field.fieldKey}
                      onActivate={() => remove(field)}
                      onVisibility={(visible) =>
                        patch(field.fieldKey, { isVisible: visible })
                      }
                      onSection={(section) =>
                        patch(field.fieldKey, { sectionName: section })
                      }
                      onDragStart={() => {
                        dragging.current = field.fieldKey;
                        setDragKey(field.fieldKey);
                      }}
                      onDragEnd={() => {
                        dragging.current = null;
                        setDragKey(null);
                      }}
                      onDragOver={() => {
                        const held = dragging.current;
                        if (held && held !== field.fieldKey)
                          reorder(held, field.fieldKey);
                      }}
                      onStep={(delta) => {
                        const index = selected.findIndex(
                          (item) => item.fieldKey === field.fieldKey,
                        );
                        const target = selected[index + delta];
                        if (target) reorder(field.fieldKey, target.fieldKey);
                      }}
                    />
                  ))}
              </Panel>
            </div>
          )}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-canvas p-5">
        <Button
          variant="ghost"
          aria-label="Cancel"
          disabled={busy}
          onClick={() => router.push("/settings/data-schema/form-customization")}
        >
          Cancel
        </Button>
        <Button
          aria-label="Save Lead Form"
          onClick={() => void submit()}
          isLoading={busy}
        >
          Save
        </Button>
      </footer>

      {/* Creating a field from here refreshes the catalogue and keeps the draft. */}
      <CustomFieldDrawer
        state={fieldForm}
        onClose={() => setFieldForm(null)}
        onSaved={(field) => {
          setFieldForm(null);
          toast({ title: `${field.name} added`, tone: "success" });
          reloadCatalogue();
        }}
      />

      <CreateSectionDrawer
        open={sectionOpen}
        existing={sections}
        onClose={() => setSectionOpen(false)}
        onCreate={(section) => {
          setSections((current) => [...current, section]);
          setSectionOpen(false);
          toast({ title: `${section} added`, tone: "success" });
        }}
      />

      <LeadFormPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        fields={selected}
        sections={sections}
      />
    </Card>
  );
}

/** Case-insensitive across the label and the stable key. */
function matches(field: { label: string; fieldKey: string }, query: string) {
  const term = query.trim().toLowerCase();
  if (term === "") return true;
  return (
    field.label.toLowerCase().includes(term) ||
    field.fieldKey.toLowerCase().includes(term)
  );
}

function Panel({
  title,
  tone,
  count,
  query,
  onQuery,
  action,
  children,
}: {
  title: string;
  tone: "available" | "selected";
  count: number;
  query: string;
  onQuery: (value: string) => void;
  action: React.ReactNode;
  children: React.ReactNode;
}) {
  const rows = Array.isArray(children) ? children.flat() : [children];
  const empty = rows.filter(Boolean).length === 0;

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-control border border-hairline">
      <header
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 text-white",
          tone === "available" ? "bg-indigo-400" : "bg-brand",
        )}
      >
        <h3 className="truncate text-base font-semibold">{title}</h3>
        <span className="shrink-0 rounded-full bg-surface px-3 py-0.5 text-xs font-medium text-ink">
          {count} {count === 1 ? "Field" : "Fields"}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-3">
        {/* A minimum width, so a crowded panel wraps its buttons instead of crushing
            the search box down to an ellipsis. */}
        <span className="min-w-40 flex-1">
          <PanelSearch
            aria-label={`Search ${title}`}
            placeholder="Search field..."
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </span>
        {action}
      </div>

      <ul
        role="listbox"
        aria-label={title}
        className="scrollbar-slim flex max-h-[26rem] min-h-40 flex-col gap-2 overflow-y-auto p-3"
        onDragOver={(event) => event.preventDefault()}
      >
        {children}
        {empty && (
          <li className="px-1 py-3 text-sm text-ink-muted">
            {query.trim() === ""
              ? "No fields"
              : "No field matches that search"}
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * One field row.
 *
 * Carries no buttons in the Available panel, matching the reference — a row is a listbox
 * option that moves on click, Enter or Space, and reorders on Arrow Up/Down. HTML5 drag
 * alone is unusable on a touch screen and unreachable from a keyboard.
 */
function FieldRow({
  field,
  tone,
  sections = [],
  dimmed = false,
  onActivate,
  onVisibility,
  onSection,
  onDragStart,
  onDragEnd,
  onDragOver,
  onStep,
}: {
  field: BuilderField;
  tone: "available" | "selected";
  sections?: string[];
  dimmed?: boolean;
  onActivate: () => void;
  onVisibility?: (visible: boolean) => void;
  onSection?: (section: string | null) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
  onStep?: (delta: -1 | 1) => void;
}) {
  const typeLabel = FIELD_TYPE_LABELS[field.type] ?? field.type;
  const hint = [
    field.label,
    typeLabel,
    field.source === "SYSTEM" ? "System field" : "Custom field",
    field.isRequired ? "Required" : "Optional",
  ].join(" · ");

  return (
    <li
      role="option"
      aria-selected={tone === "selected"}
      tabIndex={0}
      draggable={tone === "selected"}
      aria-label={`${field.label}, ${tone === "selected" ? "selected" : "available"}`}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate();
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          onStep?.(event.key === "ArrowUp" ? -1 : 1);
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver?.();
      }}
      className={cn(
        "focus-ring flex items-center gap-2 rounded-control border px-3 py-3 text-sm transition-colors duration-(--duration-shell) ease-shell",
        tone === "selected"
          ? "cursor-grab border-rose-200 bg-rose-50 text-ink"
          : "cursor-pointer border-hairline bg-surface text-ink hover:border-brand/40",
        dimmed && "opacity-60",
      )}
    >
      <IconGripVertical
        size={16}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0 text-ink-subtle"
      />
      <span className="min-w-0 flex-1 truncate">{field.label}</span>

      {tone === "selected" && field.sectionName && (
        <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-muted">
          {field.sectionName}
        </span>
      )}

      {tone === "selected" && sections.length > 0 && onSection && (
        <select
          aria-label={`${field.label} section`}
          value={field.sectionName ?? ""}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            onSection(event.target.value === "" ? null : event.target.value);
          }}
          className="focus-ring h-7 max-w-28 shrink-0 rounded-control border border-hairline bg-surface px-1 text-xs text-ink"
        >
          <option value="">No section</option>
          {sections.map((section) => (
            <option key={section} value={section}>
              {section}
            </option>
          ))}
        </select>
      )}

      {tone === "selected" && onVisibility && (
        <Tooltip content={field.isVisible ? "Visible" : "Hidden"}>
          <button
            type="button"
            aria-label={`${field.label} visibility`}
            aria-pressed={field.isVisible}
            disabled={field.isRequired}
            onClick={(event) => {
              event.stopPropagation();
              onVisibility(!field.isVisible);
            }}
            className="focus-ring flex size-7 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {field.isVisible ? (
              <IconEye size={16} stroke={1.75} aria-hidden="true" />
            ) : (
              <IconEyeOff size={16} stroke={1.75} aria-hidden="true" />
            )}
          </button>
        </Tooltip>
      )}

      <Tooltip content={hint} portal>
        <span
          aria-label={`${field.label} details`}
          tabIndex={0}
          onClick={(event) => event.stopPropagation()}
          className="focus-ring inline-flex size-5 shrink-0 items-center justify-center rounded-full text-ink-subtle"
        >
          <IconInfoCircle size={15} stroke={1.75} aria-hidden="true" />
        </span>
      </Tooltip>
    </li>
  );
}

/**
 * Quick Add: apply a preset of fields the catalogue already has.
 *
 * No capture shows this tab's contents, so it does the one thing its name states and
 * nothing more — it selects existing fields, never invents any. Applying a preset keeps
 * what is already selected, adds only what is missing, and leaves the user free to keep
 * editing (ADR-0073).
 */
function QuickAdd({
  presets,
  catalogue,
  selectedKeys,
  onApply,
}: {
  presets: typeof QUICK_ADD_PRESETS;
  catalogue: AvailableFormField[];
  selectedKeys: Set<string>;
  onApply: (keys: readonly string[]) => void;
}) {
  const known = new Set(catalogue.map((field) => field.fieldKey));

  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {presets.map((preset) => {
        const keys = preset.keys.filter((key) => known.has(key));
        const missing = keys.filter((key) => !selectedKeys.has(key));
        return (
          <div
            key={preset.key}
            className="flex flex-col gap-3 rounded-control border border-hairline p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{preset.label}</p>
              <p className="text-xs text-ink-muted">{preset.description}</p>
            </div>
            <p className="text-xs text-ink-subtle">
              {keys.length} field{keys.length === 1 ? "" : "s"} ·{" "}
              {missing.length === 0
                ? "all already selected"
                : `${missing.length} to add`}
            </p>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Add ${preset.label}`}
              disabled={missing.length === 0}
              onClick={() => onApply(keys)}
              className="self-start"
            >
              <IconPlus size={16} stroke={2} aria-hidden="true" />
              Add these fields
            </Button>
          </div>
        );
      })}
    </div>
  );
}
