"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toolbar } from "@/components/layout/Toolbar";
import { StagesProvider, useStages } from "@/components/stages/stages-context";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { presetConditions } from "@/components/leads/lead-quick-filters";
import { useAdvancedFilter } from "@/hooks/use-advanced-filter";
import { SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFilters } from "@/hooks/use-filters";
import { useListQuery } from "@/hooks/use-list-query";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { DEFAULT_PIPELINE } from "@/services/leads-board-service";
import type { Stage } from "@/services/stages-service";
import {
  fetchKanbanPins,
  saveKanbanPin,
} from "@/services/view-preferences-service";
import type { FilterCondition, FilterField, FilterState } from "@/types";
import { KanbanCardActionsProvider } from "./kanban-card-actions";
import { KanbanColumn } from "./kanban-column";
import { KanbanDndProvider, type KanbanDnd } from "./kanban-dnd-context";
import { KanbanToolbar } from "./kanban-toolbar";
import { StageLegend } from "./stage-legend";
import { type BoardQuery, useKanbanBoard } from "./use-kanban-board";
import {
  CANCELLED,
  LOST_STATUS,
  useLostReasonPrompt,
} from "@/components/leads/lost-reason-prompt";
import type { LeadListItem } from "@/services/leads-service";

/** The selected pipeline survives the session (KAN-06.1 AC4). */
const PIPELINE_KEY = "kanban.pipeline";

/** The board filters through the advanced builder, so the shared panel gets no fields. */
const NO_FILTER_FIELDS: readonly FilterField[] = [];

/**
 * The Kanban board (KAN-02.2 UI, KAN-04.2 drag, KAN-05.2 stages, KAN-06.1 pipelines,
 * KAN-07.1 shared tools). The board owns the selected pipeline and hands it to a
 * board-scoped `StagesProvider` — nested over the app-level default, so switching the
 * board's pipeline regroups the board (its stages, columns, legend and counts) without
 * disturbing the list badge. The column set is the catalogue for that pipeline; a
 * stage change shows on next load.
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

  // Search state only: the board's field filtering is the advanced builder below, the
  // very one the Leads list uses (KAN-07.1 AC1/AC5), so no per-field catalogue is needed.
  const filters = useFilters(NO_FILTER_FIELDS);

  // The advanced filter (ADR-0039/0040/0052) — draft rows, the applied `conditions`
  // payload, and the caller's saved presets, shared with the list through one hook.
  const advancedFilter = useAdvancedFilter();

  // Quick Filter preset (LEAD-04.1) — one at a time, its conditions riding the same
  // query as the field filters. Kept in its own state so it can be indicated/cleared.
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetFilters, setPresetFilters] = useState<FilterCondition[]>([]);

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(
    filters.state.search,
    SEARCH_DEBOUNCE_MS,
  );
  const queryState = useMemo<FilterState>(
    () => ({
      search: debouncedSearch,
      conditions: [...filters.state.conditions, ...presetFilters],
    }),
    [debouncedSearch, filters.state.conditions, presetFilters],
  );

  // Reuses the list's query builder purely for its search/filter folding + sort
  // state; the board paginates per column, so the page/size it also tracks go unused.
  const list = useListQuery({ filters: queryState });

  const applyQuickFilter = (id: string | null) => {
    setActivePreset(id);
    setPresetFilters(id ? presetConditions(id) : []);
  };

  // The one applied view the legend and the columns both load from — search +
  // filters + sort. Memoised so its identity only changes when the view does.
  const boardQuery = useMemo<BoardQuery>(
    () => ({
      search: list.query.search,
      conditions: list.query.filters ?? [],
      // One payload for the rollup (legend/counts) and every column's cards, so the
      // two can never show different filtered sets.
      advancedConditions: advancedFilter.appliedConditions,
      sort: list.query.sort,
    }),
    [list.query, advancedFilter.appliedConditions],
  );

  // The create drawer's target: `{}` = the global New Lead button; `{ stage }` = the
  // stage-header "+" (KAN-03.1), which pre-sets the drawer to that stage so the new
  // lead lands there. Null = closed. A create reloads the board so the lead appears if
  // it lands in the current pipeline and passes the active filter (KAN-07.1 AC3).
  const [createTarget, setCreateTarget] = useState<{ stage?: string } | null>(
    null,
  );
  const [reloadKey, setReloadKey] = useState(0);

  // Per-user stage pins (KAN-05.2): one pinned (sticky/frozen) stage per pipeline,
  // fetched once and kept as a map so switching pipelines reads its own pin without a
  // refetch. Persisted through the view-preferences store — never affects another user.
  const [pins, setPins] = useState<Record<string, string>>({});
  useEffect(() => {
    const controller = new AbortController();
    fetchKanbanPins(controller.signal)
      .then(({ pins: saved }) => setPins(saved))
      .catch((error: unknown) => {
        // Aborted on unmount; expected. Any other failure just leaves no pins — the
        // board still works, columns simply aren't sticky.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, []);

  const pinnedStage = pins[pipeline] ?? null;

  // Pin this stage for the current pipeline (replacing any previous — one pin per
  // pipeline), or unpin it. Optimistic: the server's map is adopted on success and
  // reverted on failure.
  const togglePin = (stage: string) => {
    const next = stage === pinnedStage ? null : stage;
    const previous = pins;
    setPins((current) => {
      const updated = { ...current };
      if (next) updated[pipeline] = next;
      else delete updated[pipeline];
      return updated;
    });
    saveKanbanPin(pipeline, next)
      .then(({ pins: saved }) => setPins(saved))
      .catch(() => setPins(previous));
  };

  return (
    <section className="flex h-full flex-col p-4">
      <Toolbar
        className="mb-3"
        left={
          <StageLegend
            pipeline={pipeline}
            query={boardQuery}
            reloadKey={reloadKey}
          />
        }
        right={
          <KanbanToolbar
            pipeline={pipeline}
            onPipelineChange={onPipelineChange}
            search={filters.state.search}
            onSearchChange={filters.setSearch}
            advancedFilter={advancedFilter}
            sort={list.sort}
            onSortChange={list.setSort}
            activePreset={activePreset}
            onQuickFilter={applyQuickFilter}
            onNewLead={() => setCreateTarget({})}
          />
        }
      />

      {/* The card ⋮ menu's handlers + composers live here so a convert/edit/delete
          reloads the board through the existing `reloadKey` (the New Lead path). */}
      <KanbanCardActionsProvider
        onBoardChanged={() => setReloadKey((value) => value + 1)}
      >
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
          <KanbanBoardView
            stages={stages}
            pipeline={pipeline}
            query={boardQuery}
            reloadKey={reloadKey}
            onAddLead={(stage) => setCreateTarget({ stage })}
            pinnedStage={pinnedStage}
            onTogglePin={togglePin}
          />
        )}
      </KanbanCardActionsProvider>

      {/* Mounted only while open, so every create starts from a clean form. A stage
          "+" pre-sets the drawer to that stage (defaultStatus); the global New Lead
          opens with no stage. Either way a save reloads the board. */}
      {createTarget && (
        <LeadFormDrawer
          open
          defaultStatus={createTarget.stage}
          defaultPipeline={createTarget.stage ? pipeline : undefined}
          onClose={() => setCreateTarget(null)}
          onSaved={() => {
            setCreateTarget(null);
            setReloadKey((value) => value + 1);
          }}
        />
      )}
    </section>
  );
}

/** The board proper, once the stage catalogue is known (KAN-04.2 drag + move). */
function KanbanBoardView({
  stages,
  pipeline,
  query,
  reloadKey,
  onAddLead,
  pinnedStage,
  onTogglePin,
}: {
  stages: Stage[];
  pipeline: string;
  query: BoardQuery;
  reloadKey: number;
  onAddLead: (stage: string) => void;
  pinnedStage: string | null;
  onTogglePin: (stage: string) => void;
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
    useKanbanBoard(pipeline, stageNames, query, reloadKey);

  // The card being dragged: kept in a ref for the drop lookup (drop fires before
  // dragend), mirrored to state only as `activeDragFrom` so columns can light up.
  const dragging = useRef<{ id: string; from: string } | null>(null);
  const [activeDragFrom, setActiveDragFrom] = useState<string | null>(null);

  // Live mirror of each column's rows, so the stable drop handler can name the dragged
  // lead in the prompt without being recreated on every board change.
  const stateRef = useRef<Record<string, LeadListItem[]>>({});
  useEffect(() => {
    stateRef.current = Object.fromEntries(
      Object.entries(columns).map(([stage, column]) => [stage, column.rows]),
    );
  }, [columns]);

  const { ask, modal: lostReasonModal } = useLostReasonPrompt();
  const askLostReason = useCallback(
    async (lead: LeadListItem, from: string, to: string) => {
      const reason = await ask(lead);
      if (reason === CANCELLED) return;
      moveCard(lead.id, from, to, reason);
    },
    [ask, moveCard],
  );

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
        if (!current) return;
        // A drop into LOST asks why first; skipping still moves the card, cancelling
        // leaves it where it was.
        if (toStage === LOST_STATUS) {
          const lead = stateRef.current?.[current.from]?.find(
            (row) => row.id === current.id,
          );
          if (lead) {
            void askLostReason(lead, current.from, toStage);
            return;
          }
        }
        moveCard(current.id, current.from, toStage);
      },
      getDraggingFrom: () => dragging.current?.from ?? null,
    }),
    [moveCard, askLostReason],
  );

  if (phase === "error") {
    return (
      <BoardCentered>
        <p className="text-ink-muted">Couldn’t load the board.</p>
        <RetryLink onClick={retryBoard} />
      </BoardCentered>
    );
  }

  // A pinned stage renders first so it stays frozen at the board's left edge (sticky,
  // in KanbanColumn) while the rest scroll past it — one pin per pipeline.
  const renderOrder =
    pinnedStage && stageNames.includes(pinnedStage)
      ? [pinnedStage, ...stageNames.filter((stage) => stage !== pinnedStage)]
      : stageNames;

  return (
    <KanbanDndProvider value={dnd}>
      <ColumnRow>
        {phase === "loading"
          ? stageNames.map((stage) => <ColumnSkeleton key={stage} />)
          : renderOrder.map((stage) => {
              const column = columns[stage];
              return column ? (
                <KanbanColumn
                  key={stage}
                  column={column}
                  activeDragFrom={activeDragFrom}
                  onLoadMore={loadMore}
                  onRetry={retryColumn}
                  onAddLead={onAddLead}
                  isPinned={stage === pinnedStage}
                  onTogglePin={() => onTogglePin(stage)}
                />
              ) : null;
            })}
      </ColumnRow>
      {lostReasonModal}
    </KanbanDndProvider>
  );
}

/**
 * The horizontally scrolling column row — fills the remaining board height.
 *
 * `gap-[14px]` is Workpex's measured inter-column gap: in
 * `kanban-board-default-legend-tooltip-converted.png` the New column runs x257–526
 * and Initial Contact x540–809, so columns are 270px wide and 13–14px apart.
 *
 * `scrollbar-none` hides the track while wheel, shift+wheel, trackpad, drag and
 * keyboard scrolling stay live. Note this frees vertical, not horizontal, space —
 * it does not change how many columns fit.
 */
function ColumnRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-none flex min-h-0 flex-1 gap-[14px] overflow-x-auto pb-2">
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
      <div className="mt-2 min-h-0 flex-1 space-y-3.5">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[160px] w-full rounded-surface" />
        ))}
      </div>
    </section>
  );
}
