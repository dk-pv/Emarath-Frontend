"use client";

import { useState } from "react";
import {
  IconCalendarClock,
  IconDotsVertical,
  IconListDetails,
} from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { ReportSchedulerDrawer } from "@/components/reports/report-scheduler-drawer";
import { ReportSchedulerListDrawer } from "@/components/reports/report-scheduler-list-drawer";

export type ReportMoreMenuProps = {
  /** Preselects the Scheduler's Report Type with the report the menu sits on. */
  reportSlug?: string;
};

/**
 * The report toolbar's "More" kebab, sitting after the Summary/Detailed toggle: a ⋮ that
 * shows a "More" tooltip on hover and opens Schedule / Report Scheduler List on click.
 *
 * Both screens are real. The Scheduler collects a full schedule and validates it, but has
 * nowhere to persist it — Emarath has no scheduling backend — so Submit reports that
 * plainly and keeps the entered values rather than pretending to save. The list screen is
 * complete as-is: with no store, there are no saved schedules, which is exactly the empty
 * state the reference shows.
 */
export function ReportMoreMenu({ reportSlug }: ReportMoreMenuProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const items: DropdownItem[] = [
    {
      type: "item",
      id: "schedule",
      label: "Schedule",
      icon: IconCalendarClock,
      onSelect: () => setScheduleOpen(true),
    },
    {
      type: "item",
      id: "scheduler-list",
      label: "Report Scheduler List",
      icon: IconListDetails,
      onSelect: () => setListOpen(true),
    },
  ];

  return (
    <>
      <Tooltip content="More" portal>
        <Dropdown
          align="end"
          items={items}
          trigger={
            <span className="focus-ring flex size-control-sm items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink">
              <IconDotsVertical size={18} stroke={1.75} aria-hidden="true" />
              <span className="sr-only">More</span>
            </span>
          }
        />
      </Tooltip>

      {scheduleOpen && (
        <ReportSchedulerDrawer
          open
          defaultReportSlug={reportSlug}
          onClose={() => setScheduleOpen(false)}
          onSubmit={() => {
            // Validated and complete, but there is no scheduler API to POST it to.
            throw new Error(
              "Report scheduling needs a backend endpoint that doesn’t exist yet.",
            );
          }}
        />
      )}

      {listOpen && (
        <ReportSchedulerListDrawer open onClose={() => setListOpen(false)} />
      )}
    </>
  );
}
