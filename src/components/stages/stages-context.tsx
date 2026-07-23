"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { stageColorClasses, type StageColorClasses } from "@/lib/stage-palette";
import { DEFAULT_PIPELINE } from "@/services/leads-board-service";
import { fetchStages, type Stage } from "@/services/stages-service";

/**
 * The stage catalogue, shared across the app (KAN-05.2). Fetched once from the
 * canonical Stage API and handed to every view that used to read the hard-coded
 * `status-colors` config — the board columns, the list status badge and the status
 * dropdown — so there is one source and they can never drift. `colorsFor` resolves a
 * lead's status to its colour classes through the catalogue; an unknown status (a
 * legacy value with no stage) falls back to neutral, never a guessed hue.
 */
type StagesContextValue = {
  /** Stages in display order — the board's column set and the dropdown's options. */
  stages: Stage[];
  status: "loading" | "ready" | "error";
  /** Refetch with a loading state — the error-retry path. */
  reload: () => void;
  /** Refetch and swap in place (no loading flash) — after a stage-management change. */
  refresh: () => void;
  colorsFor: (statusName: string) => StageColorClasses;
};

const StagesContext = createContext<StagesContextValue | null>(null);

export function StagesProvider({
  pipeline = DEFAULT_PIPELINE,
  children,
}: {
  pipeline?: string;
  children: ReactNode;
}) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchStages(pipeline, controller.signal)
      .then((list) => {
        setStages(list);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, [pipeline, nonce]);

  // Reset in the handler (not the effect), so a retry re-shows loading and refetches.
  const reload = useCallback(() => {
    setStatus("loading");
    setStages([]);
    setNonce((value) => value + 1);
  }, []);

  // Swap the catalogue in place after a stage-management change, without tearing the
  // board down — the board and badges re-render with the new stages immediately.
  const refresh = useCallback(() => {
    fetchStages(pipeline)
      .then((list) => {
        setStages(list);
        setStatus("ready");
      })
      .catch(() => {
        // The mutation already succeeded; keep the current catalogue on a refetch miss.
      });
  }, [pipeline]);

  const colorByName = useMemo(
    () => new Map(stages.map((stage) => [stage.name, stage.color])),
    [stages],
  );

  const value = useMemo<StagesContextValue>(
    () => ({
      stages,
      status,
      reload,
      refresh,
      colorsFor: (statusName) => stageColorClasses(colorByName.get(statusName)),
    }),
    [stages, status, reload, refresh, colorByName],
  );

  return <StagesContext value={value}>{children}</StagesContext>;
}

export function useStages(): StagesContextValue {
  const value = useContext(StagesContext);
  if (!value) {
    throw new Error("useStages must be used within a StagesProvider.");
  }
  return value;
}
