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
  ApplicationGeneralSettings,
  fetchApplicationGeneral,
  saveApplicationGeneral,
} from "@/services/application-controls-service";

/** The three switches, in the reference's order, with the id each label points at. */
const SWITCHES: {
  id: string;
  label: string;
  field: keyof ApplicationGeneralSettings;
}[] = [
  {
    id: "auto-save-password",
    label: "Enable Auto-save Password",
    field: "autoSavePassword",
  },
  {
    id: "disable-prompt-after-call",
    label: "Disable Prompt After Call",
    field: "disablePromptAfterCall",
  },
  {
    id: "selfie-verification-on-login",
    label: "Selfie Verification on Login",
    field: "selfieVerificationOnLogin",
  },
];

/**
 * Settings → Application Controls → Application General Settings.
 *
 * Three labelled switches over a Cancel/Save footer, exactly as the reference draws it:
 * label, its ⓘ and a compact switch on one line, left aligned, the footer pinned while
 * the body scrolls. Save replaces the stored payload; Cancel returns to it without
 * touching the API.
 *
 * Only **Enable Auto-save Password** reaches real behaviour today — the login form asks
 * for the policy and turns the browser's password manager off when it is off. The other
 * two are stored policy with no mechanism behind them: this codebase has no after-call
 * prompt and no identity verification at all, and building either to make a switch look
 * live is what CLAUDE.md §16/§20 forbid (ADR-0074).
 */
export function ApplicationGeneralView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<ApplicationGeneralSettings | null>(null);
  const [value, setValue] = useState<ApplicationGeneralSettings | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchApplicationGeneral(controller.signal)
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

  const dirty =
    value !== null &&
    saved !== null &&
    SWITCHES.some((row) => value[row.field] !== saved[row.field]);

  const submit = async () => {
    if (value === null || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const stored = await saveApplicationGeneral(value);
      setSaved(stored);
      setValue(stored);
      toast({ title: "Application General Settings saved", tone: "success" });
    } catch (error: unknown) {
      // The draft is deliberately left as it was: a failed save must not silently
      // discard what the user had set.
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
              : "Couldn't load Application General Settings"
          }
          description={
            failed === "forbidden"
              ? "Application Controls are limited to administrator accounts. Sign in as an administrator and try again."
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
        <h2 className="text-xl font-semibold text-ink">
          Application General Settings
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Configure your company&apos;s Basic Settings and Regional Preferences
        </p>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
        {value === null ? (
          <div className="flex flex-col gap-5">
            {SWITCHES.map((row) => (
              <Skeleton key={row.id} className="h-6 w-64" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <>
            {saveError && (
              <div className="pb-5">
                <FormError>{saveError}</FormError>
              </div>
            )}
            {/*
              The reference lists the three rows plainly — label, ⓘ, switch — rather than
              in the bordered toggle boxes the Sales & CRM screens use. The ⓘ carries no
              tooltip: no capture shows one open, and copy for it is not invented (§16.4).
            */}
            <div className="flex flex-col gap-5">
              {SWITCHES.map((row) => (
                <div key={row.id} className="flex items-center gap-3">
                  <SettingLabel htmlFor={row.id} className="cursor-pointer">
                    {row.label}
                  </SettingLabel>
                  <Switch
                    id={row.id}
                    aria-label={row.label}
                    checked={value[row.field]}
                    onChange={(event) =>
                      setValue({ ...value, [row.field]: event.target.checked })
                    }
                  />
                </div>
              ))}
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
          aria-label="Save Application General Settings"
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
