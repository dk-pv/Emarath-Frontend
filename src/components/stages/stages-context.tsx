"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { STAGES_CHANGED } from "@/lib/catalog-events";
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

const NO_STAGES: Stage[] = [];

export function StagesProvider({
  pipeline = DEFAULT_PIPELINE,
  children,
}: {
  pipeline?: string;
  children: ReactNode;
}) {
  // Each result is tagged with the pipeline it belongs to, so after a pipeline switch the
  // previous pipeline's stages read as "loading", never as this pipeline's columns.
  const [loaded, setLoaded] = useState<{
    pipeline: string;
    stages: Stage[];
  } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const attempt = `${pipeline}#${nonce}`;

  // The pipeline currently shown, for refreshes that resolve after a switch.
  const currentPipeline = useRef(pipeline);
  useEffect(() => {
    currentPipeline.current = pipeline;
  }, [pipeline]);

  useEffect(() => {
    const controller = new AbortController();
    fetchStages(pipeline, controller.signal)
      .then((list) => setLoaded({ pipeline, stages: list }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailedFor(`${pipeline}#${nonce}`);
      });
    return () => controller.abort();
  }, [pipeline, nonce]);

  // Reset in the handler (not the effect), so a retry re-shows loading and refetches.
  const reload = useCallback(() => {
    setLoaded(null);
    setNonce((value) => value + 1);
  }, []);

  // Swap the catalogue in place after a stage-management change, without tearing the
  // board down — the board and badges re-render with the new stages immediately. A
  // result for a pipeline that is no longer shown is dropped.
  const refresh = useCallback(() => {
    fetchStages(pipeline)
      .then((list) => {
        if (currentPipeline.current === pipeline) {
          setLoaded({ pipeline, stages: list });
        }
      })
      .catch(() => {
        // The mutation already succeeded; keep the current catalogue on a refetch miss.
      });
  }, [pipeline]);

  // A stage or pipeline edit made anywhere (the board, another board, Settings) reaches
  // this catalogue too — the app-level one behind the Leads badges included.
  useEffect(() => {
    window.addEventListener(STAGES_CHANGED, refresh);
    return () => window.removeEventListener(STAGES_CHANGED, refresh);
  }, [refresh]);

  const stages = useMemo(
    () => (loaded?.pipeline === pipeline ? loaded.stages : NO_STAGES),
    [loaded, pipeline],
  );
  const status: StagesContextValue["status"] =
    loaded?.pipeline === pipeline
      ? "ready"
      : failedFor === attempt
        ? "error"
        : "loading";

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
