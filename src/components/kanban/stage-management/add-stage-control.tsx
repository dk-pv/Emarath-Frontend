"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useStages } from "@/components/stages/stages-context";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import { createStage } from "@/services/stages-service";
import { StageSwatches } from "./stage-swatches";

/**
 * The `+` stage control in a column header (KAN-05.2 AC1). The backlog says the `+`
 * adds a stage, and the reference shows a `+` on each column header — so it lives
 * there; a new stage is appended (the Stage API appends).
 *
 * NO WORKPEX REFERENCE AVAILABLE for the add form itself (the popover/fields are not
 * captured) — this is a restrained design-system default: a small modal with a name
 * field and the colour picker. Isolated here for replacement when a recording exists.
 */
export function AddStageControl({ pipeline }: { pipeline: string }) {
  const { refresh } = useStages();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("violet");
  const [busy, setBusy] = useState(false);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setName("");
    setColor("violet");
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    createStage({ pipeline, name: trimmed, color })
      .then(() => {
        refresh();
        toast({ title: `Stage “${trimmed}” added`, tone: "success" });
        setOpen(false);
        setName("");
        setColor("violet");
      })
      .catch((error: unknown) =>
        toast({
          title: "Couldn’t add stage",
          description: error instanceof ApiError ? error.message : undefined,
          tone: "danger",
        }),
      )
      .finally(() => setBusy(false));
  };

  return (
    <>
      <IconButton
        size="sm"
        onCanvas
        aria-label="Add stage"
        onClick={() => setOpen(true)}
      >
        <IconPlus size={16} stroke={2} aria-hidden="true" />
      </IconButton>

      <Modal
        open={open}
        onClose={close}
        title="Add stage"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submit}
              disabled={busy || !name.trim()}
            >
              Add stage
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">
              Name
            </span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Stage name"
              maxLength={64}
              autoFocus
            />
          </label>
          <div>
            <span className="mb-2 block text-sm font-medium text-ink">
              Colour
            </span>
            <StageSwatches value={color} onChange={setColor} />
          </div>
        </div>
      </Modal>
    </>
  );
}
