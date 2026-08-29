"use client";

import {
  IconCalendarClock,
  IconDotsVertical,
  IconListDetails,
} from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";

/**
 * The report toolbar's "More" kebab, sitting after the Summary/Detailed toggle: a ⋮ that
 * shows a "More" tooltip on hover and opens Schedule / Report Scheduler List on click.
 *
 * Both entries are Workpex's scheduling features, which have no Emarath backend yet — so
 * they answer with a toast rather than silently doing nothing or fabricating a scheduler.
 * The menu itself is the shared `Dropdown` (panel width, padding, 20px icons, hover wash,
 * shadow, radius and outside-click dismissal all come from the design system).
 */
export function ReportMoreMenu() {
  const { toast } = useToast();

  const notScheduled = (feature: string) =>
    toast({
      title: `${feature} isn’t available yet`,
      description: "Report scheduling has no backend in Emarath so far.",
      tone: "neutral",
    });

  const items: DropdownItem[] = [
    {
      type: "item",
      id: "schedule",
      label: "Schedule",
      icon: IconCalendarClock,
      onSelect: () => notScheduled("Schedule"),
    },
    {
      type: "item",
      id: "scheduler-list",
      label: "Report Scheduler List",
      icon: IconListDetails,
      onSelect: () => notScheduled("Report Scheduler List"),
    },
  ];

  return (
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
  );
}
