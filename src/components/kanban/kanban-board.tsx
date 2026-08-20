"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toolbar } from "@/components/layout/Toolbar";
import { StagesProvider, useStages } from "@/components/stages/stages-context";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { presetConditions } from "@/components/leads/lead-quick-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useFilters } from "@/hooks/use-filters";
import { useListQuery } from "@/hooks/use-list-query";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { DEFAULT_PIPELINE } from "@/services/leads-board-service";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import type { Stage } from "@/services/stages-service";
import type { FilterCondition, FilterField, FilterState } from "@/types";
import { KanbanColumn } from "./kanban-column";
import { KanbanDndProvider, type KanbanDnd } from "./kanban-dnd-context";
import { KanbanToolbar } from "./kanban-toolbar";
import { StageLegend } from "./stage-legend";
import { type BoardQuery, useKanbanBoard } from "./use-kanban-board";

/** The selected pipeline survives the session (KAN-06.1 AC4). */
const PIPELINE_KEY = "kanban.pipeline";

/** A pause after the last keystroke before the server search runs (LEAD-03.3). */
const SEARCH_DEBOUNCE_MS = 300;

const NO_OPTIONS: LeadFilterOptions = {
  sources: [],
  statuses: [],
  agents: [],
  tags: [],
};

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

  // Filter facets — the same scoped Source / Lead Status / Assigned Agent / Tags the
  // Leads list offers (LEAD-03.3), so the board and the list filter by identical
  // fields (KAN-07.1 AC5). The board reuses the whole filter/search/sort machinery.
  const [options, setOptions] = useState<LeadFilterOptions>(NO_OPTIONS);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch((error: unknown) => {
        // A superseded request aborts; expected. Any other failure leaves the filter
        // menu empty — the board itself still works.
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        key: "source",
        label: "Source",
        type: "multi",
        options: options.sources.map((value) => ({ label: value, value })),
      },
      {
        key: "status",
        label: "Lead Status",
        type: "multi",
        options: options.statuses.map((value) => ({ label: value, value })),
      },
      {
        key: "assignedAgent",
        label: "Assigned Agent",
        type: "multi",
        options: options.agents.map((agent) => ({
          label: agent.name,
          value: agent.id,
        })),
      },
      {
        key: "tag",
        label: "Tags",
        type: "multi",
        options: options.tags.map((tag) => ({ label: tag.name, value: tag.id })),
      },
    ],
    [options],
  );

  const filters = useFilters(filterFields);

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
      sort: list.query.sort,
    }),
    [list.query],
  );

  // A New Lead created from the board reloads it, so the lead appears if it lands in
  // the current pipeline and passes the active filter (KAN-07.1 AC3).
  const newLead = useDisclosure();
  const [reloadKey, setReloadKey] = useState(0);

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
            filterFields={filterFields}
            filterActiveCount={filters.activeCount}
            filterValueOf={filters.valueOf}
            onFilterChange={filters.setCondition}
            onFilterClear={filters.clearAll}
            sort={list.sort}
            onSortChange={list.setSort}
            activePreset={activePreset}
            onQuickFilter={applyQuickFilter}
            onNewLead={newLead.open}
          />
        }
      />

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
        />
      )}

      {/* Mounted only while open, so every New Lead starts from a clean form. */}
      {newLead.isOpen && (
        <LeadFormDrawer
          open
          onClose={newLead.close}
          onSaved={() => {
            newLead.close();
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
}: {
  stages: Stage[];
  pipeline: string;
  query: BoardQuery;
  reloadKey: number;
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
