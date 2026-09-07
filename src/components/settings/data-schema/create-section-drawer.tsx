"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { MAX_SECTION_NAME } from "@/services/data-schema-service";

/**
 * "Create a Section" — the reference's own dialog: one Section Name field over a
 * Cancel / Submit footer.
 *
 * A section is part of the form's draft, not a record of its own: it is created here and
 * persisted with the form on Save, so nothing is written until the user saves (ADR-0073).
 */
export function CreateSectionDrawer({
  open,
  existing,
  onClose,
  onCreate,
}: {
  open: boolean;
  /** The draft's section names, so a duplicate is refused before the API sees it. */
  existing: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  if (!open) return null;
  return (
    <CreateSectionForm
      existing={existing}
      onClose={onClose}
      onCreate={onCreate}
    />
  );
}

function CreateSectionForm({
  existing,
  onClose,
  onCreate,
}: {
  existing: string[];
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const error =
    trimmed === ""
      ? "Section Name is required."
      : trimmed.length > MAX_SECTION_NAME
        ? `Section Name must be ${MAX_SECTION_NAME} characters or fewer.`
        : existing.some(
              (section) => section.toLowerCase() === trimmed.toLowerCase(),
            )
          ? "This form already has a section with that name."
          : undefined;

  const submit = () => {
    if (error) {
      setTouched(true);
      return;
    }
    onCreate(trimmed);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title="Create a Section"
      footer={
        <>
          <Button variant="ghost" aria-label="Cancel Section" onClick={onClose}>
            Cancel
          </Button>
          <Button aria-label="Submit Section" onClick={submit}>
            Submit
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="section-name" className="sr-only">
          Section Name
        </label>
        <Input
          autoFocus
          size="lg"
          id="section-name"
          placeholder="Section Name"
          value={name}
          aria-invalid={touched && error ? true : undefined}
          aria-describedby={touched && error ? "section-name-error" : undefined}
          onChange={(event) => {
            setTouched(true);
            setName(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        {touched && error && (
          <p id="section-name-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  );
}
