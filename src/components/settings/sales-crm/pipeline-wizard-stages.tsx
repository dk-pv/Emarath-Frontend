"use client";

import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PanelSearch } from "@/components/ui/PanelSearch";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { STAGE_COLOR_KEYS } from "@/lib/stage-palette";
import {
  createStage,
  deleteStage,
  reorderStages,
  updateStage,
  type Stage,
} from "@/services/stages-service";
import { StageCard, type StagePatch } from "./stage-card";

/**
 * Step 2 of the Sales Pipeline wizard — the reference's Open Stages / Closed Stages panels.
 *
 * Every control writes straight through to the stage API (KAN-05.1): adding, renaming,
 * recolouring, reordering and deleting are real records, never buffered UI objects, so
 * what the Kanban board reads and what this screen shows can never diverge. The parent
 * owns the stage list and re-reads it after each write.
 */
export function PipelineWizardStages({
  pipeline,
  stages,
  onChanged,
}: {
  pipeline: string;
  stages: Stage[];
  onChanged: () => Promise<void> | void;
}) {
  return (
    <div className="grid items-start gap-5 p-5 lg:grid-cols-2">
      <StagePanel
        tone="open"
        title="Open Stages"
        addLabel="Add Open Stage"
        pipeline={pipeline}
        stages={stages.filter((stage) => !stage.isClosed)}
        allStages={stages}
        onChanged={onChanged}
      />
      <StagePanel
        tone="closed"
        title="Closed Stages"
        addLabel="Add Closed Stage"
        pipeline={pipeline}
        stages={stages.filter((stage) => stage.isClosed)}
        allStages={stages}
        onChanged={onChanged}
      />
    </div>
  );
}

/** The reference's green open header and pink closed header. */
const PANEL_HEADER = {
  open: "bg-green-200 text-green-900",
  closed: "bg-red-300 text-red-900",
} as const;

function StagePanel({
  tone,
  title,
  addLabel,
  pipeline,
  stages,
  allStages,
  onChanged,
}: {
  tone: "open" | "closed";
  title: string;
  addLabel: string;
  pipeline: string;
  /** This panel's stages, in order. */
  stages: Stage[];
  /** Every stage of the pipeline — the reorder endpoint wants each one exactly once. */
  allStages: Stage[];
  onChanged: () => Promise<void> | void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Stage | null>(null);
  const [removing, setRemoving] = useState(false);

  const term = search.trim().toLowerCase();
  // Filtering never reorders: the panel keeps stage order and only hides non-matches.
  const shown = term
    ? stages.filter((stage) => stage.name.toLowerCase().includes(term))
    : stages;

  const fail = (error: unknown, fallback: string) =>
    toast({
      title:
        error instanceof ApiError
          ? (error.messages[0] ?? error.message)
          : fallback,
      tone: "danger",
    });

  const add = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // A distinct default name, so the API's per-pipeline uniqueness rule never rejects
      // the very first click; the user renames it in place afterwards.
      const base = tone === "open" ? "New Stage" : "Closed Stage";
      const taken = new Set(allStages.map((stage) => stage.name));
      let name = base;
      for (let n = 2; taken.has(name); n += 1) name = `${base} ${n}`;

      await createStage({
        pipeline,
        name,
        color: STAGE_COLOR_KEYS[allStages.length % STAGE_COLOR_KEYS.length],
        isClosed: tone === "closed",
        ...(tone === "closed" ? { outcome: "WON" } : {}),
      });
      await onChanged();
    } catch (error: unknown) {
      fail(error, "Could not add this stage.");
    } finally {
      setBusy(false);
    }
  };

  const patch = async (id: string, input: StagePatch) => {
    try {
      await updateStage(id, input);
    } catch (error: unknown) {
      fail(error, "Could not update this stage.");
    } finally {
      // Re-read either way: on success to pick up the stored row, on failure to drop
      // whatever the card was showing in favour of what the server actually holds.
      await onChanged();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await deleteStage(deleting.id);
      setDeleting(null);
      await onChanged();
    } catch (error: unknown) {
      // The API refuses a stage that still holds leads; its reason is the useful message,
      // and the card stays exactly where it was.
      fail(error, "Could not delete this stage.");
      setDeleting(null);
    } finally {
      setRemoving(false);
    }
  };

  /** Drops `dragged` before `target`, then persists the whole pipeline's new order. */
  const drop = async (targetId: string) => {
    const sourceId = dragged;
    setDragged(null);
    if (!sourceId || sourceId === targetId) return;

    const order = stages.map((stage) => stage.id);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(to, 0, ...order.splice(from, 1));

    try {
      // The endpoint wants every stage of the pipeline exactly once, so the other panel's
      // ids ride along in their existing order — sending only this panel's would be
      // rejected, and would drop the rest of the pipeline's ordering.
      const moved = new Set(order);
      const others = allStages
        .filter((stage) => !moved.has(stage.id))
        .map((stage) => stage.id);
      await reorderStages(pipeline, [...order, ...others]);
    } catch (error: unknown) {
      fail(error, "Could not reorder the stages.");
    } finally {
      await onChanged();
    }
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-surface border border-hairline">
      <header
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 px-4 py-3",
          PANEL_HEADER[tone],
        )}
      >
        <h4 className="text-base font-semibold">{title}</h4>
        {/* Reference wording, including its "1 Stages" (CLAUDE.md §1). */}
        <span className="shrink-0 rounded-full bg-white px-3 py-0.5 text-xs font-medium text-ink">
          {stages.length} Stages
        </span>
      </header>

      <div className="flex shrink-0 items-center gap-3 border-b border-hairline p-3">
        <PanelSearch
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Stage..."
          aria-label={`Search ${title}`}
        />
        <Button
          className="shrink-0"
          onClick={() => void add()}
          isLoading={busy}
          aria-label={addLabel}
        >
          <IconPlus size={16} stroke={2} aria-hidden="true" />
          {addLabel}
        </Button>
      </div>

      {/*
        No inner scroller: the wizard body already scrolls, and a nested one would crop the
        colour popover and the selects. Both are portalled as well, so neither depends on
        this element's overflow.
      */}
      <div className="flex flex-col gap-3 p-3">
        {shown.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-ink-muted">
            {term ? `No stage matches “${search.trim()}”.` : "No stages yet."}
          </p>
        ) : (
          shown.map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              dragging={dragged === stage.id}
              onDragStart={() => setDragged(stage.id)}
              onDrop={() => void drop(stage.id)}
              onPatch={(input) => void patch(stage.id, input)}
              onRemove={() => setDeleting(stage)}
            />
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete stage?"
        description={`Are you sure you want to delete ${deleting?.name ?? "this stage"}?`}
        confirmLabel="Delete"
        busy={removing}
      />
    </section>
  );
}
