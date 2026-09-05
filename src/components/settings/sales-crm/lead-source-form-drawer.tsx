"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import {
  createLeadSource,
  updateLeadSource,
  type LeadSourceNode,
} from "@/services/lead-sources-service";
import { ToggleField } from "./setting-controls";

export interface LeadSourceFormState {
  mode: "create" | "edit";
  source: LeadSourceNode | null;
}

export interface LeadSourceFormDrawerProps {
  state: LeadSourceFormState | null;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}

/**
 * Add / Edit Lead Source — the Workpex drawer from the reference screenshot.
 *
 * One drawer for both modes, as the reference shows: the same two controls and the same
 * Cancel / Submit footer. Edit prefills from the row and updates that same record; the
 * API keeps the original author and creation stamp, so editing never rewrites them.
 *
 * Unlike the Category drawer, the reference draws this field with an ordinary grey
 * placeholder and no asterisk inside the box, so that is what is built here.
 */
export function LeadSourceFormDrawer({
  state,
  onClose,
  onSaved,
}: LeadSourceFormDrawerProps) {
  if (!state) return null;

  // Keyed by what is being edited, so the panel remounts — and re-seeds — whenever the
  // drawer opens on something else. The form's state is therefore created by the mount
  // itself, exactly as `Drawer` creates its slide-in state, with no effect to sequence.
  return (
    <LeadSourceFormPanel
      key={`${state.mode}-${state.source?.id ?? "new"}`}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function LeadSourceFormPanel({
  state,
  onClose,
  onSaved,
}: LeadSourceFormDrawerProps & { state: LeadSourceFormState }) {
  const [name, setName] = useState(state.source?.name ?? "");
  const [isActive, setIsActive] = useState(state.source?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();
  const nameError =
    touched && trimmed === "" ? "Source name is required." : null;

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
      if (state.mode === "edit" && state.source) {
        await updateLeadSource(state.source.id, { name: trimmed, isActive });
      } else {
        await createLeadSource({ name: trimmed, isActive });
      }
      onSaved(trimmed, state.mode);
    } catch (caught: unknown) {
      // The drawer stays open on failure so the typed name is not lost, and the API's own
      // reason is shown — a duplicate name has to say so rather than fail silently.
      setError(
        caught instanceof ApiError
          ? (caught.messages[0] ?? caught.message)
          : "Could not save this lead source.",
      );
    } finally {
      setBusy(false);
    }
  };

  const heading = state.mode === "edit" ? "Edit Lead Source" : "Add Lead Source";

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
            aria-label="Submit Lead Source"
          >
            Submit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-5">
        {error && <FormError>{error}</FormError>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="lead-source-name" className="sr-only">
            Source Name
          </label>
          <Input
            id="lead-source-name"
            aria-label="Source Name"
            placeholder="Source Name"
            value={name}
            required
            autoComplete="off"
            maxLength={64}
            size="lg"
            className="text-sm"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "lead-source-name-error" : undefined}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
          {nameError && (
            <p
              id="lead-source-name-error"
              role="alert"
              className="text-sm text-danger"
            >
              {nameError}
            </p>
          )}
        </div>

        <ToggleField
          id="lead-source-status"
          ariaLabel="Lead Source status"
          showInfo={false}
          label={`Status : ${isActive ? "Active" : "Inactive"}`}
          checked={isActive}
          onChange={setIsActive}
        />
      </div>
    </Drawer>
  );
}
