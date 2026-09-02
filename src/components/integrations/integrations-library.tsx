"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPuzzle, IconSettings } from "@tabler/icons-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { isAbortError } from "@/lib/api-client";
import {
  fetchIntegrations,
  type Integration,
} from "@/services/integrations-service";
import { IntegrationCard } from "./integration-card";

const ALL = "all";

/** The grid geometry, shared by the cards and their loading placeholders. */
const GRID_CLASS = "mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4";

/**
 * The Integration Library (INT-02.1), traced from
 * `ui-reference/integrations/integrations-library-grid-top-web-form-card-hover.png`: a
 * header (gear + "Integration Library", the enabled-count line, a category filter and a
 * search box) over a responsive 4/2/1-column card grid.
 *
 * Data comes from `GET /api/integrations` (INT-01.1). The API returns the registry
 * already ordered by `position`, so the reference card sequence is the server's and the
 * client never re-sorts. All four states are real: skeletons while the request is in
 * flight, an error state with retry when it fails, an empty state when the registry
 * returns nothing, and the grid when it returns rows — no faked delay anywhere.
 *
 * Enablement is still local state seeded from the API (INT-02.2 persists it); the header
 * count therefore starts from real backend data. The category filter derives its options
 * from what the API actually returned rather than a hardcoded union, so a provider tag
 * added server-side needs no frontend change.
 */
export function IntegrationsLibrary() {
  const [integrations, setIntegrations] = useState<Integration[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [enabledIds, setEnabledIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchIntegrations(controller.signal)
      .then((rows) => {
        if (!active) return;
        setIntegrations(rows);
        setEnabledIds(new Set(rows.filter((r) => r.enabled).map((r) => r.id)));
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setFailed(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadToken]);

  const retry = useCallback(() => {
    setIntegrations(null);
    setFailed(false);
    setReloadToken((token) => token + 1);
  }, []);

  const toggle = (id: string) =>
    setEnabledIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const options = useMemo(() => {
    const categories = [
      ...new Set((integrations ?? []).map((r) => r.category)),
    ];
    return [
      { label: "All Integrations", value: ALL },
      ...categories.map((value) => ({ label: value, value })),
    ];
  }, [integrations]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (integrations ?? []).filter((integration) => {
      if (category !== ALL && integration.category !== category) return false;
      if (!term) return true;
      return (
        integration.name.toLowerCase().includes(term) ||
        integration.description.toLowerCase().includes(term) ||
        integration.category.toLowerCase().includes(term)
      );
    });
  }, [integrations, category, query]);

  const isLoading = integrations === null && !failed;

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
          {/* The count line is held while loading rather than showing "0 Enabled",
              which would read as a real answer for a moment before correcting itself.
              The placeholder replaces the paragraph rather than sitting inside it —
              Skeleton renders a <div>, which is invalid (and a hydration error) in <p>. */}
          {isLoading ? (
            <Skeleton className="mt-1.5 h-4 w-40" />
          ) : (
            <p className="mt-0.5 text-sm text-ink-muted" aria-live="polite">
              {enabledIds.size} Enabled{" "}
              {enabledIds.size === 1 ? "Integration" : "Integrations"}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Width lives on the wrapper, not the <select>/<input>: the shared controls anchor
              their chevron/icon to a full-width wrapper span, so sizing the inner control alone
              would leave the chevron floating at the wrapper's edge. */}
          <div className="sm:w-52">
            <Select
              aria-label="Filter integrations by category"
              options={options}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              disabled={isLoading || failed}
            />
          </div>
          <div className="w-full sm:w-96">
            <SearchInput
              aria-label="Search integrations"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={isLoading || failed}
            />
          </div>
        </div>
      </div>

      {failed ? (
        <ErrorState
          className="mt-8"
          title="Couldn't load integrations"
          description="The integration library could not be reached. Check your connection and try again."
          onRetry={retry}
        />
      ) : isLoading ? (
        // Eight placeholders fill two rows of the desktop grid, so the page settles into
        // its real height instead of jumping when the rows arrive.
        <div className={GRID_CLASS} aria-hidden="true">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-72 rounded-surface" />
          ))}
        </div>
      ) : integrations?.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={IconPuzzle}
          title="No integrations available"
          description="Integrations will appear here once they are added to the library."
        />
      ) : filtered.length > 0 ? (
        <div className={GRID_CLASS}>
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
