"use client";

import { memo, useState } from "react";
import { IconPinFilled, IconPlus } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { KanbanCard } from "./kanban-card";
import { useKanbanDnd } from "./kanban-dnd-context";
import { ColumnStageMenu } from "./stage-management/column-stage-menu";
import type { StageColumn } from "./use-kanban-board";

/** The stage-header "+" — Add Lead to this stage (KAN-03.1), the Workpex behaviour. */
const ADD_LEAD_CLASS =
  "focus-ring flex size-6 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-surface hover:text-ink";

const AED0 = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

/**
 * Column header total — Workpex abbreviates large sums (`kanban-board-default-…png`
 * reads "1.4K", "16K", "45K" but "509" below a thousand), always in AED.
 */
function abbreviate(value: number, divisor: number, suffix: string): string {
  const scaled = value / divisor;
  return `${scaled >= 10 ? Math.round(scaled) : Number(scaled.toFixed(1))}${suffix}`;
}

function formatTotal(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0 د.إ";
  if (n >= 1_000_000) return `${abbreviate(n, 1_000_000, "M")} د.إ`;
  if (n >= 1000) return `${abbreviate(n, 1000, "K")} د.إ`;
  return `${AED0.format(n)} د.إ`;
}

/** Trigger a page load once the scroll nears the bottom (KAN-02.2 AC3). */
const NEAR_BOTTOM_PX = 160;

type KanbanColumnProps = {
  column: StageColumn;
  /** The stage a card is currently being dragged from, or null when idle. */
  activeDragFrom: string | null;
  onLoadMore: (stage: string) => void;
  onRetry: (stage: string) => void;
  /** Open the Add New Lead drawer pre-set to this stage (KAN-03.1). */
  onAddLead: (stage: string) => void;
  /** Whether this stage is the caller's pinned (sticky) column (KAN-05.2). */
  isPinned: boolean;
  /** Toggle this stage's pin (pin if unpinned, unpin if pinned). */
  onTogglePin: () => void;
};

/**
 * One board column (KAN-02.2 UI, KAN-04.2 drop target). A colour-coded header
 * (stage dot + name + total value + count) over a vertically scrolling body of the
 * stage's cards. Presentational: the board owns the cards and the move, so a drop
 * here just reports the target stage to the DnD coordinator and the board performs
 * the optimistic move. Each column still owns its loading / empty / error view and
 * asks for its next page as the body scrolls.
 *
 * During a drag the column becomes a drop target for any stage but its own; the
 * highlight is gated on an active drag, so it clears the moment the drag ends even
 * if a stray `dragleave` was missed. The highlight is the column's own stage tint —
 * no invented drag chrome (the Workpex reference never captures a drag).
 */
export const KanbanColumn = memo(function KanbanColumn({
  column,
  activeDragFrom,
  onLoadMore,
  onRetry,
  onAddLead,
  isPinned,
  onTogglePin,
}: KanbanColumnProps) {
  const {
    stage,
    count,
    totalValue,
    rows,
    loading,
    loadingMore,
    error,
    loadedAll,
  } = column;
  const dnd = useKanbanDnd();
  const { stages, colorsFor } = useStages();
  const colors = colorsFor(stage);
  // The catalogue stage backing this column — drives the header's stage controls
  // (KAN-05.2). Always present: the board's columns come from the catalogue.
  const stageEntry = stages.find((s) => s.name === stage);
  const [isOver, setIsOver] = useState(false);

  // Highlight from render state (may lag a frame — that's fine for a visual cue).
  const showOver = activeDragFrom !== null && activeDragFrom !== stage && isOver;

  // Drop acceptance from the drag ref (synchronous): a card can never be dropped
  // onto the column it came from, and a drop is valid the instant a drag begins.
  const canDropHere = (): boolean => {
    const from = dnd.getDraggingFrom();
    return from !== null && from !== stage;
  };

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (loadedAll || loading || loadingMore || error) return;
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX) {
      onLoadMore(stage);
    }
  };

  return (
    <section
      className={cn(
        "flex h-full w-[267px] shrink-0 flex-col",
        // Pinned = a frozen column (KAN-05.2): sticky at the board's left edge, over an
        // opaque canvas fill (matches the page, so scrolling cards pass invisibly
        // behind it), lifted above them with z, and set off by a right hairline.
        isPinned &&
          "sticky left-0 z-20 border-r border-hairline bg-canvas shadow-sm",
      )}
      onDragOver={(event) => {
        if (!canDropHere()) return;
        // Mark this a valid drop target and show the move cursor.
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!isOver) setIsOver(true);
      }}
      onDragLeave={(event) => {
        // Ignore a leave into a child; only clear when the pointer exits the column.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        if (!canDropHere()) return;
        event.preventDefault();
        setIsOver(false);
        dnd.onDropOnStage(stage);
      }}
    >
      <header
        className={cn(
          "flex items-center gap-2 rounded-control border px-3 py-2",
          colors.tint,
        )}
      >
        <span
          className={cn("size-2.5 shrink-0 rounded-full", colors.swatch)}
          aria-hidden="true"
        />
        <span className="truncate text-sm font-semibold text-ink">{stage}</span>
        <span className="shrink-0 text-sm text-ink-muted">
          | {formatTotal(totalValue)}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
          {count}
        </span>
        {isPinned && (
          <span
            className="shrink-0 text-brand-strong"
            title="Pinned stage"
          >
            <IconPinFilled size={14} stroke={1.75} aria-hidden="true" />
            <span className="sr-only">Pinned</span>
          </span>
        )}
        {stageEntry && (
          <>
            {/* Workpex: the stage-header "+" adds a lead to THIS stage (not a stage);
                stage management moved into the ⋮ menu. */}
            <button
              type="button"
              aria-label="Add lead"
              onClick={() => onAddLead(stage)}
              className={ADD_LEAD_CLASS}
            >
              <IconPlus size={16} stroke={2} aria-hidden="true" />
            </button>
            <ColumnStageMenu
              stage={stageEntry}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
            />
          </>
        )}
      </header>

      <div
        onScroll={onScroll}
        // Cards must share the header's exact width (Workpex): the body extends into
        // the inter-column gap by the slim scrollbar's width (Chrome's thin scrollbar
        // is 10px — `scrollbar-width: thin` disables the 6px ::-webkit-scrollbar rule
        // since Chrome 121) and a stable gutter reserves exactly that, so the
        // scrollbar rides in the gap instead of narrowing the cards — with or without
        // overflow, the card area stays the full 267px.
        className={cn(
          "scrollbar-slim -mr-[10px] mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-control transition-colors [scrollbar-gutter:stable]",
          showOver && cn("border-2 border-dashed", colors.tint),
        )}
      >
        {loading ? (
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[160px] w-full rounded-surface" />
          ))
        ) : error ? (
          <div className="px-2 py-8 text-center text-sm">
            <p className="text-ink-muted">Couldn’t load leads.</p>
            <button
              type="button"
              onClick={() => onRetry(stage)}
              className="focus-ring mt-1 rounded-control text-brand-strong underline"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-ink-muted">
            No leads in this stage.
          </p>
        ) : (
          <>
            {rows.map((lead) => (
              <KanbanCard key={lead.id} lead={lead} />
            ))}
            {loadingMore && (
              <Skeleton className="h-[160px] w-full rounded-surface" />
            )}
          </>
        )}
      </div>
    </section>
  );
});
