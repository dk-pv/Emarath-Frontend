"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconList, IconMapPin, IconRefresh } from "@tabler/icons-react";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { cn } from "@/lib/cn";
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
import { useToast } from "@/components/ui/Toast";
import { useGpsLocations } from "@/hooks/use-gps-locations";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { fetchAssignableAgents } from "@/services/lookups-service";
import { exportGpsRecords, type GpsExportFormat } from "@/lib/gps-export";
import {
  GPS_EVENT_FILTERS,
  filterGpsRecords,
  type GpsPinType,
} from "@/services/gps-service";
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
type GpsFilters = {
  userId: string | null;
  /** "Filter by Event" — a pin type, or null for All. Applied in the browser. */
  event: GpsPinType | null;
  date: string | null;
};
const EMPTY_FILTERS: GpsFilters = { userId: null, event: null, date: null };

/**
 * The GPS Map screen root (GPS-04.2 KPIs + GPS-05.1 map + GPS-06.1 list + GPS-07.1
 * filter). One period + one refresh token + one locations fetch drive every
 * section, so the counters, map pins and list rows always agree; the Filter
 * (Team Member + By Date) drives that one period, so changing it updates all three
 * together (AC2) and the Map/List toggle keeps the selection.
 *
 * This component owns the whole filtering pipeline. The server narrows by role, period
 * and Team Member; `filterGpsRecords` then applies the two browser-only dimensions —
 * Filter by Event and the table search — and the single array that falls out drives the
 * map markers, the table rows and the export. None of those three filters anything
 * itself, which is what guarantees they agree.
 *
 * The KPI cards stay on `/gps/summary`: they are the server's authoritative totals for
 * the period and Team Member (GPS-04.1), and the event filter is a view narrowing over
 * records, not a change to what the period contains.
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
      {
        key: "event",
        label: "Filter by Event",
        type: "select",
        // The reference names the unfiltered option "All", not "Any filter by event".
        emptyLabel: "All",
        options: GPS_EVENT_FILTERS.map((option) => ({
          label: option.label,
          value: option.value,
        })),
      },
      { key: "date", label: "By Date", type: "date" },
    ],
    [agents],
  );

  // Only filters the user actually set count, so a freshly loaded screen reads
  // "Filter" rather than claiming one active filter it does not have.
  const activeCount =
    (filters.userId ? 1 : 0) + (filters.event ? 1 : 0) + (filters.date ? 1 : 0);
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
  // The table's search lives here, not in the table: it narrows the same record set the
  // map and the export read, so it cannot be owned by one of the three consumers.
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Refresh only reloads; it never touches the filters, the search or the view, so the
  // screen comes back exactly as the supervisor left it.
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

  // THE single filtered set. Everything below reads this and nothing re-filters.
  const records = useMemo(
    () => filterGpsRecords(locations, { event: filters.event, search }),
    [locations, filters.event, search],
  );

  // A click while a fetch is already in flight would only restart the same request.
  const refreshing = isLoading;

  const handleExport = useCallback(
    async (format: GpsExportFormat) => {
      if (exporting) return;
      setExporting(true);
      try {
        await exportGpsRecords(format, records);
      } catch {
        toast({ title: "Couldn’t create the export", tone: "danger" });
      } finally {
        setExporting(false);
      }
    },
    [exporting, records, toast],
  );

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
          disabled={refreshing}
          aria-label="Refresh field activity"
        >
          <IconRefresh
            size={16}
            stroke={1.75}
            aria-hidden="true"
            className={cn(refreshing && "animate-spin")}
          />
        </IconButton>

        {/* GPS-08.1 — writes exactly the records on screen, filters and search included. */}
        <GpsExportMenu
          onExport={(format) => void handleExport(format)}
          disabled={exporting}
        />
      </div>

      {/* The roster sits beside the KPIs and the map, as the reference lays it out —
          so the counters narrow with the agent the supervisor picks. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-4">
        <GpsAgentPanel
          agents={agents}
          locations={records}
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
              locations={records}
              isLoading={isLoading}
              refreshedAt={refreshedAt}
              onRefresh={refresh}
            />
          ) : (
            <GpsListView
              locations={records}
              isLoading={isLoading}
              isError={isError}
              onRetry={refresh}
              search={search}
              onSearchChange={setSearch}
            />
          )}
        </div>
      </div>
    </ContentContainer>
  );
}
