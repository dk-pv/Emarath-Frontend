"use client";

import { useCallback, useEffect, useState } from "react";
import {
  IconCircleCheck,
  IconHistory,
  IconInfoCircle,
} from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatTime } from "@/lib/format";
import {
  fetchDuplicateSettings,
  saveDuplicateSettings,
  type DuplicateSettings,
  type UpdateDuplicateSettingsInput,
} from "@/services/duplicate-settings-service";
import { SettingLabel } from "./setting-controls";

const form = (settings: DuplicateSettings): UpdateDuplicateSettingsInput => ({
  allowDuplicateSearch: settings.allowDuplicateSearch,
  checkArchivedLeads: settings.checkArchivedLeads,
});

const same = (
  a: UpdateDuplicateSettingsInput,
  b: UpdateDuplicateSettingsInput,
) =>
  a.allowDuplicateSearch === b.allowDuplicateSearch &&
  a.checkArchivedLeads === b.checkArchivedLeads;

/**
 * Settings → Sales & CRM Configuration → Duplicate Settings.
 *
 * The matching fields themselves are fixed, which is what the banner states. What happens next
 * is fixed too (ADR-0092): a duplicate is always saved as its own lead and linked to the lead it
 * duplicates, so the screen states that outcome instead of offering a choice. The earlier
 * "Block, hard stop" option is gone — no setting here can make a lead be refused. Only the two
 * toggles that still change something remain.
 */
export function DuplicateSettingsView() {
  const { toast } = useToast();
  const [saved, setSaved] = useState<DuplicateSettings | null>(null);
  const [value, setValue] = useState<UpdateDuplicateSettingsInput | null>(null);
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchDuplicateSettings(controller.signal)
      .then((result) => {
        if (!active) return;
        setSaved(result);
        setValue(form(result));
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

  const set = <K extends keyof UpdateDuplicateSettingsInput>(
    key: K,
    next: UpdateDuplicateSettingsInput[K],
  ) => setValue((current) => (current ? { ...current, [key]: next } : current));

  const dirty = Boolean(value && saved && !same(value, form(saved)));

  const submit = async () => {
    if (!value || busy) return;
    setBusy(true);
    try {
      const result = await saveDuplicateSettings(value);
      setSaved(result);
      setValue(form(result));
      toast({ title: "Duplicate Settings saved", tone: "success" });
    } catch (error: unknown) {
      toast({
        title:
          error instanceof ApiError
            ? (error.messages[0] ?? error.message)
            : "Could not save these settings.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-semibold text-ink">Duplicate Settings</h1>
      <Button
        variant="secondary"
        aria-label="Activity Log"
        onClick={() => setLogOpen(true)}
        disabled={saved === null}
      >
        <IconHistory size={16} stroke={1.75} aria-hidden="true" />
        Activity Log
      </Button>
    </div>
  );

  if (failed) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {header}
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <ErrorState
            className="py-16"
            title={
              failed === "forbidden"
                ? "You don't have access to duplicate settings"
                : "Couldn't load duplicate settings"
            }
            description={
              failed === "forbidden"
                ? "Duplicate handling is limited to administrator accounts. Sign in as an administrator and try again."
                : "The settings could not be reached. Check your connection and try again."
            }
            onRetry={() => {
              setFailed(false);
              reload();
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {header}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="scrollbar-slim min-h-0 flex-1 overflow-auto p-5">
          {value === null ? (
            <div className="flex flex-col gap-4" aria-hidden="true">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <>
              {/*
                The reference states the matching rule and that it is fixed. The product
                name is Emarath here — the brand name is one of the three things allowed
                to differ from Workpex (CLAUDE.md §1).
              */}
              <Alert
                tone="warning"
                icon={IconInfoCircle}
                className="[&_div>div]:text-warning"
              >
                Emarath automatically checks new enquiries against{" "}
                <strong className="font-semibold">Primary phone</strong>,{" "}
                <strong className="font-semibold">Secondary phone</strong>, or{" "}
                <strong className="font-semibold">Email</strong>. This matching
                isn&apos;t configurable.
              </Alert>

              <h2 className="mt-6 text-base font-semibold text-ink">
                For leads
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                What happens when a duplicate is found?
              </p>

              <div className="mt-4 lg:max-w-3xl">
                <OutcomeCard
                  title="Save and flag as a duplicate"
                  description="The lead is saved as its own lead and marked as a duplicate of the earlier one. The rep sees a warning first but can continue."
                />
                <p className="mt-2 text-xs text-ink-subtle">
                  Blocking a duplicate lead is not available: a duplicate is
                  always saved, so no enquiry is lost.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-4">
                <ToggleRow
                  id="duplicate-allow-search"
                  label="Ability to search and view Duplicate leads"
                  hint="Saved but not enforced yet: the Leads list's duplicate search stays available to everyone who can see the leads."
                  checked={value.allowDuplicateSearch}
                  onChange={(next) => set("allowDuplicateSearch", next)}
                />
                <ToggleRow
                  id="duplicate-check-archived"
                  label="Check archived leads for duplicates?"
                  hint="Includes archived leads when matching a new enquiry, so an archived lead can be the one a new duplicate is linked to."
                  checked={value.checkArchivedLeads}
                  onChange={(next) => set("checkArchivedLeads", next)}
                />
              </div>
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-hairline p-4">
          <Button
            variant="ghost"
            aria-label="Cancel"
            disabled={busy || !dirty}
            onClick={() => saved && setValue(form(saved))}
          >
            Cancel
          </Button>
          <Button
            aria-label="Save Duplicate Settings"
            onClick={() => void submit()}
            isLoading={busy}
            disabled={value === null}
          >
            Save
          </Button>
        </footer>
      </Card>

      <Modal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Activity Log"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setLogOpen(false)}>
            Close
          </Button>
        }
      >
        {saved && saved.log.length > 0 ? (
          <ul className="flex flex-col gap-3 pt-2">
            {saved.log.map((entry) => (
              <li
                key={`${entry.at}-${entry.changes.join()}`}
                className="rounded-control border border-hairline p-3"
              >
                <p className="text-xs text-ink-muted">
                  {formatDate(entry.at)} · {formatTime(entry.at)}
                  {entry.byName ? ` · ${entry.byName}` : ""}
                </p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {entry.changes.map((change) => (
                    <li key={change} className="text-sm text-ink">
                      {change}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            className="py-10"
            title="No changes yet"
            description="Changes to these settings will be listed here."
          />
        )}
      </Modal>
    </div>
  );
}

/**
 * The one outcome duplicate handling has, drawn like the reference's selected card (a title over
 * a description, indicator on the right) but not selectable: there is nothing to choose.
 */
function OutcomeCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      aria-label={title}
      className="flex items-start gap-3 rounded-surface border border-brand bg-brand-subtle p-4"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-strong">
          {title}
        </span>
        <span className="mt-1 block text-sm text-ink-muted">{description}</span>
      </span>
      <IconCircleCheck
        size={20}
        stroke={1.75}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-brand"
      />
    </div>
  );
}

/** The reference's plain label + ⓘ + switch row, with no surrounding box. */
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
    <div className="flex flex-wrap items-center gap-3">
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
