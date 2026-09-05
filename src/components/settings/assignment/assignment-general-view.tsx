"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  LEAD_LIMIT_METHODS,
  MERIDIEMS,
  RECHECK_HOURS,
  RECHECK_MINUTES,
  fetchAssignmentGeneral,
  saveAssignmentGeneral,
  type AssignmentGeneralSettings,
  type LeadLimitMethod,
  type Meridiem,
} from "@/services/assignment-settings-service";

/** Minutes are two digits in the reference ("00"), hours are not ("12"). */
const pad2 = (n: number) => String(n).padStart(2, "0");

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The form holds the daily limit as text: "", "0" and a half-typed number are all legal
 * keystrokes and none of them is the stored value.
 */
type Draft = Omit<AssignmentGeneralSettings, "dailyLeadLimit"> & {
  dailyLeadLimit: string;
};

const toDraft = (settings: AssignmentGeneralSettings): Draft => ({
  ...settings,
  dailyLeadLimit:
    settings.dailyLeadLimit === null ? "" : String(settings.dailyLeadLimit),
});

const toSettings = (draft: Draft): AssignmentGeneralSettings => ({
  ...draft,
  dailyLeadLimit:
    draft.dailyLeadLimit.trim() === "" ? null : Number(draft.dailyLeadLimit),
});

/** The reference's own message, shown under the field exactly as it words it. */
const LIMIT_MESSAGE = "Daily lead limit must be greater than 0.";

function limitError(draft: Draft): string | undefined {
  if (!draft.leadAssignmentLimitEnabled) return undefined;
  const raw = draft.dailyLeadLimit.trim();
  if (raw === "") return LIMIT_MESSAGE;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? undefined : LIMIT_MESSAGE;
}

/**
 * Settings → Assignment → General Settings.
 *
 * The same baseline/copy shape as the settings screens beside it: the saved payload is the
 * baseline, the form edits a copy, Save replaces it wholesale and Cancel returns to the
 * baseline — so Cancel never touches the API and Save is inert until something changed.
 *
 * The dependent controls the reference reveals — the carryover follow-up toggle and the
 * re-check time, the limit method and the daily limit — are *hidden*, not cleared, when
 * their parent switch goes off. Turning a section off and on again must not lose what was
 * configured inside it, and the API stores them the same way.
 */
export function AssignmentGeneralView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<Draft | null>(null);
  const [value, setValue] = useState<Draft | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [touchedLimit, setTouchedLimit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchAssignmentGeneral(controller.signal)
      .then((result) => {
        if (!active) return;
        const draft = toDraft(result);
        setSaved(draft);
        setValue(draft);
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

  const set = <K extends keyof Draft>(key: K, next: Draft[K]) => {
    setValue((current) => (current ? { ...current, [key]: next } : current));
    // A banner about the last refused save must not outlive the edit that answers it.
    setSaveError(null);
  };

  const dirty = Boolean(value && saved && !same(value, saved));
  const error = value ? limitError(value) : undefined;
  const shownError = touchedLimit ? error : undefined;

  const submit = async () => {
    if (!value || busy) return;
    if (error) {
      setTouchedLimit(true);
      setSaveError("Fix the highlighted field and try again.");
      return;
    }

    setBusy(true);
    setSaveError(null);
    try {
      const stored = toDraft(await saveAssignmentGeneral(toSettings(value)));
      setSaved(stored);
      setValue(stored);
      setTouchedLimit(false);
      toast({ title: "General Settings saved", tone: "success" });
    } catch (apiError: unknown) {
      setSaveError(
        apiError instanceof ApiError
          ? (apiError.messages[0] ?? apiError.message)
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
              ? "Assignment settings are limited to administrator accounts. Sign in as an administrator and try again."
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
        {/* Reference wording, kept verbatim including its capital "And" (CLAUDE.md §16). */}
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your company&apos;s basic settings And regional preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {value === null ? (
          <div className="flex flex-col gap-5" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-72" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {saveError && <FormError>{saveError}</FormError>}

            <ToggleRow
              id="auto-assign"
              label="Enable Automatic Lead Assigning"
              checked={value.automaticLeadAssigning}
              onChange={(next) => set("automaticLeadAssigning", next)}
            />

            {/* ---------- Carryover and Scheduling ---------- */}
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">
                Carryover and Scheduling
              </h3>

              <ToggleRow
                id="carryover"
                label="Enable Carryover Leads"
                checked={value.carryoverLeads}
                onChange={(next) => set("carryoverLeads", next)}
              />

              {/* The reference reveals this one only once carryover is on. */}
              {value.carryoverLeads && (
                <ToggleRow
                  id="carryover-followups"
                  label="Include Follow up Leads in Carryover"
                  checked={value.includeFollowUpLeadsInCarryover}
                  onChange={(next) =>
                    set("includeFollowUpLeadsInCarryover", next)
                  }
                />
              )}

              <ToggleRow
                id="check-login"
                label="Check if User has Logged in Before Assigning"
                checked={value.checkUserLoggedInBeforeAssigning}
                onChange={(next) =>
                  set("checkUserLoggedInBeforeAssigning", next)
                }
              />

              {value.carryoverLeads && (
                <div className="flex flex-col gap-2">
                  <SettingLabel htmlFor="recheck-hour">
                    Shift time to re-check pending Leads Assignments
                  </SettingLabel>
                  <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
                    <SearchableSelect
                      portal
                      size="lg"
                      id="recheck-hour"
                      aria-label="Re-check hour"
                      searchable={false}
                      clearable
                      placeholder="Hour"
                      options={RECHECK_HOURS.map((hour) => ({
                        value: String(hour),
                        label: String(hour),
                      }))}
                      value={
                        value.recheckHour === null
                          ? null
                          : String(value.recheckHour)
                      }
                      onChange={(next) =>
                        set("recheckHour", next === null ? null : Number(next))
                      }
                    />
                    <SearchableSelect
                      portal
                      size="lg"
                      id="recheck-minute"
                      aria-label="Re-check minute"
                      searchable={false}
                      clearable
                      placeholder="Minute"
                      options={RECHECK_MINUTES.map((minute) => ({
                        value: String(minute),
                        label: pad2(minute),
                      }))}
                      value={
                        value.recheckMinute === null
                          ? null
                          : String(value.recheckMinute)
                      }
                      onChange={(next) =>
                        set(
                          "recheckMinute",
                          next === null ? null : Number(next),
                        )
                      }
                    />
                    <SearchableSelect
                      portal
                      size="lg"
                      id="recheck-period"
                      aria-label="Re-check period"
                      searchable={false}
                      clearable
                      placeholder="AM/PM"
                      options={MERIDIEMS.map((meridiem) => ({
                        value: meridiem,
                        label: meridiem,
                      }))}
                      value={value.recheckPeriod}
                      onChange={(next) =>
                        set("recheckPeriod", next as Meridiem | null)
                      }
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ---------- Daily Limits ---------- */}
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">Daily Limits</h3>

              <ToggleRow
                id="limit-enabled"
                label="Enable Lead Assignment Limit"
                checked={value.leadAssignmentLimitEnabled}
                onChange={(next) => set("leadAssignmentLimitEnabled", next)}
              />

              {value.leadAssignmentLimitEnabled && (
                <div className="flex max-w-lg flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="limit-method"
                      className="text-sm text-ink-muted"
                    >
                      Lead Assignment Limit Method
                    </label>
                    <SearchableSelect
                      portal
                      size="lg"
                      id="limit-method"
                      aria-label="Lead Assignment Limit Method"
                      searchable={false}
                      options={[...LEAD_LIMIT_METHODS]}
                      value={value.leadLimitMethod}
                      onChange={(next) =>
                        next && set("leadLimitMethod", next as LeadLimitMethod)
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <SettingLabel htmlFor="daily-limit">
                      Set Daily Lead Limit
                    </SettingLabel>
                    <Input
                      size="lg"
                      id="daily-limit"
                      inputMode="numeric"
                      placeholder="Set Daily Lead Limit"
                      value={value.dailyLeadLimit}
                      aria-invalid={shownError ? true : undefined}
                      aria-describedby={
                        shownError ? "daily-limit-error" : undefined
                      }
                      onChange={(event) => {
                        setTouchedLimit(true);
                        set("dailyLeadLimit", event.target.value);
                      }}
                    />
                    {shownError && (
                      <p
                        id="daily-limit-error"
                        role="alert"
                        className="text-sm text-danger"
                      >
                        {shownError}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ---------- WhatsApp Inbound Lead Handling ---------- */}
            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">
                WhatsApp Inbound Lead Handling
              </h3>

              <ToggleRow
                id="whatsapp-round-robin"
                label="Do you want to allocate WhatsApp leads using round robin algorithm?"
                checked={value.whatsappRoundRobin}
                onChange={(next) => set("whatsappRoundRobin", next)}
              />
              <ToggleRow
                id="whatsapp-first-note"
                label="Do you want to save the first incoming message as note?"
                checked={value.saveFirstIncomingMessageAsNote}
                onChange={(next) =>
                  set("saveFirstIncomingMessageAsNote", next)
                }
              />
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
            setTouchedLimit(false);
            if (saved) setValue(saved);
          }}
        >
          Cancel
        </Button>
        <Button
          aria-label="Save Assignment Settings"
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
 * The reference's row shape here: a muted label, its ⓘ, then the switch on the same line —
 * not the bordered box the Organization screens use. No tooltip copy is invented, because
 * no capture shows one open (CLAUDE.md §16.4).
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
    <div className="flex items-center gap-3">
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
