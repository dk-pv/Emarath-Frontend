"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { SettingLabel } from "@/components/settings/sales-crm/setting-controls";
import {
  CALL_PROVIDER_MODE_OPTIONS,
  CALL_TYPE_OPTIONS,
  fetchCallTrackingGeneral,
  saveCallTrackingGeneral,
  type CallProviderMode,
  type CallTrackingGeneralSettings,
  type CallType,
} from "@/services/call-tracking-settings-service";

const same = (
  a: CallTrackingGeneralSettings,
  b: CallTrackingGeneralSettings,
) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Settings → Call Tracking → General Settings.
 *
 * The same baseline/copy shape as the settings screens beside it: the saved payload is the
 * baseline, the form edits a copy, Save & Publish replaces it wholesale and Cancel returns
 * to the baseline — so Cancel never touches the API and the action is inert until
 * something changed.
 *
 * All three controls are clearable, as the reference draws them, so `null` is a value the
 * API stores rather than an omission it defaults away.
 */
export function CallTrackingGeneralView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<CallTrackingGeneralSettings | null>(null);
  const [value, setValue] = useState<CallTrackingGeneralSettings | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchCallTrackingGeneral(controller.signal)
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

  const set = <K extends keyof CallTrackingGeneralSettings>(
    key: K,
    next: CallTrackingGeneralSettings[K],
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
      const stored = await saveCallTrackingGeneral(value);
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
              ? "Call tracking settings are limited to administrator accounts. Sign in as an administrator and try again."
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
            <Skeleton className="h-6 w-64" />
            <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {saveError && <FormError>{saveError}</FormError>}

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">
                Incoming / Outgoing Call Settings
              </h3>

              {/* Side by side on desktop, one column once there is no room. */}
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field id="outgoing-call-type" label="Outgoing Call Type">
                  <SearchableSelect
                    portal
                    size="lg"
                    id="outgoing-call-type"
                    aria-label="Outgoing Call Type"
                    searchable={false}
                    clearable
                    placeholder="Select call type"
                    options={[...CALL_TYPE_OPTIONS]}
                    value={value.outgoingCallType}
                    onChange={(next) =>
                      set("outgoingCallType", next as CallType | null)
                    }
                  />
                </Field>

                <Field id="incoming-call-type" label="Incoming Call Type">
                  <SearchableSelect
                    portal
                    size="lg"
                    id="incoming-call-type"
                    aria-label="Incoming Call Type"
                    searchable={false}
                    clearable
                    placeholder="Select call type"
                    options={[...CALL_TYPE_OPTIONS]}
                    value={value.incomingCallType}
                    onChange={(next) =>
                      set("incomingCallType", next as CallType | null)
                    }
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-ink">
                Enable Unique Engagement Settings
              </h3>

              {/* The reference leaves the right-hand column empty under this heading. */}
              <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field id="call-provider-mode" label="Call Provider Mode">
                  <SearchableSelect
                    portal
                    size="lg"
                    id="call-provider-mode"
                    aria-label="Call Provider Mode"
                    searchable={false}
                    clearable
                    placeholder="Select provider mode"
                    options={[...CALL_PROVIDER_MODE_OPTIONS]}
                    value={value.callProviderMode}
                    onChange={(next) =>
                      set("callProviderMode", next as CallProviderMode | null)
                    }
                  />
                </Field>
              </div>
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
          aria-label="Save & Publish"
          onClick={() => void submit()}
          isLoading={busy}
          disabled={value === null || !dirty}
        >
          Save &amp; Publish
        </Button>
      </footer>
    </Card>
  );
}

/**
 * One labelled control carrying the reference's ⓘ. No tooltip copy is invented — no
 * capture shows one open (CLAUDE.md §16.4), so the glyph stays presentational.
 */
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
