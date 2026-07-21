"use client";

import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { Select } from "@/components/ui/Select";
import { useLookup } from "@/hooks/use-lookup";

type StepSettingsProps = {
  pipeline: string;
  onPipelineChange: (value: string) => void;
  savedMapping: string;
  onSavedMappingChange: (value: string) => void;
};

/**
 * Step 2 — Import Settings, matching the walkthrough: a Pipeline selector with a
 * green add button and a Saved Mapping selector with a refresh button. Pipelines
 * come from the shared lookups API (the same source the New Lead form uses). Saved
 * mappings are a separate, not-yet-built feature, so that selector stays an inert
 * affordance with no options; the add and refresh buttons are inert for the same
 * reason (they belong to Settings › Sales Pipeline and the saved-mapping API).
 */
export function StepSettings({
  pipeline,
  onPipelineChange,
  savedMapping,
  onSavedMappingChange,
}: StepSettingsProps) {
  const { options: pipelines, isLoading } = useLookup("pipelines");

  return (
    <div className="mx-auto max-w-4xl">
      <section>
        <h2 className="text-lg font-semibold text-ink">Pipeline</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Please select a pipeline. All imported leads will be added to the
          selected pipeline.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Select
            className="flex-1"
            placeholder={isLoading ? "Loading pipelines…" : "Select Pipeline"}
            options={pipelines.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={pipeline}
            onChange={(event) => onPipelineChange(event.target.value)}
          />
          <button
            type="button"
            aria-label="Add pipeline"
            className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-brand text-white transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong focus-ring"
          >
            <IconPlus size={20} stroke={2} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Saved Mapping</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Select a saved mapping to quickly apply predefined field mappings
          during import.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Select
            className="flex-1"
            placeholder="Select Saved Mapping"
            options={[]}
            value={savedMapping}
            onChange={(event) => onSavedMappingChange(event.target.value)}
          />
          <button
            type="button"
            aria-label="Refresh saved mappings"
            className="flex size-control-md shrink-0 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring"
          >
            <IconRefresh size={18} stroke={1.75} aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
