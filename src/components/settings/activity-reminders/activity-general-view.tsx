"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import {
  RadioCard,
  SettingLabel,
} from "@/components/settings/sales-crm/setting-controls";
import {
  OVERDUE_AFTER_OPTIONS,
  REMINDER_TIME_OPTIONS,
  fetchActivityGeneral,
  saveActivityGeneral,
  type ActivityGeneralSettings,
  type OverdueMinutes,
  type ReminderTime,
} from "@/services/activity-settings-service";

const same = (a: ActivityGeneralSettings, b: ActivityGeneralSettings) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Settings → Activity and Reminders → General Settings.
 *
 * The same baseline/copy shape as the settings screens beside it: the saved payload is
 * the baseline, the form edits a copy, Save replaces it wholesale and Cancel returns to
 * the baseline — so Cancel never touches the API and both actions are inert until
 * something changed.
 *
 * Two controls are progressively disclosed exactly as the reference discloses them:
 * Reminder Time appears only while reminders are on, and Overdue After only under
 * "After Custom Time Span". A hidden value is still *stored* — switching a toggle off and
 * back on must not silently discard the choice underneath it.
 */
export function ActivityGeneralView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<ActivityGeneralSettings | null>(null);
  const [value, setValue] = useState<ActivityGeneralSettings | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchActivityGeneral(controller.signal)
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

  const set = <K extends keyof ActivityGeneralSettings>(
    key: K,
    next: ActivityGeneralSettings[K],
  ) => {
    setValue((current) => (current ? { ...current, [key]: next } : current));
    setSaveError(null);
  };

  const dirty = Boolean(value && saved && !same(value, saved));

  const submit = async () => {
    if (!value || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const stored = await saveActivityGeneral(value);
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
              ? "Activity and reminder settings are limited to administrator accounts. Sign in as an administrator and try again."
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
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your Company&apos;s Basic Settings and Regional Preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto">
        {value === null ? (
          <div className="flex flex-col gap-5 p-5" aria-hidden="true">
            <Skeleton className="h-6 w-96" />
            <Skeleton className="h-6 w-96" />
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-12 w-full max-w-md" />
          </div>
        ) : (
          <div className="flex flex-col">
            {saveError && (
              <div className="px-5 pt-5">
                <FormError>{saveError}</FormError>
              </div>
            )}

            <section className="flex flex-col gap-4 p-5">
              <ToggleRow
                id="auto-prompt-follow-up"
                label="Enable automatic prompt to create a follow up on completion"
                checked={value.autoPromptFollowUpOnCompletion}
                onChange={(next) =>
                  set("autoPromptFollowUpOnCompletion", next)
                }
              />
              <ToggleRow
                id="follow-up-mandatory"
                label="Make the follow-up screen mandatory when changing the status"
                checked={value.followUpMandatoryOnStatusChange}
                onChange={(next) =>
                  set("followUpMandatoryOnStatusChange", next)
                }
              />
              <ToggleRow
                id="reminders-enabled"
                label="Set Reminders for follow ups"
                checked={value.remindersEnabled}
                onChange={(next) => set("remindersEnabled", next)}
              />

              {/* Disclosed by the switch above it, exactly as the reference discloses it. */}
              {value.remindersEnabled && (
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Field id="reminder-time" label="Reminder Time">
                    <SearchableSelect
                      portal
                      size="lg"
                      id="reminder-time"
                      aria-label="Reminder Time"
                      searchable={false}
                      placeholder="Select reminder time"
                      options={[...REMINDER_TIME_OPTIONS]}
                      value={value.reminderTime}
                      onChange={(next) =>
                        next && set("reminderTime", next as ReminderTime)
                      }
                    />
                  </Field>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4 border-t border-hairline p-5">
              <SettingLabel>Make Appointment as Overdue</SettingLabel>

              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <RadioCard
                  name="overdue-mode"
                  value="END_OF_DAY"
                  checked={value.overdueMode === "END_OF_DAY"}
                  onSelect={() => set("overdueMode", "END_OF_DAY")}
                >
                  After End of Day
                </RadioCard>
                <RadioCard
                  name="overdue-mode"
                  value="CUSTOM_TIME_SPAN"
                  checked={value.overdueMode === "CUSTOM_TIME_SPAN"}
                  onSelect={() => set("overdueMode", "CUSTOM_TIME_SPAN")}
                >
                  After Custom Time Span
                </RadioCard>
              </div>

              {/* The reference draws Overdue After only under the custom span card. */}
              {value.overdueMode === "CUSTOM_TIME_SPAN" && (
                <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  <Field id="overdue-after" label="Overdue After">
                    <SearchableSelect
                      portal
                      size="lg"
                      id="overdue-after"
                      aria-label="Overdue After"
                      searchable={false}
                      placeholder="Select a time span"
                      options={OVERDUE_AFTER_OPTIONS.map((option) => ({
                        value: String(option.value),
                        label: option.label,
                      }))}
                      value={String(value.overdueAfterMinutes)}
                      onChange={(next) =>
                        next &&
                        set(
                          "overdueAfterMinutes",
                          Number(next) as OverdueMinutes,
                        )
                      }
                    />
                  </Field>
                </div>
              )}
            </section>
          </div>
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
          aria-label="Save"
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

/**
 * The reference's unboxed switch row: label, its ⓘ, then the switch — all on one line,
 * left-aligned, with no surrounding tint. (The boxed `ToggleField` beside it is the
 * Sales & CRM shape; this category draws the row bare.)
 */
function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <SettingLabel htmlFor={id} className="cursor-pointer">
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

/** One labelled control carrying the reference's ⓘ; no tooltip copy is invented (§16.4). */
function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <SettingLabel htmlFor={id}>{label}</SettingLabel>
      {children}
    </div>
  );
}
