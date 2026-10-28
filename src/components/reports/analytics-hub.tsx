"use client";

import { useId, useState } from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { ReportCard } from "./report-card";
import {
  ANALYTICS_CATEGORIES,
  filterReports,
  type ReportCategory,
} from "./report-registry";

/**
 * The Analytics hub, traced from `analytics-hub-available-categories-default.png` (2026-10-26):
 * an edge-to-edge "Available Analytic Categories" bar holding the one search, then each category
 * as "Sales | 4 Sales Reports" with its collapse toggle over a four-across card grid, straight on
 * the canvas — no panel. A Client Component for the same reason as ReportsHub: the registry's
 * icons are components, which cannot cross the Server→Client boundary.
 *
 * The search filters every category; a category's count names the section, so it stays the
 * total of its listed cards (`hubHidden` ones excluded), as on the Reports hub.
 */
export function AnalyticsHub() {
  const [query, setQuery] = useState("");

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-3 border-b border-hairline px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between lg:px-5">
        <h2 className="text-lg font-semibold text-ink">
          Available Analytic Categories
        </h2>
        <div className="w-full sm:w-71">
          <SearchInput
            aria-label="Search analytics reports"
            placeholder="Search here..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-control pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pt-3.5 pb-4 lg:px-5 lg:pb-5">
        {ANALYTICS_CATEGORIES.map((category) => (
          <AnalyticsCategory
            key={category.key}
            category={category}
            query={query}
          />
        ))}
      </div>
    </div>
  );
}

function AnalyticsCategory({
  category,
  query,
}: {
  category: ReportCategory;
  query: string;
}) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const listed = category.reports.filter((report) => !report.hubHidden);
  const reports = filterReports(listed, query);
  const Chevron = open ? IconChevronUp : IconChevronDown;

  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-ink-soft">
          <h3 className="text-lg">{category.title}</h3>
          <span aria-hidden="true" className="text-lg">
            |
          </span>
          <p className="text-[14px]">
            {listed.length} {category.title} Reports
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? "Collapse" : "Expand"} ${category.title} reports`}
          onClick={() => setOpen((value) => !value)}
          className="flex size-7 shrink-0 items-center justify-center rounded-control border border-brand bg-brand-subtle text-brand transition-colors duration-(--duration-shell) ease-shell hover:bg-brand/20 focus-ring"
        >
          <Chevron size={18} stroke={2} aria-hidden="true" />
        </button>
      </div>

      {open &&
        (reports.length > 0 ? (
          <div id={bodyId} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {reports.map((report) => (
              <ReportCard
                key={report.slug}
                report={report}
                variant="analytics"
              />
            ))}
          </div>
        ) : (
          <p id={bodyId} className="py-4 text-sm text-ink-muted">
            No reports match “{query.trim()}”.
          </p>
        ))}
    </section>
  );
}
