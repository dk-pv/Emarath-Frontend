"use client";

import { useMemo, useState } from "react";
import { IconFileSearch } from "@tabler/icons-react";
import { Table } from "@/components/ui/Table";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { PIN_COLORS, PIN_LABELS } from "@/components/gps/gps-legend";
import { formatDateTime } from "@/lib/format";
import type { GpsPinRecord } from "@/services/gps-service";
import type { TableColumn } from "@/types";

/** Stands in for a value the schema has no column for. */
const EMPTY = <span className="text-ink-subtle">—</span>;

const COLUMNS: TableColumn<GpsPinRecord>[] = [
  {
    key: "userName",
    header: "User Name",
    render: (row) => row.agentName,
  },
  {
    key: "dateTime",
    header: "Date & Time",
    render: (row) => formatDateTime(row.timestamp, { seconds: true }),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className="inline-flex items-center gap-2">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: PIN_COLORS[row.type] }}
        />
        {PIN_LABELS[row.type]}
      </span>
    ),
  },
  // Address, Notes and Actions exist in the reference table, so the column set
  // matches it — but `CheckIn` stores only agent, time and coordinates, and no GPS
  // acceptance criterion defines any of the three. They render an em-dash rather
  // than a fabricated value; a real address would need reverse geocoding and notes
  // a migration, neither of which is in scope.
  { key: "address", header: "Address", render: () => EMPTY },
  { key: "notes", header: "Notes", render: () => EMPTY },
  { key: "actions", header: "Actions", align: "right", render: () => EMPTY },
];

/**
 * The GPS list view (GPS-06.1): the same `/gps/locations` pins the map shows,
 * as a scannable table, with the column set of
 * ui-reference/gps-map/gps-map-list-view-table-empty-state.png. Search and
 * scrolling are client-side, since the locations endpoint returns one capped,
 * unpaged set.
 */
export function GpsListView({
  locations,
  isLoading,
  isError,
  onRetry,
}: {
  locations: GpsPinRecord[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return locations;
    return locations.filter(
      (pin) =>
        pin.agentName.toLowerCase().includes(query) ||
        PIN_LABELS[pin.type].toLowerCase().includes(query),
    );
  }, [locations, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SearchInput
          className="sm:w-64"
          placeholder="Search here..."
          aria-label="Search field activity"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <ResponsiveTableContainer
        label="Field activity"
        className="max-h-[520px] overflow-y-auto rounded-surface border border-hairline"
      >
        <Table
          columns={COLUMNS}
          rows={rows}
          getRowId={(row) => row.id}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={IconFileSearch}
              title="No data available"
              description="There's no data for the selected date range or filters. Try adjusting your filters to see more results."
            />
          }
          errorState={
            isError ? (
              <ErrorState
                title="Couldn't load field activity"
                description="The list didn't load. Check your connection and try again."
                onRetry={onRetry}
              />
            ) : undefined
          }
        />
      </ResponsiveTableContainer>
    </div>
  );
}
