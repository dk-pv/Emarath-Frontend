"use client";

import { useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StagesProvider, useStages } from "@/components/stages/stages-context";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { DEFAULT_PIPELINE } from "@/services/leads-board-service";
import type { Stage } from "@/services/stages-service";
import { KanbanColumn } from "./kanban-column";
import { KanbanDndProvider, type KanbanDnd } from "./kanban-dnd-context";
import { PipelineSwitcher } from "./pipeline-switcher";
import { StageLegend } from "./stage-legend";
import { useKanbanBoard } from "./use-kanban-board";

/** The selected pipeline survives the session (KAN-06.1 AC4). */
const PIPELINE_KEY = "kanban.pipeline";

/**
 * The Kanban board (KAN-02.2 UI, KAN-04.2 drag, KAN-05.2 stages, KAN-06.1 pipelines).
 * The board owns the selected pipeline and hands it to a board-scoped `StagesProvider`
 * — nested over the app-level default, so switching the board's pipeline regroups the
 * board (its stages, columns, legend and counts) without disturbing the list badge.
 * The column set is the catalogue for that pipeline; a stage change shows on next load.
 */
export function KanbanBoard() {
  const [pipeline, setPipeline] = usePersistentState<string>(
    PIPELINE_KEY,
    DEFAULT_PIPELINE,
  );

  return (
    <StagesProvider pipeline={pipeline}>
      <KanbanBoardShell pipeline={pipeline} onPipelineChange={setPipeline} />
    </StagesProvider>
  );
}

function KanbanBoardShell({
  pipeline,
  onPipelineChange,
}: {
  pipeline: string;
  onPipelineChange: (pipeline: string) => void;
}) {
  const { stages, status, reload } = useStages();

  return (
    <section className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <StageLegend pipeline={pipeline} />
        <PipelineSwitcher value={pipeline} onChange={onPipelineChange} />
      </div>

      {status === "error" ? (
        <BoardCentered>
          <p className="text-ink-muted">Couldn’t load the stages.</p>
          <RetryLink onClick={reload} />
        </BoardCentered>
      ) : status === "loading" ? (
        <ColumnRow>
          {Array.from({ length: 6 }, (_, index) => (
            <ColumnSkeleton key={index} />
          ))}
        </ColumnRow>
      ) : stages.length === 0 ? (
        <BoardCentered>
          <p className="text-ink-muted">This pipeline has no stages yet.</p>
        </BoardCentered>
      ) : (
        <KanbanBoardView stages={stages} pipeline={pipeline} />
      )}
    </section>
  );
}

/** The board proper, once the stage catalogue is known (KAN-04.2 drag + move). */
function KanbanBoardView({
  stages,
  pipeline,
}: {
  stages: Stage[];
  pipeline: string;
}) {
  // Stable by content: a recolour (same names, same order) leaves this identical, so
  // the board doesn't refetch — only the colours re-render. A rename/reorder/add/
  // delete changes the names or order, so the board rebuilds its columns.
  const stageSignature = stages.map((stage) => stage.name).join("\n");
  const stageNames = useMemo(
    () => (stageSignature ? stageSignature.split("\n") : []),
    [stageSignature],
  );
  const { phase, columns, retryBoard, retryColumn, loadMore, moveCard } =
    useKanbanBoard(pipeline, stageNames);

  // The card being dragged: kept in a ref for the drop lookup (drop fires before
  // dragend), mirrored to state only as `activeDragFrom` so columns can light up.
  const dragging = useRef<{ id: string; from: string } | null>(null);
  const [activeDragFrom, setActiveDragFrom] = useState<string | null>(null);

  const dnd = useMemo<KanbanDnd>(
    () => ({
      onDragStart: (leadId, fromStage) => {
        dragging.current = { id: leadId, from: fromStage };
        setActiveDragFrom(fromStage);
      },
      onDragEnd: () => {
        dragging.current = null;
        setActiveDragFrom(null);
      },
      onDropOnStage: (toStage) => {
        const current = dragging.current;
        if (current) moveCard(current.id, current.from, toStage);
      },
      getDraggingFrom: () => dragging.current?.from ?? null,
    }),
    [moveCard],
  );

  if (phase === "error") {
    return (
      <BoardCentered>
        <p className="text-ink-muted">Couldn’t load the board.</p>
        <RetryLink onClick={retryBoard} />
      </BoardCentered>
    );
  }

  return (
    <KanbanDndProvider value={dnd}>
      <ColumnRow>
        {phase === "loading"
          ? stageNames.map((stage) => <ColumnSkeleton key={stage} />)
          : stageNames.map((stage) => {
              const column = columns[stage];
              return column ? (
                <KanbanColumn
                  key={stage}
                  column={column}
                  activeDragFrom={activeDragFrom}
                  onLoadMore={loadMore}
                  onRetry={retryColumn}
                />
              ) : null;
            })}
      </ColumnRow>
    </KanbanDndProvider>
  );
}

/** The horizontally scrolling column row — fills the remaining board height. */
function ColumnRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2">
      {children}
    </div>
  );
}

function BoardCentered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">{children}</div>
    </div>
  );
}

function RetryLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring mt-1 rounded-control text-brand-strong underline"
    >
      Try again
    </button>
  );
}

/** A column-shaped placeholder while the board loads (KAN-02.2 AC5). */
function ColumnSkeleton() {
  return (
    <section className="flex h-full w-[267px] shrink-0 flex-col">
      <Skeleton className="h-10 w-full rounded-control" />
      <div className="mt-2 min-h-0 flex-1 space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[160px] w-full rounded-surface" />
        ))}
      </div>
    </section>
  );
}
