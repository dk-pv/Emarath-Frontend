"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import { fetchLeads, type LeadListItem } from "@/services/leads-service";
import {
  fetchBoard,
  patchLeadStage,
  type BoardStageSummary,
} from "@/services/leads-board-service";
import type { ListQuery } from "@/types";

/** Cards per column page — first page on mount, more on scroll (KAN-02.2 AC3). */
const PAGE_SIZE = 20;

/** One column's live state: its rollup (count/value) and its loaded cards. */
export type StageColumn = {
  stage: string;
  count: number;
  totalValue: string;
  rows: LeadListItem[];
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
  loadedAll: boolean;
  /** 1-based next page to fetch. */
  nextPage: number;
};

type BoardState = {
  phase: "loading" | "error" | "ready";
  columns: Record<string, StageColumn>;
};

type Action =
  | { type: "board-reset" }
  | { type: "board-error" }
  | { type: "board-loaded"; stages: BoardStageSummary[]; order: string[] }
  | { type: "page-loading-more"; stage: string }
  | { type: "page-loaded"; stage: string; rows: LeadListItem[] }
  | { type: "page-error"; stage: string }
  | { type: "column-retry"; stage: string }
  | { type: "move"; lead: LeadListItem; from: string; to: string }
  | { type: "move-confirm"; stages: BoardStageSummary[] }
  | { type: "move-rollback"; lead: LeadListItem; from: string; to: string; index: number };

const INITIAL: BoardState = { phase: "loading", columns: {} };

const amountOf = (lead: LeadListItem): number =>
  Number(lead.actualAmount ?? "0") || 0;

/** Adjust a decimal-string total by a delta; the server's exact value replaces it on confirm. */
const shiftTotal = (total: string, delta: number): string =>
  String(Number(total) + delta);

const isAbort = (error: unknown): boolean =>
  error instanceof DOMException && error.name === "AbortError";

/** The `fetchLeads` query for one column's page — scoped by stage + pipeline (reuses the list API). */
function pageQuery(stage: string, pipeline: string, page: number): ListQuery {
  return {
    page,
    size: PAGE_SIZE,
    sort: { key: "createdAt", direction: "desc" },
    filters: [
      { key: "status", value: [stage] },
      { key: "pipeline", value: pipeline },
    ],
  };
}

function reducer(state: BoardState, action: Action): BoardState {
  switch (action.type) {
    case "board-reset":
      return INITIAL;

    case "board-error":
      return { ...state, phase: "error" };

    case "board-loaded": {
      const byStage = new Map(action.stages.map((s) => [s.stage, s]));
      const columns: Record<string, StageColumn> = {};
      // Every catalogue stage renders — even an empty one — so the board shows the
      // full pipeline, exactly as Workpex does. The summary supplies count + value.
      for (const stage of action.order) {
        const summary = byStage.get(stage);
        const count = summary?.count ?? 0;
        columns[stage] = {
          stage,
          count,
          totalValue: summary?.totalValue ?? "0",
          rows: [],
          loading: count > 0,
          loadingMore: false,
          error: false,
          loadedAll: count === 0,
          nextPage: 1,
        };
      }
      return { phase: "ready", columns };
    }

    case "page-loading-more": {
      const col = state.columns[action.stage];
      if (!col) return state;
      return {
        ...state,
        columns: { ...state.columns, [action.stage]: { ...col, loadingMore: true } },
      };
    }

    case "page-loaded": {
      const col = state.columns[action.stage];
      if (!col) return state;
      // Dedupe by id: a card optimistically dropped into a column whose first page
      // was still in flight must not appear twice when that page lands.
      const seen = new Set(col.rows.map((r) => r.id));
      const fresh = action.rows.filter((r) => !seen.has(r.id));
      const rows = [...col.rows, ...fresh];
      return {
        ...state,
        columns: {
          ...state.columns,
          [action.stage]: {
            ...col,
            rows,
            loading: false,
            loadingMore: false,
            error: false,
            nextPage: col.nextPage + 1,
            loadedAll: action.rows.length < PAGE_SIZE || rows.length >= col.count,
          },
        },
      };
    }

    case "page-error": {
      const col = state.columns[action.stage];
      if (!col) return state;
      return {
        ...state,
        columns: {
          ...state.columns,
          [action.stage]: { ...col, loading: false, loadingMore: false, error: true },
        },
      };
    }

    case "column-retry": {
      const col = state.columns[action.stage];
      if (!col) return state;
      return {
        ...state,
        columns: {
          ...state.columns,
          [action.stage]: {
            ...col,
            rows: [],
            loading: true,
            loadingMore: false,
            error: false,
            nextPage: 1,
            loadedAll: false,
          },
        },
      };
    }

    case "move": {
      const src = state.columns[action.from];
      const dst = state.columns[action.to];
      if (!src || !dst) return state;
      const amount = amountOf(action.lead);
      const moved = { ...action.lead, status: action.to };
      return {
        ...state,
        columns: {
          ...state.columns,
          [action.from]: {
            ...src,
            rows: src.rows.filter((r) => r.id !== action.lead.id),
            count: Math.max(0, src.count - 1),
            totalValue: shiftTotal(src.totalValue, -amount),
          },
          [action.to]: {
            ...dst,
            rows: [moved, ...dst.rows.filter((r) => r.id !== action.lead.id)],
            count: dst.count + 1,
            totalValue: shiftTotal(dst.totalValue, amount),
          },
        },
      };
    }

    case "move-confirm": {
      // The server's authoritative recount replaces the optimistic count/value on
      // the two affected columns; the cards are already where they belong.
      const columns = { ...state.columns };
      for (const summary of action.stages) {
        const col = columns[summary.stage];
        if (col) {
          columns[summary.stage] = {
            ...col,
            count: summary.count,
            totalValue: summary.totalValue,
          };
        }
      }
      return { ...state, columns };
    }

    case "move-rollback": {
      const src = state.columns[action.from];
      const dst = state.columns[action.to];
      if (!src || !dst) return state;
      const amount = amountOf(action.lead);
      const restored = [...src.rows];
      // Back into its original column at its original position (AC4).
      restored.splice(Math.min(action.index, restored.length), 0, {
        ...action.lead,
        status: action.from,
      });
      return {
        ...state,
        columns: {
          ...state.columns,
          [action.from]: {
            ...src,
            rows: restored,
            count: src.count + 1,
            totalValue: shiftTotal(src.totalValue, amount),
          },
          [action.to]: {
            ...dst,
            rows: dst.rows.filter((r) => r.id !== action.lead.id),
            count: Math.max(0, dst.count - 1),
            totalValue: shiftTotal(dst.totalValue, -amount),
          },
        },
      };
    }
  }
}

/**
 * The Kanban board's data + move engine (KAN-04.2). Owns the board summary and each
 * column's cards in one reducer, so a cross-column drag is a single optimistic
 * transition (remove here, add there, adjust both counts) with a clean rollback if
 * the save fails — the same optimistic-then-reconcile shape the Leads list uses for
 * inline status changes (LEAD-11.1), lifted to two columns.
 *
 * Cards load through the shared `fetchLeads`, scoped by status + pipeline, so a
 * column can never show a lead the list would hide. The move calls the KAN-04.1
 * API, which returns the recounted source/target columns (AC3). `moveCard`,
 * `loadMore` and the retries are stable (they read live state through a ref), so
 * the board can hand them to memoised columns/cards without causing re-renders.
 */
export function useKanbanBoard(pipeline: string, stageNames: string[]) {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const [nonce, setNonce] = useState(0);
  const { toast } = useToast();

  // Live mirror of state for the stable event-handler callbacks below; synced in an
  // effect (never written during render) so a handler always reads the latest cards.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Leads with a move in flight — guards against a second API call for the same
  // card while its first move is still saving (no duplicate requests).
  const inFlight = useRef<Set<string>>(new Set());

  const fetchFirstPage = useCallback(
    (stage: string, signal?: AbortSignal) => {
      fetchLeads(pageQuery(stage, pipeline, 1), signal)
        .then((result) =>
          dispatch({ type: "page-loaded", stage, rows: [...result.rows] }),
        )
        .catch((error: unknown) => {
          if (isAbort(error)) return;
          dispatch({ type: "page-error", stage });
        });
    },
    [pipeline],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBoard(pipeline, controller.signal)
      .then((summary) => {
        dispatch({ type: "board-loaded", stages: summary.stages, order: stageNames });
        for (const s of summary.stages) {
          if (s.count > 0) fetchFirstPage(s.stage, controller.signal);
        }
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        dispatch({ type: "board-error" });
      });
    return () => controller.abort();
  }, [pipeline, nonce, fetchFirstPage, stageNames]);

  const retryBoard = useCallback(() => {
    dispatch({ type: "board-reset" });
    setNonce((value) => value + 1);
  }, []);

  const retryColumn = useCallback(
    (stage: string) => {
      dispatch({ type: "column-retry", stage });
      fetchFirstPage(stage);
    },
    [fetchFirstPage],
  );

  const loadMore = useCallback(
    (stage: string) => {
      const col = stateRef.current.columns[stage];
      if (!col || col.loading || col.loadingMore || col.error || col.loadedAll) {
        return;
      }
      dispatch({ type: "page-loading-more", stage });
      fetchLeads(pageQuery(stage, pipeline, col.nextPage))
        .then((result) =>
          dispatch({ type: "page-loaded", stage, rows: [...result.rows] }),
        )
        .catch(() => dispatch({ type: "page-error", stage }));
    },
    [pipeline],
  );

  const moveCard = useCallback(
    (leadId: string, from: string, to: string) => {
      if (from === to) return;
      const col = stateRef.current.columns[from];
      if (!col) return;
      const index = col.rows.findIndex((r) => r.id === leadId);
      if (index < 0 || inFlight.current.has(leadId)) return;
      const lead = col.rows[index];

      inFlight.current.add(leadId);
      dispatch({ type: "move", lead, from, to });

      patchLeadStage(leadId, to)
        .then((response) =>
          dispatch({ type: "move-confirm", stages: response.stages }),
        )
        .catch((error: unknown) => {
          dispatch({ type: "move-rollback", lead, from, to, index });
          const description =
            error instanceof ApiError && error.status === 404
              ? "You can’t move this lead."
              : error instanceof ApiError && error.messages[0]
                ? error.messages[0]
                : "The card was moved back to its column.";
          toast({ title: "Couldn’t move lead", description, tone: "danger" });
        })
        .finally(() => inFlight.current.delete(leadId));
    },
    [toast],
  );

  return {
    phase: state.phase,
    columns: state.columns,
    retryBoard,
    retryColumn,
    loadMore,
    moveCard,
  };
}
