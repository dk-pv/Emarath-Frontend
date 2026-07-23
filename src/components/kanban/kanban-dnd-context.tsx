"use client";

import { createContext, useContext } from "react";

/**
 * The board's drag coordinator (KAN-04.2). A card reports when its drag begins and
 * ends; a column reports a drop onto itself. Kept as a context — not prop-drilled —
 * so `KanbanCard` and `KanbanColumn` stay unaware of each other and the board owns
 * the move. The callbacks are stable (the board memoises them), so consuming a card
 * through this context never re-renders it on unrelated board state (AC5).
 *
 * Deliberately minimal: the dragged card's identity travels in these calls, not in
 * `dataTransfer`, so no lead has to be serialised to a string and re-parsed. The
 * board reads the lead from the column it owns. Future stage management (KAN-05.x)
 * reuses the same coordinator.
 */
export type KanbanDnd = {
  /** A card started dragging out of `fromStage`. */
  onDragStart: (leadId: string, fromStage: string) => void;
  /** The drag ended (dropped anywhere, or cancelled). */
  onDragEnd: () => void;
  /** A card was dropped onto `toStage`'s column. */
  onDropOnStage: (toStage: string) => void;
  /**
   * The stage a drag is currently in, read synchronously from a ref. A column gates
   * its drop on this, not on render state, so a drop is accepted the instant a drag
   * begins — correctness never waits for a re-render (the highlight can).
   */
  getDraggingFrom: () => string | null;
};

const KanbanDndContext = createContext<KanbanDnd | null>(null);

export const KanbanDndProvider = KanbanDndContext.Provider;

export function useKanbanDnd(): KanbanDnd {
  const value = useContext(KanbanDndContext);
  if (!value) {
    throw new Error("useKanbanDnd must be used within a KanbanDndProvider.");
  }
  return value;
}
