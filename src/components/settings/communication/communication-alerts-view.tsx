"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  fetchCommunicationAlerts,
  saveCommunicationAlerts,
} from "@/services/communication-settings-service";

/**
 * Settings → Communication → Emarath Alerts.
 *
 * The reference's screen is one labelled switch over a Cancel/Save footer, and that is
 * all this is. Same baseline/copy shape as the Organization Setup screens: Save replaces
 * the stored value and Cancel returns to it without touching the API.
 *
 * The switch is a stored preference today and nothing more — the System Alerts service
 * that would produce alerts does not exist in this codebase (ADR-0068).
 */
export function CommunicationAlertsView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<boolean | null>(null);
  const [value, setValue] = useState<boolean | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchCommunicationAlerts(controller.signal)
      .then((result) => {
        if (!active) return;
        setSaved(result.alertsEnabled);
        setValue(result.alertsEnabled);
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

  const dirty = value !== null && saved !== null && value !== saved;

  const submit = async () => {
    if (value === null || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const stored = await saveCommunicationAlerts({ alertsEnabled: value });
      setSaved(stored.alertsEnabled);
      setValue(stored.alertsEnabled);
      toast({ title: "Emarath Alerts saved", tone: "success" });
    } catch (error: unknown) {
      setSaveError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save this setting.",
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
              : "Couldn't load Emarath Alerts"
          }
          description={
            failed === "forbidden"
              ? "Communication settings are limited to administrator accounts. Sign in as an administrator and try again."
              : "The setting could not be reached. Check your connection and try again."
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
        {/* "Workpex Alerts" in the reference; the brand name is one of the three things
            allowed to differ (CLAUDE.md §1). */}
        <h2 className="text-xl font-semibold text-ink">Emarath Alerts</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your Company&apos;s Basic Settings and Regional Preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {value === null ? (
          <Skeleton className="h-6 w-48" aria-hidden="true" />
        ) : (
          <>
            {saveError && (
              <div className="pb-5">
                <FormError>{saveError}</FormError>
              </div>
            )}
            {/*
              The reference puts the label, its ⓘ and the switch on one line at the top
              left of the card — not in the bordered toggle row the other settings screens
              use. No tooltip copy is invented: no capture shows one open (§16.4).
            */}
            <div className="flex items-center gap-3">
              <SettingLabel htmlFor="emarath-alerts">Emarath Alert</SettingLabel>
              <Switch
                id="emarath-alerts"
                aria-label="Emarath Alert"
                checked={value}
                onChange={(event) => setValue(event.target.checked)}
              />
            </div>
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
            if (saved !== null) setValue(saved);
          }}
        >
          Cancel
        </Button>
        <Button
          aria-label="Save Emarath Alerts"
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
