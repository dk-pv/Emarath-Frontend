"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { COUNTRIES } from "@/constants/countries";
import {
  fetchSalesCrmGeneral,
  saveSalesCrmGeneral,
  type CustomFieldNames,
  type SalesCrmGeneralSettings,
} from "@/services/settings-service";
import { USER_ROLE_LABELS, type UserRole } from "@/services/users-service";
import type { SelectOption } from "@/types";
import { RadioCard, SettingLabel, ToggleField } from "./setting-controls";

/**
 * Choice sets carrying only the values the Workpex reference actually shows.
 *
 * Every screenshot captures a select's *current value*, never its open panel, so a second
 * option would be invented product vocabulary (CLAUDE.md §16.4). The selects are real —
 * they open, filter, select, clear and persist — and each list grows by one line once the
 * open-state screenshots exist. The backend's `@IsIn` reads from the same three sets, so
 * the two cannot drift.
 */
const DISPLAY_LEAD_OPTIONS: SelectOption[] = [
  { value: "ALL_LEADS", label: "All Leads" },
];
const DISPLAY_ORDER_OPTIONS: SelectOption[] = [
  { value: "BY_DATE", label: "By Date" },
];
const TAG_PERMISSION_OPTIONS: SelectOption[] = [
  { value: "ALL_USERS", label: "All Users" },
];
const NO_ACTIVITY_UNIT_OPTIONS: SelectOption[] = [
  { value: "HOURS", label: "Hours" },
];

/** The app's shipped country dataset — the same source the phone field uses. */
const COUNTRY_OPTIONS: SelectOption[] = COUNTRIES.map((country) => ({
  value: country.iso2,
  label: country.name,
}));

/** The roles the product already defines; no new vocabulary for the masking exemption. */
const MASKING_ROLE_OPTIONS: SelectOption[] = (
  Object.keys(USER_ROLE_LABELS) as UserRole[]
).map((role) => ({ value: role, label: USER_ROLE_LABELS[role] }));

const MASK_DIGIT_OPTIONS: SelectOption[] = Array.from({ length: 8 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

/** Matches the DTO's bounds, so the form refuses what the API would reject anyway. */
const MIN_THRESHOLD = 1;
const MAX_THRESHOLD = 8760;

/** The eight renameable built-in fields, in the reference's column order. */
const FIELD_NAME_ROWS: [keyof CustomFieldNames, keyof CustomFieldNames][] = [
  ["state", "district"],
  ["city", "zipcode"],
  ["actualAmount", "forecastedAmount"],
  ["tag", "category"],
];

const FIELD_NAME_LABELS: Record<keyof CustomFieldNames, string> = {
  state: "State",
  district: "District",
  city: "City",
  zipcode: "Zipcode",
  actualAmount: "Actual Amount",
  forecastedAmount: "Forecasted Amount",
  tag: "Tag",
  category: "Category",
};

/**
 * Settings → Sales & CRM Configuration → General Settings.
 *
 * One form over the whole screen: the API answers with a complete payload (defaults until
 * an administrator saves), the form edits a copy, and Save replaces the payload wholesale
 * — a partial body would reset whatever it omitted.
 *
 * Dirty state is the copy compared against the saved baseline rather than a per-field
 * flag, so Cancel is exactly "go back to the baseline" and Save is disabled when there is
 * nothing to save. The card owns its own scrolling, which is what keeps the action bar on
 * screen without `position: sticky` (the same flex chain the Roles screen uses).
 */
export function GeneralSettingsView() {
  const { toast } = useToast();
  const [saved, setSaved] = useState<SalesCrmGeneralSettings | null>(null);
  const [form, setForm] = useState<SalesCrmGeneralSettings | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchSalesCrmGeneral(controller.signal)
      .then((result) => {
        if (!active) return;
        setSaved(result);
        setForm(result);
        setFailed(false);
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
  }, [reloadToken]);

  const dirty = useMemo(
    () =>
      form !== null &&
      saved !== null &&
      JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  /** Blank labels and an out-of-range threshold, keyed for the inline messages. */
  const errors = useMemo(() => {
    if (!form) return {} as Record<string, string>;
    const found: Record<string, string> = {};
    for (const key of Object.keys(form.fieldNames) as (keyof CustomFieldNames)[]) {
      if (form.fieldNames[key].trim() === "") {
        found[key] = "This name is required.";
      }
    }
    const threshold = form.noActivityThreshold;
    if (
      !Number.isInteger(threshold) ||
      threshold < MIN_THRESHOLD ||
      threshold > MAX_THRESHOLD
    ) {
      found.noActivityThreshold = `Enter a whole number between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}.`;
    }
    return found;
  }, [form]);

  const valid = Object.keys(errors).length === 0;

  const set = <K extends keyof SalesCrmGeneralSettings>(
    key: K,
    value: SalesCrmGeneralSettings[K],
  ) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const setFieldName = (key: keyof CustomFieldNames, value: string) =>
    setForm((prev) =>
      prev ? { ...prev, fieldNames: { ...prev.fieldNames, [key]: value } } : prev,
    );

  const submit = async () => {
    if (!form || !valid || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const stored = await saveSalesCrmGeneral(form);
      setSaved(stored);
      setForm(stored);
      toast({ title: "Settings saved", tone: "success" });
    } catch (error: unknown) {
      setSaveError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save these settings.",
      );
    } finally {
      setSaving(false);
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
              : "Couldn't load settings"
          }
          description={
            failed === "forbidden"
              ? "Sales & CRM configuration is limited to administrator accounts. Sign in as an administrator and try again."
              : "These settings could not be reached. Check your connection and try again."
          }
          onRetry={() => {
            setFailed(false);
            reload();
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <header className="shrink-0 border-b border-hairline p-5">
        <h2 className="text-xl font-semibold text-ink">General Settings</h2>
        {/* Reference capitalisation, kept verbatim for parity (CLAUDE.md §1). */}
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your company&apos;s basic settings And regional preferences
        </p>
      </header>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
        {form === null ? (
          <div className="flex flex-col gap-5 p-5" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <>
            {saveError && (
              <div className="px-5 pt-5">
                <FormError>{saveError}</FormError>
              </div>
            )}

            <Section title="Lead Display Settings">
              <Field label="How to Display Leads?" htmlFor="display-leads">
                <SearchableSelect
                  id="display-leads"
                  size="lg"
                  clearable
                  searchable={false}
                  options={DISPLAY_LEAD_OPTIONS}
                  value={form.displayLeads}
                  onChange={(value) =>
                    set(
                      "displayLeads",
                      (value ??
                        "ALL_LEADS") as SalesCrmGeneralSettings["displayLeads"],
                    )
                  }
                />
              </Field>

              <Field label="Choose Display Order" htmlFor="display-order">
                <SearchableSelect
                  id="display-order"
                  size="lg"
                  clearable
                  searchable={false}
                  options={DISPLAY_ORDER_OPTIONS}
                  value={form.displayOrder}
                  onChange={(value) =>
                    set(
                      "displayOrder",
                      (value ??
                        "BY_DATE") as SalesCrmGeneralSettings["displayOrder"],
                    )
                  }
                />
              </Field>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <SettingLabel>Choose Order</SettingLabel>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <RadioCard
                    name="order-by"
                    value="LAST_CREATED_DATE"
                    checked={form.orderBy === "LAST_CREATED_DATE"}
                    onSelect={() => set("orderBy", "LAST_CREATED_DATE")}
                  >
                    Last Created Date
                  </RadioCard>
                  <RadioCard
                    name="order-by"
                    value="LAST_EDITED_DATE"
                    checked={form.orderBy === "LAST_EDITED_DATE"}
                    onSelect={() => set("orderBy", "LAST_EDITED_DATE")}
                  >
                    Last Edited Date
                  </RadioCard>
                </div>
              </div>

              <ToggleField
                id="require-company-name"
                label="Set Leads Company Name Exists?"
                checked={form.requireCompanyName}
                onChange={(checked) => set("requireCompanyName", checked)}
              />
            </Section>

            <Section title="Configure Notes Display">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <SettingLabel>
                  Select the Note type to be displayed on Lead List
                </SettingLabel>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <RadioCard
                    name="note-display"
                    value="LEAD_PRIMARY_NOTE"
                    checked={form.noteDisplay === "LEAD_PRIMARY_NOTE"}
                    onSelect={() => set("noteDisplay", "LEAD_PRIMARY_NOTE")}
                  >
                    Lead Primary Note
                  </RadioCard>
                  <RadioCard
                    name="note-display"
                    value="LAST_ADDED_NOTE"
                    checked={form.noteDisplay === "LAST_ADDED_NOTE"}
                    onSelect={() => set("noteDisplay", "LAST_ADDED_NOTE")}
                  >
                    Last Added Note
                  </RadioCard>
                </div>
              </div>
            </Section>

            <Section title="Custom Field Names" titleInfo>
              {FIELD_NAME_ROWS.flat().map((key) => (
                <Field
                  key={key}
                  label={FIELD_NAME_LABELS[key]}
                  htmlFor={`field-name-${key}`}
                  hideInfo
                  error={errors[key]}
                >
                  <Input
                    id={`field-name-${key}`}
                    size="lg"
                    className="text-sm"
                    value={form.fieldNames[key]}
                    aria-invalid={errors[key] ? true : undefined}
                    onChange={(event) => setFieldName(key, event.target.value)}
                  />
                </Field>
              ))}
            </Section>

            <Section title="Basic Settings">
              <ToggleField
                id="actual-amount-timeline"
                label="Set Lead Actual Amount Timeline"
                checked={form.actualAmountTimeline}
                onChange={(checked) => set("actualAmountTimeline", checked)}
              />
              <div aria-hidden="true" className="hidden sm:block" />

              <Field label="Default Country Code" htmlFor="default-country">
                <SearchableSelect
                  id="default-country"
                  size="lg"
                  clearable
                  options={COUNTRY_OPTIONS}
                  value={form.defaultCountryCode}
                  onChange={(value) => set("defaultCountryCode", value ?? "AE")}
                />
              </Field>

              <Field
                label="Set Permissions for Adding Tags"
                htmlFor="tag-permission"
              >
                <SearchableSelect
                  id="tag-permission"
                  size="lg"
                  clearable
                  searchable={false}
                  options={TAG_PERMISSION_OPTIONS}
                  value={form.tagPermission}
                  onChange={(value) =>
                    set(
                      "tagPermission",
                      (value ??
                        "ALL_USERS") as SalesCrmGeneralSettings["tagPermission"],
                    )
                  }
                />
              </Field>
            </Section>

            <Section title="Privacy & Security">
              <ToggleField
                id="mask-mobile-numbers"
                label="Mask Lead Mobile Numbers"
                checked={form.maskMobileNumbers}
                onChange={(checked) => set("maskMobileNumbers", checked)}
              />
              <div aria-hidden="true" className="hidden sm:block" />

              <Field label="View Masking Role" htmlFor="masking-role">
                <SearchableSelect
                  id="masking-role"
                  size="lg"
                  clearable
                  searchable={false}
                  placeholder="Select Role"
                  options={MASKING_ROLE_OPTIONS}
                  value={form.maskingRole}
                  onChange={(value) =>
                    set("maskingRole", (value as UserRole | null) ?? null)
                  }
                />
              </Field>

              <Field label="Digits to Mask" htmlFor="mask-digits">
                <SearchableSelect
                  id="mask-digits"
                  size="lg"
                  searchable={false}
                  options={MASK_DIGIT_OPTIONS}
                  value={String(form.maskDigits)}
                  onChange={(value) => set("maskDigits", Number(value ?? 4))}
                />
              </Field>
            </Section>

            <Section title="Pipeline Change Behavior">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <SettingLabel>Default Assignee on Pipeline Change</SettingLabel>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  <RadioCard
                    name="pipeline-assignee"
                    value="SAME_USER"
                    checked={form.pipelineChangeAssignee === "SAME_USER"}
                    onSelect={() => set("pipelineChangeAssignee", "SAME_USER")}
                  >
                    Assign to the Same User
                  </RadioCard>
                  <RadioCard
                    name="pipeline-assignee"
                    value="UNASSIGN"
                    checked={form.pipelineChangeAssignee === "UNASSIGN"}
                    onSelect={() => set("pipelineChangeAssignee", "UNASSIGN")}
                  >
                    Unassign
                  </RadioCard>
                </div>
              </div>
            </Section>

            <Section title="No Activity Settings" last>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <SettingLabel htmlFor="no-activity-threshold">
                  No Activity Alert Threshold
                </SettingLabel>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Input
                      id="no-activity-threshold"
                      type="number"
                      inputMode="numeric"
                      min={MIN_THRESHOLD}
                      max={MAX_THRESHOLD}
                      size="lg"
                    className="text-sm"
                      aria-invalid={errors.noActivityThreshold ? true : undefined}
                      aria-describedby={
                        errors.noActivityThreshold
                          ? "no-activity-threshold-error"
                          : undefined
                      }
                      // 0 renders as an empty box so the field can be cleared while
                      // typing; it stays invalid until a real number is entered.
                      value={
                        form.noActivityThreshold === 0
                          ? ""
                          : String(form.noActivityThreshold)
                      }
                      onChange={(event) =>
                        set(
                          "noActivityThreshold",
                          Number(event.target.value.replace(/[^0-9]/g, "")) || 0,
                        )
                      }
                    />
                    {errors.noActivityThreshold && (
                      <p
                        id="no-activity-threshold-error"
                        role="alert"
                        className="text-sm text-danger"
                      >
                        {errors.noActivityThreshold}
                      </p>
                    )}
                  </div>

                  <SearchableSelect
                    size="lg"
                    clearable
                    searchable={false}
                    options={NO_ACTIVITY_UNIT_OPTIONS}
                    value={form.noActivityUnit}
                    onChange={(value) =>
                      set(
                        "noActivityUnit",
                        (value ??
                          "HOURS") as SalesCrmGeneralSettings["noActivityUnit"],
                      )
                    }
                  />

                  <ToggleField
                    id="no-activity-notifications"
                    label="No Activity Notifications"
                    checked={form.noActivityNotifications}
                    onChange={(checked) =>
                      set("noActivityNotifications", checked)
                    }
                  />
                </div>
              </div>
            </Section>
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-canvas p-5">
        <Button
          variant="ghost"
          onClick={() => {
            setForm(saved);
            setSaveError(null);
          }}
          disabled={!dirty || saving}
        >
          Cancel
        </Button>
        <Button
          onClick={() => void submit()}
          isLoading={saving}
          disabled={!dirty || !valid || form === null}
          className="min-w-24"
        >
          Save
        </Button>
      </footer>
    </Card>
  );
}

/** One titled block, separated by the reference's full-width rule. */
function Section({
  title,
  children,
  last = false,
  titleInfo = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
  titleInfo?: boolean;
}) {
  return (
    <section className={last ? "p-5" : "border-b border-hairline p-5"}>
      {titleInfo ? (
        <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
          {title}
          <IconInfoCircle
            size={15}
            stroke={1.75}
            aria-hidden="true"
            className="shrink-0 text-ink-subtle"
          />
        </h3>
      ) : (
        <h3 className="text-base font-semibold text-ink">{title}</h3>
      )}
      <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
  error,
  hideInfo = false,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  error?: string;
  hideInfo?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {hideInfo ? (
        <label htmlFor={htmlFor} className="text-sm text-ink-muted">
          {label}
        </label>
      ) : (
        <SettingLabel htmlFor={htmlFor}>{label}</SettingLabel>
      )}
      {children}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
