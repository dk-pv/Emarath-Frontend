"use client";

import { useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { createTag, updateTag, type TagNode } from "@/services/tags-service";

export interface TagFormState {
  mode: "create" | "edit";
  tag: TagNode | null;
}

export interface TagFormDrawerProps {
  state: TagFormState | null;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}

/**
 * Add / Edit Tags — the Workpex drawer from the reference screenshot.
 *
 * One drawer for both modes. Editing updates the same record, so every lead keeps its
 * link through the rename (the catalogue is keyed by id, not by name).
 */
export function TagFormDrawer({ state, onClose, onSaved }: TagFormDrawerProps) {
  if (!state) return null;

  // Keyed by what is being edited, so the panel remounts — and re-seeds — whenever the
  // drawer opens on something else, with no effect to sequence.
  return (
    <TagFormPanel
      key={`${state.mode}-${state.tag?.id ?? "new"}`}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function TagFormPanel({
  state,
  onClose,
  onSaved,
}: TagFormDrawerProps & { state: TagFormState }) {
  const [name, setName] = useState(state.tag?.name ?? "");
  const [isActive, setIsActive] = useState(state.tag?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();
  const nameError = touched && trimmed === "" ? "Tags name is required." : null;

  const close = () => {
    setError(null);
    onClose();
  };

  const submit = async () => {
    // The guard is the double-submit protection: Enter and the button share this path.
    if (busy) return;
    setTouched(true);
    if (trimmed === "") return;

    setBusy(true);
    setError(null);
    try {
      if (state.mode === "edit" && state.tag) {
        await updateTag(state.tag.id, { name: trimmed, isActive });
      } else {
        await createTag({ name: trimmed, isActive });
      }
      onSaved(trimmed, state.mode);
    } catch (caught: unknown) {
      // The drawer stays open on failure so the typed name is not lost, and the API's own
      // reason is shown — a duplicate name has to say so rather than fail silently.
      setError(
        caught instanceof ApiError
          ? (caught.messages[0] ?? caught.message)
          : "Could not save this tag.",
      );
    } finally {
      setBusy(false);
    }
  };

  const heading = state.mode === "edit" ? "Edit Tags" : "Add Tags";

  return (
    <Drawer
      open
      onClose={busy ? () => {} : close}
      overlay
      title={heading}
      width="max-w-2xl"
      header={
        <header className="border-b border-hairline p-5">
          <h2 className="text-lg font-medium text-ink">{heading}</h2>
        </header>
      }
      footer={
        <>
          <Button
            variant="ghost"
            onClick={close}
            disabled={busy}
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            isLoading={busy}
            aria-label="Save Tag"
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-5">
        {error && <FormError>{error}</FormError>}

        {/*
          The reference notches the label into the field's top border rather than using it
          as a placeholder — a placeholder cannot carry the red asterisk, and the capture
          shows both the label and the placeholder at once.
        */}
        <div className="relative flex flex-col gap-1.5">
          <label
            htmlFor="tag-name"
            className="absolute -top-2 left-3 z-10 bg-surface px-1 text-xs text-ink-muted"
          >
            Tags Name
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          </label>
          <Input
            id="tag-name"
            aria-label="Tags Name"
            placeholder="Tags Name"
            value={name}
            required
            autoComplete="off"
            maxLength={80}
            size="lg"
            className="text-sm"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "tag-name-error" : undefined}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
          {nameError && (
            <p id="tag-name-error" role="alert" className="text-sm text-danger">
              {nameError}
            </p>
          )}
        </div>

        {/* The reference's filled status row, with its ⓘ between the label and the switch. */}
        <div className="flex min-h-control-lg items-center justify-between gap-3 rounded-control border border-hairline bg-canvas px-4 py-2">
          <label
            htmlFor="tag-status"
            className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-muted"
          >
            Status : {isActive ? "Active" : "Inactive"}
            <IconInfoCircle
              size={15}
              stroke={1.75}
              aria-hidden="true"
              className="shrink-0 text-ink-subtle"
            />
          </label>
          <Switch
            id="tag-status"
            aria-label="Tag status"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
        </div>
      </div>
    </Drawer>
  );
}
