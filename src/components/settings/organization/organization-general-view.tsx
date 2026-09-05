"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { useLookup } from "@/hooks/use-lookup";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  DATE_DISPLAY_FORMATS,
  MERIDIEMS,
  PAGINATION_LIMITS,
  SHIFT_HOURS,
  SHIFT_MINUTES,
  WEEKDAYS,
  fetchOrganizationGeneral,
  saveOrganizationGeneral,
  type DateDisplayFormat,
  type Meridiem,
  type OrganizationGeneralSettings,
  type PaginationLimit,
  type Weekday,
} from "@/services/organization-settings-service";

/** Minutes are two digits in the reference ("00"), hours are not ("7"). */
const pad2 = (n: number) => String(n).padStart(2, "0");

const same = (
  a: OrganizationGeneralSettings,
  b: OrganizationGeneralSettings,
) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Settings → Organization Setup → General Settings.
 *
 * The same shape the Sales & CRM settings screens use: the saved payload is the baseline,
 * the form edits a copy, Save replaces it wholesale and Cancel returns to the baseline —
 * so Cancel never touches the API and Save is inert until something actually changed.
 *
 * Every option list is validated server-side against the same vocabulary, and the currency
 * catalogue comes from `GET /api/lookups/currencies` rather than being duplicated here
 * (ADR-0065).
 */
export function OrganizationGeneralView() {
  const { toast } = useToast();
  const currencies = useLookup("currencies");

  const [saved, setSaved] = useState<OrganizationGeneralSettings | null>(null);
  const [value, setValue] = useState<OrganizationGeneralSettings | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchOrganizationGeneral(controller.signal)
      .then((result) => {
        if (!active) return;
        setSaved(result);
        setValue(result);
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

  const set = <K extends keyof OrganizationGeneralSettings>(
    key: K,
    next: OrganizationGeneralSettings[K],
  ) => setValue((current) => (current ? { ...current, [key]: next } : current));

  const dirty = Boolean(value && saved && !same(value, saved));

  const submit = async () => {
    if (!value || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const stored = await saveOrganizationGeneral(value);
      setSaved(stored);
      setValue(stored);
      toast({ title: "General Settings saved", tone: "success" });
    } catch (error: unknown) {
      setSaveError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save these settings.",
      );
    } finally {
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
              : "Couldn't load General Settings"
          }
          description={
            failed === "forbidden"
              ? "Organization settings are limited to administrator accounts. Sign in as an administrator and try again."
              : "The settings could not be reached. Check your connection and try again."
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
      <div className="shrink-0 border-b border-hairline p-5">
        <h2 className="text-xl font-semibold text-ink">General Settings</h2>
        {/* Reference wording, kept verbatim including its capital "And" (CLAUDE.md §1). */}
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your company&apos;s basic settings And regional preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
        {value === null ? (
          <div className="flex flex-col gap-4 p-5" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <>
            {saveError && (
              <div className="px-5 pt-5">
                <FormError>{saveError}</FormError>
              </div>
            )}

            {/* ---------- Basic settings ---------- */}
            <section className="grid gap-x-6 gap-y-5 border-b border-hairline p-5 sm:grid-cols-2">
              <Field id="org-currency" label="Currency" hint="The currency amounts are shown in across the product.">
                <SearchableSelect
                  portal
                  size="lg"
                  id="org-currency"
                  aria-label="Currency"
                  placeholder="Select currency"
                  clearable
                  loading={currencies.isLoading}
                  options={currencies.options}
                  value={value.currency}
                  onChange={(next) => next && set("currency", next)}
                />
              </Field>

              <Field
                id="org-date-format"
                label="Date Display Format"
                hint="How dates are printed across the product."
              >
                <SearchableSelect
                  portal
                  size="lg"
                  id="org-date-format"
                  aria-label="Date Display Format"
                  searchable={false}
                  clearable
                  placeholder="Select format"
                  options={DATE_DISPLAY_FORMATS.map((format) => ({
                    value: format,
                    label: format,
                  }))}
                  value={value.dateDisplayFormat}
                  onChange={(next) =>
                    next && set("dateDisplayFormat", next as DateDisplayFormat)
                  }
                />
              </Field>

              <Field
                id="org-pagination"
                label="Table Pagination Limits"
                hint="How many rows a table shows per page by default."
              >
                <SearchableSelect
                  portal
                  size="lg"
                  id="org-pagination"
                  aria-label="Table Pagination Limits"
                  searchable={false}
                  clearable
                  placeholder="Select limit"
                  options={PAGINATION_LIMITS.map((limit) => ({
                    value: String(limit),
                    label: String(limit),
                  }))}
                  value={String(value.tablePaginationLimit)}
                  onChange={(next) =>
                    next &&
                    set("tablePaginationLimit", Number(next) as PaginationLimit)
                  }
                />
              </Field>

              {/* Bottom-aligned, so the row sits level with the select beside it. */}
              <div className="self-end">
                <ToggleRow
                  id="org-grouping"
                  label="Enable Organizational Grouping"
                  hint="Groups users and records by their place in the organization."
                  checked={value.organizationalGrouping}
                  onChange={(next) => set("organizationalGrouping", next)}
                />
              </div>
            </section>

            {/* ---------- Shift time ---------- */}
            <section className="border-b border-hairline p-5">
              <h3 className="text-base font-semibold text-ink">
                Shift Time Settings
              </h3>

              <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <ShiftField
                  idPrefix="org-shift-start"
                  label="Shift Starting Time"
                  hint="When the working day begins."
                  hour={value.shiftStartHour}
                  minute={value.shiftStartMinute}
                  period={value.shiftStartPeriod}
                  onHour={(next) => set("shiftStartHour", next)}
                  onMinute={(next) => set("shiftStartMinute", next)}
                  onPeriod={(next) => set("shiftStartPeriod", next)}
                />
                <ShiftField
                  idPrefix="org-shift-end"
                  label="Shift Ending Time"
                  hint="When the working day ends."
                  hour={value.shiftEndHour}
                  minute={value.shiftEndMinute}
                  period={value.shiftEndPeriod}
                  onHour={(next) => set("shiftEndHour", next)}
                  onMinute={(next) => set("shiftEndMinute", next)}
                  onPeriod={(next) => set("shiftEndPeriod", next)}
                />

                <Field id="org-off-days" label="Off Days" hint="Days the business does not operate.">
                  <MultiSelect
                    id="org-off-days"
                    aria-label="Off Days"
                    placeholder="Select days"
                    options={WEEKDAYS.map((day) => ({ value: day, label: day }))}
                    value={value.offDays}
                    onChange={(next) => set("offDays", next as Weekday[])}
                  />
                </Field>
              </div>
            </section>

            {/* ---------- Product module ---------- */}
            <section className="p-5">
              <h3 className="text-base font-semibold text-ink">
                Product Module Settings
              </h3>
              <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <ToggleRow
                  id="org-product-module"
                  label="Enable Product Module"
                  hint="Shows the product fields and lists across the product."
                  checked={value.productModuleEnabled}
                  onChange={(next) => set("productModuleEnabled", next)}
                />
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline bg-canvas p-5">
        <Button
          variant="ghost"
          aria-label="Cancel"
          disabled={busy || !dirty}
          onClick={() => {
            setSaveError(null);
            if (saved) setValue(saved);
          }}
        >
          Cancel
        </Button>
        <Button
          aria-label="Save General Settings"
          onClick={() => void submit()}
          isLoading={busy}
          disabled={value === null || !dirty}
        >
          Save
        </Button>
      </footer>
    </Card>
  );
}

/** One labelled control: the reference's muted label with its ⓘ. */
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SettingLabel htmlFor={id} hint={hint}>
        {label}
      </SettingLabel>
      {children}
    </div>
  );
}

/**
 * The reference's three-box time control: hour, minute, AM/PM.
 *
 * Three bounded selects rather than a free-text field, so an impossible time cannot be
 * expressed in the first place — the API validates the same ranges again.
 */
function ShiftField({
  idPrefix,
  label,
  hint,
  hour,
  minute,
  period,
  onHour,
  onMinute,
  onPeriod,
}: {
  idPrefix: string;
  label: string;
  hint: string;
  hour: number;
  minute: number;
  period: Meridiem;
  onHour: (value: number) => void;
  onMinute: (value: number) => void;
  onPeriod: (value: Meridiem) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SettingLabel htmlFor={`${idPrefix}-hour`} hint={hint}>
        {label}
      </SettingLabel>
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">
          <SearchableSelect
            portal
            size="lg"
            id={`${idPrefix}-hour`}
            aria-label={`${label} hour`}
            searchable={false}
            options={SHIFT_HOURS.map((h) => ({
              value: String(h),
              label: String(h),
            }))}
            value={String(hour)}
            onChange={(next) => next && onHour(Number(next))}
          />
        </div>
        <div className="min-w-0 flex-1">
          <SearchableSelect
            portal
            size="lg"
            id={`${idPrefix}-minute`}
            aria-label={`${label} minute`}
            searchable={false}
            options={SHIFT_MINUTES.map((m) => ({
              value: String(m),
              label: pad2(m),
            }))}
            value={String(minute)}
            onChange={(next) => next !== null && onMinute(Number(next))}
          />
        </div>
        <div className="min-w-0 flex-1">
          <SearchableSelect
            portal
            size="lg"
            id={`${idPrefix}-period`}
            aria-label={`${label} period`}
            searchable={false}
            options={MERIDIEMS.map((m) => ({ value: m, label: m }))}
            value={period}
            onChange={(next) => next && onPeriod(next as Meridiem)}
          />
        </div>
      </div>
    </div>
  );
}

/** The reference's filled toggle row: label and ⓘ left, switch right. */
function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
      <SettingLabel htmlFor={id} hint={hint} className="cursor-pointer">
        {label}
      </SettingLabel>
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}
