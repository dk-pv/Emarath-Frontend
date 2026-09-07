"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconGripVertical, IconInfoCircle } from "@tabler/icons-react";
import { ApiError, isAbortError } from "@/lib/api-client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormError } from "@/components/ui/FormError";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { RadioCard } from "@/components/settings/sales-crm/setting-controls";
import {
  DISPLAY_ON_CARDS,
  DISPLAY_ON_CARDS_LABELS,
  DashboardFieldCatalogue,
  DashboardFieldOption,
  DashboardSettings,
  DisplayOnCards,
  SummaryMode,
  fetchDashboardFields,
  fetchDashboardSettings,
  saveDashboardSettings,
} from "@/services/application-controls-service";

/** The two summary modes, as the reference's radio cards label them. */
const MODES: { value: SummaryMode; label: string }[] = [
  { value: "LEAD_STAGE", label: "Lead Stage" },
  { value: "LEAD_SOURCE", label: "Lead Source" },
];

/** Which half of the configuration a mode owns. Both are kept, always. */
const MODE_FIELD = {
  LEAD_STAGE: "leadStage",
  LEAD_SOURCE: "leadSource",
} as const satisfies Record<SummaryMode, keyof DashboardFieldCatalogue>;

const DISPLAY_OPTIONS = DISPLAY_ON_CARDS.map((value) => ({
  value,
  label: DISPLAY_ON_CARDS_LABELS[value],
}));

/**
 * Settings → Application Controls → Dashboard Settings.
 *
 * The reference's screen: an orange Dashboard Configuration banner, a Lead Stage /
 * Lead Source radio pair, the Display On Cards select, and the two-panel builder —
 * blue Available Options, green Selected Options — over a Cancel/Save footer.
 *
 * **Both modes are held and saved together.** Switching to Lead Source cannot disturb
 * the Lead Stage selection because the draft carries both lists at all times and Save
 * writes both; the mode only decides which one the panels are showing. Cards are
 * identified by the stage or source *name*, which is what a lead actually stores in
 * `status` / `source` — the same identity the Kanban board groups by.
 *
 * What is configured here is what the Dashboard renders: `/api/dashboard/summary`
 * returns exactly these cards, in this order, counting and summing under the caller's
 * own role scope.
 */
export function DashboardSettingsView() {
  const { toast } = useToast();

  const [saved, setSaved] = useState<DashboardSettings | null>(null);
  const [draft, setDraft] = useState<DashboardSettings | null>(null);
  const [catalogue, setCatalogue] = useState<DashboardFieldCatalogue | null>(
    null,
  );
  const [failed, setFailed] = useState<false | "error" | "forbidden">(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const [availableQuery, setAvailableQuery] = useState("");
  const [selectedQuery, setSelectedQuery] = useState("");

  // The key being dragged lives in a ref, not state: `dragover` fires in the same tick
  // as `dragstart`, and a state write would not have landed in time for the first move.
  const dragKey = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    Promise.all([
      fetchDashboardSettings(controller.signal),
      fetchDashboardFields(controller.signal),
    ])
      .then(([settings, fields]) => {
        if (!active) return;
        setSaved(settings);
        setDraft(settings);
        setCatalogue(fields);
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

  const mode = draft?.summaryMode ?? "LEAD_STAGE";
  const modeField = MODE_FIELD[mode];
  // Memoised because both are `??` fallbacks: a fresh [] each render would re-run
  // every list below it for no reason.
  const selection = useMemo(() => draft?.[modeField] ?? [], [draft, modeField]);
  const options = useMemo(
    () => catalogue?.[modeField] ?? [],
    [catalogue, modeField],
  );

  const optionsByKey = useMemo(
    () => new Map(options.map((option) => [option.fieldKey, option])),
    [options],
  );

  /** Everything the catalogue offers that this mode has not taken. */
  const available = useMemo(() => {
    const taken = new Set(selection.map((card) => card.fieldKey));
    return options.filter((option) => !taken.has(option.fieldKey));
  }, [options, selection]);

  /** Selected rows resolved back to their labels, in configured order. */
  const selected = useMemo(
    () =>
      selection.map(
        (card) =>
          optionsByKey.get(card.fieldKey) ?? {
            fieldKey: card.fieldKey,
            // A key whose catalogue entry has since gone is still shown, so it can be
            // removed deliberately rather than vanishing on the next save.
            label: card.fieldKey,
          },
      ),
    [selection, optionsByKey],
  );

  const dirty = draft !== null && saved !== null && !sameSettings(draft, saved);

  /** Replaces the current mode's list; the other mode's is carried through untouched. */
  const setSelection = (
    next: (current: DashboardSettings[typeof modeField]) => string[],
  ) =>
    setDraft((current) =>
      current === null
        ? current
        : {
            ...current,
            [modeField]: next(current[modeField]).map((fieldKey, index) => ({
              fieldKey,
              position: index + 1,
            })),
          },
    );

  const add = (fieldKey: string) =>
    setSelection((current) => [
      ...current.map((card) => card.fieldKey),
      fieldKey,
    ]);

  const remove = (fieldKey: string) =>
    setSelection((current) =>
      current.map((card) => card.fieldKey).filter((key) => key !== fieldKey),
    );

  const move = (fieldKey: string, target: number) =>
    setSelection((current) => {
      const keys = current.map((card) => card.fieldKey);
      const from = keys.indexOf(fieldKey);
      if (from === -1) return keys;
      const to = Math.max(0, Math.min(keys.length - 1, target));
      if (from === to) return keys;
      const next = [...keys];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });

  const submit = async () => {
    if (draft === null || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const stored = await saveDashboardSettings(draft);
      setSaved(stored);
      setDraft(stored);
      toast({ title: "Dashboard Settings saved", tone: "success" });
    } catch (error: unknown) {
      // The draft survives a failed save — losing a configuration someone just built
      // because the network blinked is not an acceptable outcome.
      setSaveError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save the dashboard configuration.",
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
              : "Couldn't load Dashboard Settings"
          }
          description={
            failed === "forbidden"
              ? "Application Controls are limited to administrator accounts. Sign in as an administrator and try again."
              : "The configuration could not be reached. Check your connection and try again."
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
        <h2 className="text-xl font-semibold text-ink">Dashboard Settings</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Manage how the app dashboard is configured and displayed
        </p>
      </div>

      <div className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-5">
        <Alert
          tone="warning"
          icon={IconInfoCircle}
          title="Dashboard Configuration"
        >
          Configure the app dashboard summary by selecting Lead Stage or Lead
          Source. Dashboard cards update automatically based on your selection.
        </Alert>

        {draft === null ? (
          <>
            <Skeleton className="h-6 w-48" aria-hidden="true" />
            <Skeleton className="h-12 w-full" aria-hidden="true" />
            <Skeleton className="h-64 w-full" aria-hidden="true" />
          </>
        ) : (
          <>
            {saveError && <FormError>{saveError}</FormError>}

            <div className="flex flex-col gap-2">
              <FieldLabel>View Summary Based on</FieldLabel>
              <div
                role="radiogroup"
                aria-label="View Summary Based on"
                className="grid gap-4 sm:grid-cols-2"
              >
                {MODES.map((option) => (
                  <RadioCard
                    key={option.value}
                    name="dashboard-summary-mode"
                    value={option.value}
                    checked={mode === option.value}
                    onSelect={(value) => {
                      // Only the view changes: both lists stay in the draft, so
                      // switching away and back returns the same configuration.
                      setDraft({
                        ...draft,
                        summaryMode: value as SummaryMode,
                      });
                      setAvailableQuery("");
                      setSelectedQuery("");
                    }}
                  >
                    {option.label}
                  </RadioCard>
                ))}
              </div>
            </div>

            {/* The reference shows Display On Cards under Lead Stage only; no capture
                pairs it with Lead Source, so it is not drawn there (§16.4). */}
            {mode === "LEAD_STAGE" && (
              <div className="flex max-w-md flex-col gap-2">
                <FieldLabel htmlFor="display-on-cards">
                  Display On Cards
                </FieldLabel>
                <Select
                  id="display-on-cards"
                  aria-label="Display On Cards"
                  options={DISPLAY_OPTIONS}
                  value={draft.displayOnCards}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      displayOnCards: event.target.value as DisplayOnCards,
                    })
                  }
                />
              </div>
            )}

            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <OptionPanel
                title="Available Options"
                tone="available"
                count={available.length}
                query={availableQuery}
                onQuery={setAvailableQuery}
              >
                {available
                  .filter((option) => matches(option, availableQuery))
                  .map((option) => (
                    <OptionRow
                      key={option.fieldKey}
                      option={option}
                      tone="available"
                      onActivate={() => add(option.fieldKey)}
                    />
                  ))}
              </OptionPanel>

              <OptionPanel
                title="Selected Options"
                tone="selected"
                count={selected.length}
                query={selectedQuery}
                onQuery={setSelectedQuery}
              >
                {selected
                  .filter((option) => matches(option, selectedQuery))
                  .map((option, index) => (
                    <OptionRow
                      key={option.fieldKey}
                      option={option}
                      tone="selected"
                      dimmed={dragging === option.fieldKey}
                      onActivate={() => remove(option.fieldKey)}
                      onStep={(delta) =>
                        move(
                          option.fieldKey,
                          selected.findIndex(
                            (row) => row.fieldKey === option.fieldKey,
                          ) + delta,
                        )
                      }
                      onDragStart={() => {
                        dragKey.current = option.fieldKey;
                        setDragging(option.fieldKey);
                      }}
                      onDragEnd={() => {
                        dragKey.current = null;
                        setDragging(null);
                      }}
                      onDragOver={() => {
                        const held = dragKey.current;
                        // Search filters the view, not the list — reorder only while
                        // the whole list is on screen, so a drop lands where it looks.
                        if (held && held !== option.fieldKey) {
                          move(held, index);
                        }
                      }}
                    />
                  ))}
              </OptionPanel>
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
            if (saved !== null) setDraft(saved);
          }}
        >
          Cancel
        </Button>
        <Button
          aria-label="Save Dashboard Settings"
          onClick={() => void submit()}
          isLoading={busy}
          disabled={draft === null || !dirty}
        >
          Save
        </Button>
      </footer>
    </Card>
  );
}

/**
 * A plain field label. Not the shared `SettingLabel`: that one always carries the ⓘ the
 * Sales & CRM forms show, and neither label on this screen has one in the reference.
 */
function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm text-ink-muted">
      {children}
    </label>
  );
}

/** Two configurations are the same when both modes and both switches are. */
function sameSettings(a: DashboardSettings, b: DashboardSettings): boolean {
  const sameList = (
    x: DashboardSettings["leadStage"],
    y: DashboardSettings["leadStage"],
  ) =>
    x.length === y.length &&
    x.every((card, index) => card.fieldKey === y[index].fieldKey);

  return (
    a.summaryMode === b.summaryMode &&
    a.displayOnCards === b.displayOnCards &&
    sameList(a.leadStage, b.leadStage) &&
    sameList(a.leadSource, b.leadSource)
  );
}

/** Case-insensitive, against the only text a dashboard option has. */
function matches(option: DashboardFieldOption, query: string): boolean {
  const term = query.trim().toLowerCase();
  return term === "" || option.label.toLowerCase().includes(term);
}

/**
 * One panel of the builder. The same shape the Lead Form builder uses, kept local:
 * dashboard options are a different configuration domain with no type, visibility or
 * section of their own, and sharing a row component would mean carrying that weight.
 */
function OptionPanel({
  title,
  tone,
  count,
  query,
  onQuery,
  children,
}: {
  title: string;
  tone: "available" | "selected";
  count: number;
  query: string;
  onQuery: (value: string) => void;
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

      <div className="border-b border-hairline p-3">
        <PanelSearch
          aria-label={`Search ${title}`}
          placeholder="Search field..."
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
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
              ? "No options"
              : "No option matches that search"}
          </li>
        )}
      </ul>
    </section>
  );
}

/**
 * One option row: click, Enter or Space moves it between panels; Arrow Up/Down reorders
 * a selected one. HTML5 drag alone is unreachable from a keyboard and unusable on touch,
 * so it is the addition rather than the mechanism.
 */
function OptionRow({
  option,
  tone,
  dimmed = false,
  onActivate,
  onStep,
  onDragStart,
  onDragEnd,
  onDragOver,
}: {
  option: DashboardFieldOption;
  tone: "available" | "selected";
  dimmed?: boolean;
  onActivate: () => void;
  onStep?: (delta: -1 | 1) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={tone === "selected"}
      tabIndex={0}
      draggable={tone === "selected"}
      aria-label={`${option.label}, ${tone === "selected" ? "selected" : "available"}`}
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
        // The reference draws both panels' rows the same white; the panel header is
        // what says which side a row is on, not a tint.
        "border-hairline bg-surface text-ink hover:border-brand/40",
        tone === "selected" ? "cursor-grab" : "cursor-pointer",
        dimmed && "opacity-60",
      )}
    >
      <IconGripVertical
        size={16}
        stroke={1.75}
        aria-hidden="true"
        className="shrink-0 text-ink-subtle"
      />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
    </li>
  );
}
