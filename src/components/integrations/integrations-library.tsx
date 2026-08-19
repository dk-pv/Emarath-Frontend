"use client";

import { useId, useMemo, useState } from "react";
import { IconPuzzle, IconSettings } from "@tabler/icons-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { IntegrationCard } from "./integration-card";
import { INTEGRATION_CATEGORIES, INTEGRATIONS } from "./integration-registry";

const FILTER_OPTIONS = [
  { label: "All Integrations", value: "all" },
  ...INTEGRATION_CATEGORIES.map((category) => ({
    label: category,
    value: category,
  })),
];

/**
 * The Integration Library (INT-02.1 / 02.2 / 02.3), traced from
 * `ui-reference/integrations/integrations-library-grid-top-web-form-card-hover.png`: a header
 * (gear + "Integration Library", the enabled-count line, a category filter and a search box)
 * over a responsive 4/2/1-column card grid.
 *
 * All three behaviours are client-side over the local seed set (INT-01.1 backend registry is
 * unbuilt): enablement is `useState` and the count derives from it live (INT-02.2); category
 * filter + name/description/category search combine in one `useMemo` (INT-02.3). Wiring the
 * future registry API means replacing the two imported constants with fetched data — the shape
 * already matches, so nothing here changes. No backend call is faked.
 */
export function IntegrationsLibrary() {
  const [enabledIds, setEnabledIds] = useState(
    () =>
      new Set(
        INTEGRATIONS.filter((integration) => integration.enabled).map(
          (integration) => integration.id,
        ),
      ),
  );
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const gridId = useId();

  const toggle = (id: string) =>
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return INTEGRATIONS.filter((integration) => {
      if (category !== "all" && integration.category !== category) return false;
      if (!term) return true;
      return (
        integration.name.toLowerCase().includes(term) ||
        integration.description.toLowerCase().includes(term) ||
        integration.category.toLowerCase().includes(term)
      );
    });
  }, [category, query]);

  return (
    <Card className="p-6 lg:p-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconSettings
              size={22}
              stroke={1.75}
              className="text-ink"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-ink">
              Integration Library
            </h2>
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {enabledIds.size} Enabled{" "}
            {enabledIds.size === 1 ? "Integration" : "Integrations"}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Width lives on the wrapper, not the <select>/<input>: the shared controls anchor
              their chevron/icon to a full-width wrapper span, so sizing the inner control alone
              would leave the chevron floating at the wrapper's edge. */}
          <div className="sm:w-52">
            <Select
              aria-label="Filter integrations by category"
              options={FILTER_OPTIONS}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
          <div className="w-full sm:w-96">
            <SearchInput
              aria-label="Search integrations"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </div>

      {INTEGRATIONS.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={IconPuzzle}
          title="No integrations available"
          description="Integrations will appear here once they are added to the library."
        />
      ) : filtered.length > 0 ? (
        <div
          id={gridId}
          className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
        >
          {filtered.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              enabled={enabledIds.has(integration.id)}
              onToggle={() => toggle(integration.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          icon={IconPuzzle}
          title="No integrations found"
          description="No integrations match your search or filter. Try a different term or category."
        />
      )}
    </Card>
  );
}
