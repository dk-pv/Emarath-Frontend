"use client";

import { cn } from "@/lib/cn";
import { STAGE_COLOR_KEYS, stageColorClasses } from "@/lib/stage-palette";

/**
 * The colour picker for adding/recolouring a stage (KAN-05.2).
 *
 * NO WORKPEX REFERENCE AVAILABLE — the recolour palette is not captured in any
 * screenshot or the video. This is a restrained design-system default: a grid of the
 * catalogue's palette colours (the same keys the Stage API accepts), the selected one
 * ringed. Isolated here so it can be swapped for the real Workpex picker later.
 */
export function StageSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (colorKey: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Stage colour" className="flex flex-wrap gap-2">
      {STAGE_COLOR_KEYS.map((key) => {
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={key}
            onClick={() => onChange(key)}
            className={cn(
              "focus-ring size-7 rounded-full ring-offset-2 ring-offset-surface transition",
              stageColorClasses(key).swatch,
              selected ? "ring-2 ring-ink" : "ring-1 ring-hairline",
            )}
          />
        );
      })}
    </div>
  );
}
