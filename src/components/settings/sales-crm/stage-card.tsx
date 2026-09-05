"use client";

import { useState } from "react";
import { IconCheck, IconGripVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import { Input } from "@/components/ui/Input";
import { Popover } from "@/components/ui/Popover";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { STAGE_COLOR_KEYS, stageColorClasses } from "@/lib/stage-palette";
import {
  MAX_STAGE_PROBABILITY,
  MIN_STAGE_PROBABILITY,
  STAGE_INCLUSIONS,
  STAGE_OUTCOMES,
  type Stage,
  type StageWizardFields,
} from "@/services/stages-service";

export type StagePatch = StageWizardFields & { name?: string; color?: string };

export interface StageCardProps {
  stage: Stage;
  dragging: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  /** Writes through to the stage API; the parent re-reads the canonical rows after. */
  onPatch: (input: StagePatch) => void;
  onRemove: () => void;
}

/**
 * One stage card from the reference's Open / Closed panels.
 *
 * The card holds no stage state of its own beyond what is mid-edit: the name and
 * probability are local only while the field has focus, and every committed change goes
 * through `onPatch` so the server's row stays canonical. An open stage carries the
 * inclusion select and Probability; a closed one carries the outcome select instead, as
 * the reference draws them.
 */
export function StageCard({
  stage,
  dragging,
  onDragStart,
  onDrop,
  onPatch,
  onRemove,
}: StageCardProps) {
  const [name, setName] = useState(stage.name);
  const [probability, setProbability] = useState(String(stage.probability));
  const swatch = stageColorClasses(stage.color);

  /** Blank or unchanged names are discarded, so the field can never clear a stage. */
  const commitName = () => {
    const next = name.trim();
    if (next === "" || next === stage.name) setName(stage.name);
    else onPatch({ name: next });
  };

  const commitProbability = () => {
    const next = Number(probability);
    const valid =
      probability.trim() !== "" &&
      Number.isInteger(next) &&
      next >= MIN_STAGE_PROBABILITY &&
      next <= MAX_STAGE_PROBABILITY;
    if (!valid) setProbability(String(stage.probability));
    else if (next !== stage.probability) onPatch({ probability: next });
  };

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", stage.id);
        onDragStart();
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        "flex gap-2.5 rounded-control border border-hairline bg-surface p-2.5 shadow-xs",
        dragging && "opacity-50",
      )}
    >
      {/* The reference runs the stage's own colour down the card's left edge. */}
      <span
        aria-hidden="true"
        className={cn("w-1 shrink-0 rounded-full", swatch.swatch)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <IconGripVertical
            size={16}
            stroke={2}
            aria-hidden="true"
            className="shrink-0 cursor-grab text-ink-muted"
          />
          <Input
            aria-label={`Stage name for ${stage.name}`}
            placeholder="Stage Name"
            className="min-w-0 flex-1 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                setName(stage.name);
              }
            }}
          />

          {/*
            Portalled so the panel escapes the panel's own scroller instead of being
            cropped by it — the same reason the selects below are portalled.
          */}
          <Popover
            portal
            align="end"
            triggerClassName="rounded-control"
            trigger={
              <span
                aria-label={`Change colour for ${stage.name}`}
                className={cn(
                  "flex size-control-md items-center justify-center rounded-control border",
                  swatch.tint,
                )}
              >
                <IconPencil size={16} stroke={1.75} aria-hidden="true" />
              </span>
            }
            className="w-52 p-2"
          >
            {(close) => (
              <div className="grid grid-cols-5 gap-1.5">
                {STAGE_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={key === stage.color}
                    onClick={() => {
                      close();
                      if (key !== stage.color) onPatch({ color: key });
                    }}
                    className={cn(
                      "focus-ring flex size-7 items-center justify-center rounded-full border",
                      stageColorClasses(key).swatch,
                    )}
                  >
                    {key === stage.color && (
                      <IconCheck
                        size={14}
                        stroke={3}
                        aria-hidden="true"
                        className="text-white"
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </Popover>

          <Tooltip content="Delete">
            <button
              type="button"
              aria-label={`Delete ${stage.name}`}
              onClick={onRemove}
              className="focus-ring flex size-control-md shrink-0 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:border-danger hover:text-danger"
            >
              <IconTrash size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        {stage.isClosed ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-32 flex-1">
              <SearchableSelect
                portal
                id={`stage-outcome-${stage.id}`}
                aria-label={`Outcome for ${stage.name}`}
                searchable={false}
                placeholder="Outcome"
                options={STAGE_OUTCOMES.map((option) => ({ ...option }))}
                value={stage.outcome}
                onChange={(next) =>
                  next && next !== stage.outcome && onPatch({ outcome: next })
                }
              />
            </div>
            <FollowUpToggle stage={stage} onPatch={onPatch} />
          </div>
        ) : (
          <>
            <SearchableSelect
              portal
              id={`stage-inclusion-${stage.id}`}
              aria-label={`Sales pipeline inclusion for ${stage.name}`}
              searchable={false}
              options={STAGE_INCLUSIONS.map((option) => ({ ...option }))}
              value={stage.inclusion}
              onChange={(next) =>
                next && next !== stage.inclusion && onPatch({ inclusion: next })
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-w-32 flex-1 items-center gap-2 rounded-control border border-hairline bg-canvas px-3 py-1.5">
                <span className="min-w-0 truncate text-sm text-ink-muted">
                  Probability
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_STAGE_PROBABILITY}
                  max={MAX_STAGE_PROBABILITY}
                  aria-label={`Probability for ${stage.name}`}
                  className="w-12 min-w-0 rounded-control border border-hairline bg-surface px-1.5 py-0.5 text-sm text-ink outline-none focus-ring"
                  value={probability}
                  onChange={(event) => setProbability(event.target.value)}
                  onBlur={commitProbability}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                      setProbability(String(stage.probability));
                    }
                  }}
                />
              </label>
              <FollowUpToggle stage={stage} onPatch={onPatch} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** The reference's truncated "Require Follow..." row, identical on both card kinds. */
function FollowUpToggle({
  stage,
  onPatch,
}: {
  stage: Stage;
  onPatch: (input: StagePatch) => void;
}) {
  return (
    <label className="flex min-w-32 flex-1 items-center justify-between gap-2 rounded-control border border-hairline bg-canvas px-3 py-1.5">
      <span className="min-w-0 truncate text-sm text-ink-muted">
        Require Follow-up
      </span>
      <Switch
        aria-label={`Require follow-up for ${stage.name}`}
        checked={stage.requireFollowUp}
        onChange={(event) => onPatch({ requireFollowUp: event.target.checked })}
      />
    </label>
  );
}
