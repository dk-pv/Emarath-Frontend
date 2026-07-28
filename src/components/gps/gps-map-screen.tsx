"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconList, IconMapPin, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { Button } from "@/components/ui/Button";
import { FilterPanel } from "@/components/filters/filter-panel";
import { GpsKpiCards } from "@/components/gps/gps-kpi-cards";
import { GpsMapView } from "@/components/gps/gps-map-view";
import { GpsListView } from "@/components/gps/gps-list-view";
import { useGpsLocations } from "@/hooks/use-gps-locations";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { FilterCondition, FilterField, ListQuery } from "@/types";

/**
 * The GPS Filter (GPS-07.1). One picked day resolves to its full-day window;
 * absent → today, a sensible default for daily field supervision (AC5). `to` is
 * the inclusive end-of-day the summary/locations reads expect (`lte`).
 */
function dayRange(dateIso: string | null): { from: string; to: string } {
  const base = dateIso ? new Date(dateIso) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

const AUTO_REFRESH_MS = 60_000;

type View = "map" | "list";

const VIEWS: { id: View; label: string; icon: typeof IconMapPin }[] = [
  { id: "map", label: "Map view", icon: IconMapPin },
  { id: "list", label: "List view", icon: IconList },
];

/** The GPS Filter's persisted selection — survives navigation within a session (AC3). */
type GpsFilters = { userId: string | null; date: string | null };
const EMPTY_FILTERS: GpsFilters = { userId: null, date: null };

/**
 * The GPS Map screen root (GPS-04.2 KPIs + GPS-05.1 map + GPS-06.1 list + GPS-07.1
 * filter). One period + one refresh token + one locations fetch drive every
 * section, so the counters, map pins and list rows always agree; the Filter
 * (Team Member + By Date) drives that one period, so changing it updates all three
 * together (AC2) and the Map/List toggle keeps the selection. The "Filter by Event"
 * leg the Workpex popup shows is deferred — GPS-07.1's ACs cover period only and
 * the read APIs have no event dimension.
 */
export function GpsMapScreen() {
  const [filters, setFilters] = usePersistentState<GpsFilters>(
    "gps.filters",
    EMPTY_FILTERS,
  );

  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then(setAgents)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Team Member + By Date, per ui-reference/gps-map/gps-map-filters-popover-open.png.
  const fields = useMemo<FilterField[]>(
    () => [
      {
        key: "userId",
        label: "Team Member",
        type: "select",
        options: agents.map((agent) => ({
          label: agent.name,
          value: agent.id,
        })),
      },
      { key: "date", label: "By Date", type: "date" },
    ],
    [agents],
  );

  const activeCount =
    (filters.userId ? 1 : 0) + (filters.date ? 1 : 0);
  const valueOf = useCallback(
    (key: string) => filters[key as keyof GpsFilters] ?? null,
    [filters],
  );
  const onChange = useCallback(
    (key: string, value: FilterCondition["value"]) =>
      setFilters((current) => ({
        ...current,
        [key]: typeof value === "string" && value ? value : null,
      })),
    [setFilters],
  );
  const onClear = useCallback(
    () => setFilters(EMPTY_FILTERS),
    [setFilters],
  );

  // One query drives the KPIs, map and list, so all three reflect the same period
  // and Team Member (AC2). Identity changes only when a filter changes.
  const query = useMemo<ListQuery>(() => {
    const { from, to } = dayRange(filters.date);
    const conditions: FilterCondition[] = [
      { key: "dateFrom", value: from },
      { key: "dateTo", value: to },
    ];
    if (filters.userId) {
      conditions.push({ key: "userId", value: filters.userId });
    }
    return { page: 1, size: 500, filters: conditions };
  }, [filters.userId, filters.date]);

  const [reloadToken, setReloadToken] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const [view, setView] = useState<View>("map");
  const refresh = useCallback(() => {
    setReloadToken((token) => token + 1);
    setRefreshedAt(Date.now());
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // One fetch shared by the map and the list, so both show the same data (AC2).
  const { locations, isLoading, isError } = useGpsLocations(query, reloadToken);

  return (
    <ContentContainer className="p-4 lg:p-6">
      <div className="flex items-center justify-end gap-2">
        <FilterPanel
          fields={fields}
          activeCount={activeCount}
          valueOf={valueOf}
          onChange={onChange}
          onClear={onClear}
        />

        <div
          role="group"
          aria-label="View"
          className="flex rounded-control border border-hairline bg-surface p-0.5"
        >
          {VIEWS.map(({ id, label, icon: ViewIcon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              aria-label={label}
              onClick={() => setView(id)}
              className={cn(
                "focus-ring flex size-control-sm items-center justify-center rounded-[calc(var(--radius-control)-2px)]",
                view === id
                  ? "bg-brand text-white"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              <ViewIcon size={18} stroke={1.75} aria-hidden="true" />
            </button>
          ))}
        </div>

        <Button variant="secondary" size="sm" onClick={refresh}>
          <IconRefresh size={16} stroke={1.75} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <GpsKpiCards query={query} reloadToken={reloadToken} />

      {view === "map" ? (
        <GpsMapView
          locations={locations}
          isLoading={isLoading}
          refreshedAt={refreshedAt}
          onRefresh={refresh}
        />
      ) : (
        <GpsListView
          locations={locations}
          isLoading={isLoading}
          isError={isError}
          onRetry={refresh}
        />
      )}
    </ContentContainer>
  );
}
