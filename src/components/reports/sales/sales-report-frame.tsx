"use client";

import { useRouter } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { findReport } from "../report-registry";

/**
 * The page frame every Analytics Sales report shares, traced from the Oct 2026 Sales Funnel and
 * Sales Pipeline captures: a white header holding the report's title — itself the switcher to
 * the other Sales reports, green with its chevron flipped while open (the July capture) — and
 * the window · agents · pipeline line; then the toolbar, the section heading with the view
 * toggle, and the report body.
 *
 * `fill` is the Sales Funnel's layout (`analytics-sales-funnel-live-view-scrolled-2026-10.png`):
 * the header, toolbar and heading stay put while the body scrolls beneath them, and the body is
 * a size container, so a panel can be exactly as tall as the room under the heading (`100cqh`).
 */
export function SalesReportFrame({
  slug,
  subtitle,
  toolbar,
  heading,
  views,
  fill = false,
  children,
}: {
  slug: string;
  subtitle?: string;
  toolbar?: React.ReactNode;
  heading?: string;
  views?: React.ReactNode;
  fill?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const resolved = findReport("sales", slug);
  if (!resolved) return null;
  const { report, category } = resolved;

  const items: DropdownItem[] = category.reports.map((entry) => ({
    type: "item",
    id: entry.slug,
    label: entry.title,
    selected: entry.slug === report.slug,
    onSelect: () => router.push(entry.href),
  }));

  const header = (
    <header className="border-b border-hairline px-5 pt-2 pb-2">
      <h1 className="sr-only">{report.title}</h1>
      <Dropdown
        align="start"
        items={items}
        panelClassName="min-w-72"
        trigger={
          <span className="flex items-center gap-2 text-[17px] leading-6 font-medium text-ink transition-colors duration-(--duration-shell) ease-shell in-aria-expanded:text-brand">
            {report.title}
            <IconChevronDown
              size={16}
              stroke={2}
              aria-hidden="true"
              className="transition-transform duration-(--duration-shell) ease-shell in-aria-expanded:rotate-180"
            />
          </span>
        }
      />
      {subtitle && (
        <p className="text-[11.5px] leading-4 text-ink-muted">{subtitle}</p>
      )}
    </header>
  );

  const headingRow = (heading || views) && (
    <div className="mt-3 flex min-h-8.5 flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-medium text-ink">{heading}</h2>
      {views}
    </div>
  );

  if (fill) {
    return (
      <div className="flex h-full min-w-0 flex-col">
        <div className="shrink-0 bg-surface">
          {header}
          <div className="flex min-w-0 flex-col px-5 pt-2 pb-1.5">
            {toolbar}
            {headingRow}
          </div>
        </div>
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto [container-type:size]">
          <div className="flex min-w-0 flex-col px-5 pt-1 pb-5">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {header}
      <div className="flex min-w-0 flex-col px-5 pt-2 pb-5">
        {toolbar}
        {headingRow}
        <div className="mt-2 flex min-w-0 flex-col">{children}</div>
      </div>
    </div>
  );
}
