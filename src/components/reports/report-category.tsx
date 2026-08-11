"use client";

import { useId, useMemo, useState } from "react";
import {
  IconChartHistogram,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { ReportCard } from "./report-card";
import type { ReportCategory as ReportCategoryModel } from "./report-registry";

/**
 * One collapsible hub section (RPT-01.1), traced from `reports-hub-leads-category-card-hover.png`
 * and `reports-hub-scrolled-follow-ups-category.png`: a chart-icon heading with the category
 * name, a count line ("7 Leads Reports"), its own search box, and a collapse toggle, over a
 * responsive card grid.
 *
 * Search and collapse are per-category local state — searching Leads must not touch Follow Ups.
 * The filter is a plain in-memory title/description match (static, no backend, no debounce), and
 * the count line always shows the category total, not the filtered result — it names the section.
 */
export function ReportCategory({
  category,
}: {
  category: ReportCategoryModel;
}) {
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState("");
  const bodyId = useId();

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return category.reports;
    return category.reports.filter(
      (report) =>
        report.title.toLowerCase().includes(term) ||
        report.description.toLowerCase().includes(term),
    );
  }, [category.reports, query]);

  const Chevron = open ? IconChevronUp : IconChevronDown;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <IconChartHistogram
              size={22}
              stroke={1.75}
              className="text-ink"
              aria-hidden="true"
            />
            <h2 className="text-xl font-semibold text-ink">{category.title}</h2>
          </div>
          <p className="mt-0.5 text-sm text-ink-muted">
            {category.reports.length} {category.title} Reports
          </p>
        </div>

        <div className="flex items-center gap-3">
          <SearchInput
            aria-label={`Search ${category.title} reports`}
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full sm:w-80"
          />
          <button
            type="button"
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={`${open ? "Collapse" : "Expand"} ${category.title} reports`}
            onClick={() => setOpen((value) => !value)}
            className="flex size-control-md shrink-0 items-center justify-center rounded-control bg-brand-subtle text-brand-strong transition-colors duration-(--duration-shell) ease-shell hover:bg-brand/20 focus-ring"
          >
            <Chevron size={18} stroke={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {open &&
        (filtered.length > 0 ? (
          <div
            id={bodyId}
            className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(17rem,100%),1fr))]"
          >
            {filtered.map((report) => (
              <ReportCard key={report.slug} report={report} />
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
