"use client";

import { useMemo, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchInput } from "@/components/ui/SearchInput";
import { cn } from "@/lib/cn";
import type { GpsPinRecord } from "@/services/gps-service";

export type GpsAgent = { id: string; name: string };

/**
 * The field-agent roster beside the map, from GPS-MAP-overview.mp4: a search field
 * over a scrolling list of agents, each row an avatar, the agent's name and their
 * tracking status, with the selected row tinted. Selecting a row narrows the whole
 * screen to that agent — it writes the same Team Member filter the Filter popover
 * does, so the KPIs, map and list stay in agreement (GPS-07.1 AC2) instead of the
 * panel becoming a second, competing filter.
 *
 * Status is read from the pins already fetched for the period rather than guessed:
 * an agent with an AUTOMATIC_TRACKING pin is reporting, and every other agent shows
 * "User tracking disabled" — which is what the reference shows, and what is actually
 * true here while GPS-03.1's passive tracking client remains blocked.
 *
 * Scope note: no GPS backlog task defines this panel; it is built as an approved
 * extension on top of GPS-05.1's screen.
 */
export function GpsAgentPanel({
  agents,
  locations,
  selectedId,
  onSelect,
  collapsed,
  onToggle,
}: {
  agents: GpsAgent[];
  /** The period's pins — the source for each agent's tracking status. */
  locations: GpsPinRecord[];
  selectedId: string | null;
  /** Re-selecting the active agent clears the narrowing, as the Filter's Clear does. */
  onSelect: (agentId: string | null) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = useState("");

  const trackingAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const pin of locations) {
      if (pin.type === "AUTOMATIC_TRACKING") ids.add(pin.agentId);
    }
    return ids;
  }, [locations]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) => agent.name.toLowerCase().includes(term));
  }, [agents, search]);

  return (
    // The handle straddles the panel's right edge, so the panel keeps its own width
    // and the map is never overlapped by the control that reveals it.
    <div className="relative flex shrink-0">
      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border-hairline transition-[width] duration-(--duration-shell) ease-shell",
          // Collapsing is a desktop affordance: its handle is hidden below `lg`, so
          // the panel must stay open there or it would be unreachable.
          "w-full border-b pb-4 lg:border-b-0 lg:pb-0",
          collapsed
            ? "lg:w-0 lg:border-r-0 lg:pr-0"
            : "lg:w-80 lg:border-r lg:pr-4 xl:w-[25.75rem]",
        )}
      >
        <div className="px-1 pb-3">
          <SearchInput
            placeholder="Search"
            aria-label="Search agents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <ul className="scrollbar-slim min-h-0 flex-1 overflow-y-auto max-lg:max-h-64">
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-muted">
              No agents match “{search.trim()}”.
            </li>
          ) : (
            rows.map((agent) => {
              const selected = agent.id === selectedId;
              return (
                <li key={agent.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelect(selected ? null : agent.id)}
                    className={cn(
                      // px-3 py-4 + 36px avatar + 15/13px type reproduces the
                      // reference's ~74px row pitch, measured off GPS-MAP-overview.mp4.
                      "focus-ring flex w-full items-center gap-3 rounded-control px-3 py-4 text-left transition-colors duration-(--duration-shell) ease-shell",
                      selected ? "bg-brand-subtle" : "hover:bg-canvas",
                    )}
                  >
                    <Avatar name={agent.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {agent.name}
                      </span>
                      <span className="block truncate text-[13px] text-ink-muted">
                        {trackingAgentIds.has(agent.id)
                          ? "Tracking active"
                          : "User tracking disabled"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Show agent list" : "Hide agent list"}
        className="focus-ring absolute top-1/2 -right-2 z-10 hidden h-16 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-white shadow-sm transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong lg:flex"
      >
        {collapsed ? (
          <IconChevronRight size={14} stroke={2.5} aria-hidden="true" />
        ) : (
          <IconChevronLeft size={14} stroke={2.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
