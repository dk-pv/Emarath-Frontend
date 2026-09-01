"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconList, IconMapPin, IconRefresh } from "@tabler/icons-react";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { IconButton } from "@/components/ui/IconButton";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/SegmentedControl";
import { FilterPanel } from "@/components/filters/filter-panel";
import { GpsAgentPanel } from "@/components/gps/gps-agent-panel";
import { GpsKpiCards } from "@/components/gps/gps-kpi-cards";
import { GpsMapView } from "@/components/gps/gps-map-view";
import { GpsListView } from "@/components/gps/gps-list-view";
import { GpsExportMenu } from "@/components/gps/gps-export-menu";
import { useGpsLocations } from "@/hooks/use-gps-locations";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { fetchAssignableAgents } from "@/services/lookups-service";
import { downloadGpsExport } from "@/services/gps-export-service";
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

const VIEWS: SegmentedOption<View>[] = [
  { value: "map", label: "Map view", icon: IconMapPin },
  { value: "list", label: "List view", icon: IconList },
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

  // The roster panel's open state persists like the sidebar's, so a supervisor who
  // works with it closed does not have to close it on every visit.
  const [panelCollapsed, setPanelCollapsed] = usePersistentState(
    "gps.agentPanelCollapsed",
    false,
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

  // The period is always in effect — no date picked means today, not "no filter" —
  // so it always counts, which is why the reference's trigger reads "Filter/1" on a
  // freshly loaded screen rather than "Filter".
  const activeCount = 1 + (filters.userId ? 1 : 0);
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
  const onClear = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

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
    // lg:h-full gives the column a definite height, so the map's `flex-1` divides the
    // space left over instead of growing past it and pushing the legend off-screen.
    // Below `lg` the sections stack and the page scrolls normally.
    <ContentContainer className="flex min-h-full flex-col gap-3 p-4 lg:h-full lg:min-h-0 lg:gap-3 lg:px-6 lg:py-4">
      <div className="flex items-center justify-end gap-2">
        <FilterPanel
          fields={fields}
          activeCount={activeCount}
          valueOf={valueOf}
          onChange={onChange}
          onClear={onClear}
          triggerVariant="solid"
        />

        <SegmentedControl
          aria-label="View"
          options={VIEWS}
          value={view}
          onChange={setView}
          iconOnly
        />

        {/* The reference's refresh is a green icon button, not a labelled one. */}
        <IconButton
          size="lg"
          onClick={refresh}
          aria-label="Refresh field activity"
        >
          <IconRefresh size={16} stroke={1.75} aria-hidden="true" />
        </IconButton>

        {/* GPS-08.1 — exports the current scoped/filtered view (period + Team Member). */}
        <GpsExportMenu
          onExport={(format) => downloadGpsExport(format, query)}
        />
      </div>

      {/* The roster sits beside the KPIs and the map, as the reference lays it out —
          so the counters narrow with the agent the supervisor picks. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        <GpsAgentPanel
          agents={agents}
          locations={locations}
          selectedId={filters.userId}
          onSelect={(agentId) =>
            setFilters((current) => ({ ...current, userId: agentId }))
          }
          collapsed={panelCollapsed}
          onToggle={() => setPanelCollapsed((value) => !value)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
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
        </div>
      </div>
    </ContentContainer>
  );
}
