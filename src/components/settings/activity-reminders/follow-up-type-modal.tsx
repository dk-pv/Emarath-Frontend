"use client";

import { useMemo, useRef, useState } from "react";
import { IconGripVertical } from "@tabler/icons-react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/cn";
import {
  FOLLOW_UP_FIELDS,
  FOLLOW_UP_FIELD_LABELS,
  MAX_FOLLOW_UP_TYPE_NAME,
  REQUIRED_FOLLOW_UP_FIELDS,
  createFollowUpType,
  updateFollowUpType,
  type FollowUpFieldKey,
  type FollowUpType,
} from "@/services/activity-settings-service";

export type FollowUpTypeFormState =
  | { mode: "create" }
  | { mode: "edit"; type: FollowUpType };

const ALL_KEYS = FOLLOW_UP_FIELDS.map((field) => field.key);

/** A brand-new type opens with the five the reference's Selected panel opens with. */
const DEFAULT_SELECTED: FollowUpFieldKey[] = [...REQUIRED_FOLLOW_UP_FIELDS];

const isRequired = (key: FollowUpFieldKey) =>
  REQUIRED_FOLLOW_UP_FIELDS.includes(key);

const countLabel = (n: number) => `${n} ${n === 1 ? "Field" : "Fields"}`;

/**
 * Add / Edit Follow Up Type.
 *
 * Remounted per target by the caller's `key`, so opening a different type never shows the
 * previous one's draft.
 */
export function FollowUpTypeModal({
  state,
  onClose,
  onSaved,
}: {
  state: FollowUpTypeFormState | null;
  onClose: () => void;
  onSaved: (types: FollowUpType[], name: string, mode: "create" | "edit") => void;
}) {
  if (!state) return null;
  return (
    <FollowUpTypeForm
      key={state.mode === "edit" ? state.type.id : "create"}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function FollowUpTypeForm({
  state,
  onClose,
  onSaved,
}: {
  state: FollowUpTypeFormState;
  onClose: () => void;
  onSaved: (types: FollowUpType[], name: string, mode: "create" | "edit") => void;
}) {
  const editing = state.mode === "edit" ? state.type : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [selected, setSelected] = useState<FollowUpFieldKey[]>(() =>
    editing
      ? [...editing.fields]
          .sort((a, b) => a.position - b.position)
          .map((field) => field.key)
      : DEFAULT_SELECTED,
  );

  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const available = useMemo(
    () => ALL_KEYS.filter((key) => !selected.includes(key)),
    [selected],
  );

  const trimmed = name.trim();
  const nameError =
    trimmed === ""
      ? "Follow Up Type Name is required."
      : trimmed.length > MAX_FOLLOW_UP_TYPE_NAME
        ? `Follow Up Type Name must be ${MAX_FOLLOW_UP_TYPE_NAME} characters or fewer.`
        : undefined;
  const shownNameError = touched ? nameError : undefined;

  /** A field crosses panels; a required one is refused rather than silently ignored. */
  const move = (key: FollowUpFieldKey) => {
    setFormError(null);
    if (selected.includes(key)) {
      if (isRequired(key)) {
        setFormError(
          `${FOLLOW_UP_FIELD_LABELS[key]} is required to create a follow-up, so it stays selected.`,
        );
        return;
      }
      setSelected((current) => current.filter((item) => item !== key));
      return;
    }
    setSelected((current) => [...current, key]);
  };

  /** Reorder within Selected: `key` lands where `target` currently sits. */
  const reorder = (key: FollowUpFieldKey, target: FollowUpFieldKey) => {
    if (key === target) return;
    setSelected((current) => {
      if (!current.includes(key) || !current.includes(target)) return current;
      const next = current.filter((item) => item !== key);
      next.splice(next.indexOf(target), 0, key);
      return next;
    });
  };

  const submit = async () => {
    if (busy) return;
    if (nameError) {
      setTouched(true);
      setFormError("Fix the highlighted field and try again.");
      return;
    }

    setBusy(true);
    setFormError(null);
    const payload = {
      name: trimmed,
      isActive,
      // Position is the persisted order, sent explicitly rather than implied by the array.
      fields: selected.map((key, index) => ({ key, position: index + 1 })),
    };

    try {
      const types = editing
        ? await updateFollowUpType(editing.id, payload)
        : await createFollowUpType(payload);
      onSaved(types, trimmed, editing ? "edit" : "create");
    } catch (error: unknown) {
      // The dialog stays open: a refused save must not look like a success.
      setFormError(
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : "Could not save this follow up type.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      size="xl"
      title={editing ? "Edit Follow Up Type" : "Add Follow Up Type"}
      footer={
        <>
          <Button
            variant="ghost"
            aria-label="Cancel"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            aria-label="Save Follow Up Type"
            onClick={() => void submit()}
            isLoading={busy}
            disabled={Boolean(nameError)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {formError && <FormError>{formError}</FormError>}

        <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="follow-up-type-name"
              className="flex items-center gap-1 text-sm text-ink-muted"
            >
              Follow Up Type Name <span className="text-danger">*</span>
            </label>
            <Input
              autoFocus
              size="lg"
              id="follow-up-type-name"
              placeholder="Add a Form Name"
              value={name}
              aria-invalid={shownNameError ? true : undefined}
              aria-describedby={
                shownNameError ? "follow-up-type-name-error" : undefined
              }
              onChange={(event) => {
                setTouched(true);
                setFormError(null);
                setName(event.target.value);
              }}
            />
            {shownNameError && (
              <p
                id="follow-up-type-name-error"
                role="alert"
                className="text-sm text-danger"
              >
                {shownNameError}
              </p>
            )}
          </div>

          {/* The reference's status row: the label states the value, the switch sets it. */}
          <div className="flex min-h-control-lg items-center justify-between gap-3 self-end rounded-control border border-hairline bg-canvas px-4 py-2">
            <label
              htmlFor="follow-up-type-status"
              className="cursor-pointer text-sm text-ink-muted"
            >
              Status : {isActive ? "Active" : "Inactive"}
            </label>
            <Switch
              id="follow-up-type-status"
              aria-label="Follow Up Type status"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
          </div>
        </div>

        {/* Two panels on a desktop, stacked once there is no room for two. */}
        <div className="grid gap-4 md:grid-cols-2">
          <FieldPanel
            title="Available Options"
            tone="available"
            keys={available}
            onMove={move}
          />
          <FieldPanel
            title="Selected Options"
            tone="selected"
            keys={selected}
            onMove={move}
            onReorder={reorder}
          />
        </div>
      </div>
    </Modal>
  );
}

/**
 * One panel of the builder: a tinted header with a live count, its own search, and the
 * draggable field rows.
 *
 * The rows carry no buttons, matching the reference — so they are made operable without
 * adding chrome: a row is a listbox option that moves on click, Enter or Space, and
 * reorders on Arrow Up/Down. HTML5 drag alone would leave the builder unusable on a touch
 * screen and unreachable from a keyboard.
 */
function FieldPanel({
  title,
  tone,
  keys,
  onMove,
  onReorder,
}: {
  title: string;
  tone: "available" | "selected";
  keys: FollowUpFieldKey[];
  onMove: (key: FollowUpFieldKey) => void;
  onReorder?: (key: FollowUpFieldKey, target: FollowUpFieldKey) => void;
}) {
  const [query, setQuery] = useState("");
  /*
    The row being dragged lives in a ref as well as in state: `dragover` can fire in the
    same tick as `dragstart`, before React has re-rendered, and a handler reading only the
    state would still see `null` and drop the reorder. The state is for the dimmed row.
  */
  const dragging = useRef<FollowUpFieldKey | null>(null);
  const [dragKey, setDragKey] = useState<FollowUpFieldKey | null>(null);

  const term = query.trim().toLowerCase();
  const shown = term
    ? keys.filter((key) =>
        FOLLOW_UP_FIELD_LABELS[key].toLowerCase().includes(term),
      )
    : keys;

  const step = (key: FollowUpFieldKey, delta: -1 | 1) => {
    if (!onReorder) return;
    const target = keys[keys.indexOf(key) + delta];
    if (target) onReorder(key, target);
  };

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
          {countLabel(keys.length)}
        </span>
      </header>

      <div className="border-b border-hairline p-3">
        <PanelSearch
          aria-label={`Search ${title}`}
          placeholder="Search field..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <ul
        role="listbox"
        aria-label={title}
        className="scrollbar-slim flex min-h-32 flex-col gap-2 overflow-y-auto p-3"
        onDragOver={(event) => event.preventDefault()}
      >
        {shown.map((key) => (
          <li
            key={key}
            role="option"
            aria-selected={tone === "selected"}
            tabIndex={0}
            draggable
            aria-label={`${FOLLOW_UP_FIELD_LABELS[key]}, ${
              tone === "selected" ? "selected" : "available"
            }`}
            onClick={() => onMove(key)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onMove(key);
                return;
              }
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                step(key, event.key === "ArrowUp" ? -1 : 1);
              }
            }}
            onDragStart={() => {
              dragging.current = key;
              setDragKey(key);
            }}
            onDragEnd={() => {
              dragging.current = null;
              setDragKey(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              const held = dragging.current;
              if (held && held !== key) onReorder?.(held, key);
            }}
            className={cn(
              "focus-ring flex cursor-grab items-center gap-3 rounded-control border px-4 py-3 text-sm transition-colors duration-(--duration-shell) ease-shell",
              tone === "selected"
                ? "border-rose-200 bg-rose-50 text-ink"
                : "border-hairline bg-surface text-ink hover:border-brand/40",
              dragKey === key && "opacity-60",
            )}
          >
            <IconGripVertical
              size={16}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 text-ink-subtle"
            />
            <span className="truncate">{FOLLOW_UP_FIELD_LABELS[key]}</span>
          </li>
        ))}

        {shown.length === 0 && (
          <li className="px-1 py-2 text-sm text-ink-muted">
            {keys.length === 0 ? "No fields" : "No field matches that search"}
          </li>
        )}
      </ul>
    </section>
  );
}
