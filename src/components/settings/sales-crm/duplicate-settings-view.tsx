"use client";

import { useCallback, useEffect, useState } from "react";
import { IconHistory, IconInfoCircle } from "@tabler/icons-react";
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
import { cn } from "@/lib/cn";
import { formatDate, formatTime } from "@/lib/format";
import {
  fetchDuplicateSettings,
  saveDuplicateSettings,
  type DuplicateMode,
  type DuplicateSettings,
  type UpdateDuplicateSettingsInput,
} from "@/services/duplicate-settings-service";
import { SettingLabel } from "./setting-controls";

/** The reference's two cards, in its order, with its exact copy. */
const MODES: {
  value: DuplicateMode;
  title: string;
  description: string;
}[] = [
  {
    value: "WARN_ALLOW_SAVE",
    title: "Warn, allow save",
    description:
      "The lead is saved and flagged as a possible duplicate. The rep sees a warning first but can continue.",
  },
  {
    value: "BLOCK_HARD_STOP",
    title: "Block, hard stop",
    description:
      "No lead is created. The enquiry is logged to the Duplicate report instead.",
  },
];

const form = (settings: DuplicateSettings): UpdateDuplicateSettingsInput => ({
  mode: settings.mode,
  allowDuplicateSearch: settings.allowDuplicateSearch,
  displayAssigneeInfo: settings.displayAssigneeInfo,
  checkArchivedLeads: settings.checkArchivedLeads,
});

const same = (
  a: UpdateDuplicateSettingsInput,
  b: UpdateDuplicateSettingsInput,
) =>
  a.mode === b.mode &&
  a.allowDuplicateSearch === b.allowDuplicateSearch &&
  a.displayAssigneeInfo === b.displayAssigneeInfo &&
  a.checkArchivedLeads === b.checkArchivedLeads;

/**
 * Settings → Sales & CRM Configuration → Duplicate Settings.
 *
 * The screen configures what happens *after* a duplicate is found; the matching fields
 * themselves are fixed, which is what the banner states. The saved mode really does gate
 * `POST /api/leads` — Warn saves the lead, Block refuses it and logs the enquiry — so this
 * is policy, not decoration (ADR-0064).
 *
 * The dependent toggles are hidden by mode, as the reference shows, but their values are
 * kept and submitted either way: switching modes and back must not silently discard a
 * choice the user made.
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

              <h2 className="mt-6 text-base font-semibold text-ink">For leads</h2>
              <p className="mt-0.5 text-sm text-ink-muted" id="duplicate-mode-help">
                What should happen when a duplicate is found?
              </p>

              <div
                role="radiogroup"
                aria-label="What should happen when a duplicate is found?"
                aria-describedby="duplicate-mode-help"
                className="mt-4 grid gap-4 sm:grid-cols-2 lg:max-w-3xl"
              >
                {MODES.map((mode) => (
                  <ModeCard
                    key={mode.value}
                    title={mode.title}
                    description={mode.description}
                    checked={value.mode === mode.value}
                    onSelect={() => set("mode", mode.value)}
                  />
                ))}
              </div>

              {/*
                Hidden by mode, as the reference shows — not merely dimmed. The values
                behind them stay in state and are submitted either way, so switching modes
                and back restores the configuration.
              */}
              <div className="mt-6 flex flex-col gap-4">
                {value.mode === "WARN_ALLOW_SAVE" ? (
                  <ToggleRow
                    id="duplicate-allow-search"
                    label="Ability to search and view Duplicate leads"
                    hint="Lets users search the Leads list for possible duplicates."
                    checked={value.allowDuplicateSearch}
                    onChange={(next) => set("allowDuplicateSearch", next)}
                  />
                ) : (
                  <>
                    <ToggleRow
                      id="duplicate-assignee-info"
                      label="Display Assignee Information for Duplicate Leads"
                      hint="Shows who owns the matching lead when an enquiry is blocked."
                      checked={value.displayAssigneeInfo}
                      onChange={(next) => set("displayAssigneeInfo", next)}
                    />
                    <ToggleRow
                      id="duplicate-check-archived"
                      label="Check archived leads for duplicates?"
                      hint="Includes archived leads when matching a new enquiry."
                      checked={value.checkArchivedLeads}
                      onChange={(next) => set("checkArchivedLeads", next)}
                    />
                  </>
                )}
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
 * One duplicate-handling option.
 *
 * Local rather than the shared `RadioCard`: the reference draws a title over a
 * description with the indicator on the *right*, where the General Settings card is a
 * single line with the radio on the left. The native radio stays inside it, so the group
 * keeps arrow-key navigation, focus and screen-reader semantics.
 */
function ModeCard({
  title,
  description,
  checked,
  onSelect,
}: {
  title: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-surface border p-4 transition-colors duration-(--duration-shell) ease-shell has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2",
        checked
          ? "border-brand bg-brand-subtle"
          : "border-hairline bg-surface hover:border-brand/40",
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm font-semibold",
            checked ? "text-brand-strong" : "text-ink",
          )}
        >
          {title}
        </span>
        <span className="mt-1 block text-sm text-ink-muted">{description}</span>
      </span>

      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="radio"
          name="duplicate-mode"
          aria-label={title}
          checked={checked}
          onChange={onSelect}
          className="peer size-4 shrink-0 appearance-none rounded-full border-2 border-hairline bg-surface outline-none transition-colors duration-(--duration-shell) ease-shell checked:border-brand"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100"
        />
      </span>
    </label>
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
