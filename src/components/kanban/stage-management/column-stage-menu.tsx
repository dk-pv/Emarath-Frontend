"use client";

import { useState } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconDotsVertical,
  IconPalette,
  IconPencil,
  IconPin,
  IconPinFilled,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useStages } from "@/components/stages/stages-context";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import {
  createStage,
  deleteStage,
  reorderStages,
  updateStage,
  type Stage,
} from "@/services/stages-service";
import { StageSwatches } from "./stage-swatches";

const TRIGGER_CLASS =
  "flex size-6 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-surface hover:text-ink";

/**
 * The per-column `⋮` stage-management menu (KAN-05.2): add, rename, recolour, reorder,
 * delete a stage. "Add stage" moved here from the header `+` — the Workpex video now
 * shows that `+` is Add Lead (KAN-03.1), so the header no longer adds stages; the CRUD
 * is consolidated here rather than dropped.
 *
 * INTERIM: the Workpex video shows this `⋮` as "Actions → Pin" (a stage pin), not this
 * CRUD set. The CRUD lives here for now because it has no other home yet (Settings is a
 * navigation-only stub, FND-04.2) and must not be lost (KAN-05.2). Relocating it to a
 * management surface, and the stage-pin semantics, are pending a product decision;
 * until then this stays the reachable home for stage management.
 *
 * AC5 (controls available only to permitted roles) is deferred to the auth layer
 * (AUTH-01.3): the gate is a one-line guard here once an auth context exists.
 */
export function ColumnStageMenu({
  stage,
  isPinned,
  onTogglePin,
}: {
  stage: Stage;
  isPinned: boolean;
  onTogglePin: () => void;
}) {
  const { stages, refresh } = useStages();
  const { toast } = useToast();
  const [mode, setMode] = useState<
    null | "add" | "rename" | "recolor" | "delete"
  >(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(stage.name);
  const [color, setColor] = useState(stage.color);

  const index = stages.findIndex((s) => s.id === stage.id);
  const isFirst = index <= 0;
  const isLast = index === stages.length - 1;

  const closeMode = () => {
    if (!busy) setMode(null);
  };

  const run = (op: Promise<unknown>, okTitle: string, failTitle: string) => {
    setBusy(true);
    op.then(() => {
      refresh();
      toast({ title: okTitle, tone: "success" });
      setMode(null);
    })
      .catch((error: unknown) =>
        toast({
          title: failTitle,
          description: error instanceof ApiError ? error.message : undefined,
          tone: "danger",
        }),
      )
      .finally(() => setBusy(false));
  };

  const move = (direction: -1 | 1) => {
    const ordered = stages.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    run(
      reorderStages(stage.pipeline, ordered),
      "Stage moved",
      "Couldn’t move stage",
    );
  };

  const submitRename = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === stage.name) {
      setMode(null);
      return;
    }
    run(
      updateStage(stage.id, { name: trimmed }),
      "Stage renamed",
      "Couldn’t rename stage",
    );
  };

  const submitRecolor = () => {
    if (color === stage.color) {
      setMode(null);
      return;
    }
    run(
      updateStage(stage.id, { color }),
      "Stage recoloured",
      "Couldn’t recolour stage",
    );
  };

  // Add stage (KAN-05.2 AC1), moved here from the header "+" now that "+" is Add Lead.
  const submitAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    run(
      createStage({ pipeline: stage.pipeline, name: trimmed, color }),
      "Stage added",
      "Couldn’t add stage",
    );
  };

  const items: DropdownItem[] = [
    // The Workpex-confirmed stage action (KAN-05.2): Pin toggles this stage as the
    // caller's sticky/frozen column. Unpin restores normal scrolling. The stage-CRUD
    // below is the interim home preserved until a management surface is decided.
    {
      type: "item",
      id: "pin",
      label: isPinned ? "Unpin" : "Pin",
      icon: isPinned ? IconPinFilled : IconPin,
      onSelect: onTogglePin,
    },
    { type: "separator", id: "sep-pin" },
    {
      type: "item",
      id: "add",
      label: "Add stage",
      icon: IconPlus,
      onSelect: () => {
        setName("");
        setColor("violet");
        setMode("add");
      },
    },
    { type: "separator", id: "sep-add" },
    {
      type: "item",
      id: "rename",
      label: "Rename",
      icon: IconPencil,
      onSelect: () => {
        setName(stage.name);
        setMode("rename");
      },
    },
    {
      type: "item",
      id: "recolor",
      label: "Recolour",
      icon: IconPalette,
      onSelect: () => {
        setColor(stage.color);
        setMode("recolor");
      },
    },
    { type: "separator", id: "sep-order" },
    {
      type: "item",
      id: "left",
      label: "Move left",
      icon: IconArrowLeft,
      disabled: isFirst,
      onSelect: () => move(-1),
    },
    {
      type: "item",
      id: "right",
      label: "Move right",
      icon: IconArrowRight,
      disabled: isLast,
      onSelect: () => move(1),
    },
    { type: "separator", id: "sep-delete" },
    {
      type: "item",
      id: "delete",
      label: "Delete",
      icon: IconTrash,
      onSelect: () => setMode("delete"),
    },
  ];

  return (
    <>
      <Dropdown
        align="end"
        trigger={
          <span className={TRIGGER_CLASS}>
            <IconDotsVertical size={16} stroke={2} aria-hidden="true" />
            <span className="sr-only">{stage.name} stage options</span>
          </span>
        }
        items={items}
      />

      <Modal
        open={mode === "add"}
        onClose={closeMode}
        title="Add stage"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeMode} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitAdd}
              disabled={busy || !name.trim()}
            >
              Add stage
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-ink">Name</span>
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

      <Modal
        open={mode === "rename"}
        onClose={closeMode}
        title="Rename stage"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeMode} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitRename}
              disabled={busy || !name.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Name</span>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={64}
            autoFocus
          />
        </label>
      </Modal>

      <Modal
        open={mode === "recolor"}
        onClose={closeMode}
        title="Recolour stage"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeMode} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitRecolor} disabled={busy}>
              Save
            </Button>
          </>
        }
      >
        <StageSwatches value={color} onChange={setColor} />
      </Modal>

      <ConfirmDialog
        open={mode === "delete"}
        onCancel={closeMode}
        onConfirm={() =>
          run(deleteStage(stage.id), "Stage deleted", "Couldn’t delete stage")
        }
        title="Delete stage"
        description={`Delete the “${stage.name}” stage? A stage that still holds leads can’t be deleted.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </>
  );
}
