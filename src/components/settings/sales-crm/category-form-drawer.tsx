"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormError } from "@/components/ui/FormError";
import { Input } from "@/components/ui/Input";
import {
  createCategory,
  updateCategory,
  type CategoryTreeNode,
} from "@/services/categories-service";
import { ToggleField } from "./setting-controls";

export interface CategoryFormState {
  mode: "create" | "edit";
  /** Set by the row's inline "+ Add Category": the new category's parent. */
  parent: CategoryTreeNode | null;
  category: CategoryTreeNode | null;
}

export interface CategoryFormDrawerProps {
  state: CategoryFormState | null;
  onClose: () => void;
  onSaved: (name: string, mode: "create" | "edit") => void;
}

/**
 * Add / Edit Category — the Workpex drawer from the reference screenshot.
 *
 * One drawer for both modes, as the reference shows: the same two fields, the same footer.
 * Edit prefills from the row and creates nothing new.
 *
 * The reference renders the field's label *inside* the box, grey with a red asterisk, so
 * it is drawn as an overlay rather than as a placeholder — a placeholder cannot tint one
 * character. A visually-hidden `<label>` keeps the input named for assistive tech. Workpex
 * floats that label above the box once the field has content; there is no float here, and
 * the label is simply replaced by what the user typed.
 */
export function CategoryFormDrawer({
  state,
  onClose,
  onSaved,
}: CategoryFormDrawerProps) {
  if (!state) return null;

  // Keyed by what is being edited, so the panel remounts — and re-seeds — whenever the
  // drawer opens on something else. The form's state is therefore created by the mount
  // itself, exactly as `Drawer` creates its slide-in state, with no effect to sequence.
  return (
    <CategoryFormPanel
      key={`${state.mode}-${state.category?.id ?? state.parent?.id ?? "root"}`}
      state={state}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}

function CategoryFormPanel({
  state,
  onClose,
  onSaved,
}: CategoryFormDrawerProps & { state: CategoryFormState }) {
  const [name, setName] = useState(state.category?.name ?? "");
  const [isActive, setIsActive] = useState(state.category?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const trimmed = name.trim();
  const nameError = touched && trimmed === "" ? "Category name is required." : null;

  const close = () => {
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (busy) return;
    setTouched(true);
    if (trimmed === "") return;

    setBusy(true);
    setError(null);
    try {
      if (state.mode === "edit" && state.category) {
        await updateCategory(state.category.id, { name: trimmed, isActive });
      } else {
        await createCategory({
          name: trimmed,
          isActive,
          ...(state.parent ? { parentId: state.parent.id } : {}),
        });
      }
      onSaved(trimmed, state.mode);
    } catch (caught: unknown) {
      // The drawer stays open on failure so the typed name is not lost.
      setError(
        caught instanceof ApiError
          ? (caught.messages[0] ?? caught.message)
          : "Could not save this category.",
      );
    } finally {
      setBusy(false);
    }
  };

  const heading =
    state.mode === "edit"
      ? "Edit Category"
      : state.parent
        ? `Add Category under ${state.parent.name}`
        : "Add Category";

  return (
    <Drawer
      open
      onClose={close}
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
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} isLoading={busy}>
            Submit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pt-5">
        {error && <FormError>{error}</FormError>}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="category-name" className="sr-only">
            Category Name
          </label>
          <div className="relative">
            <Input
              id="category-name"
              value={name}
              required
              autoComplete="off"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "category-name-error" : undefined}
              size="lg"
                    className="text-sm"
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
            />
            {name === "" && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-field-x text-sm text-ink-subtle"
              >
                Category Name <span className="ml-0.5 text-danger">*</span>
              </span>
            )}
          </div>
          {nameError && (
            <p id="category-name-error" role="alert" className="text-sm text-danger">
              {nameError}
            </p>
          )}
        </div>

        <ToggleField
          id="category-status"
          showInfo={false}
          label={`Status : ${isActive ? "Active" : "Inactive"}`}
          checked={isActive}
          onChange={setIsActive}
        />
      </div>
    </Drawer>
  );
}
