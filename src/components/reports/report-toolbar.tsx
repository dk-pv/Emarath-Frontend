import {
  IconAdjustmentsHorizontal,
  IconCalendar,
  IconChevronDown,
  IconFilter,
  IconUser,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";

/**
 * A report toolbar control (RPT-01.2), styled like every Workpex toolbar pill
 * (`reports-no-activity-leads-summary-*.png`): icon + label + chevron. It is the shared
 * primitive the shell's filter bar is built from. Disabled by default — the shell provides
 * the bar structure and a consistent value/onClick interface, and each report (RPT-02/03/04)
 * enables and wires its own controls to its scoped query. It carries no data behaviour itself.
 */
export function ReportToolbarButton({
  label,
  icon: Glyph,
  onClick,
  disabled = true,
}: {
  label: string;
  icon: Icon;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? "Filters activate once the report is built" : undefined}
      className={cn(
        TOOLBAR_BUTTON_CLASS,
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
      )}
    >
      <Glyph size={18} stroke={1.75} aria-hidden="true" />
      {label}
      <IconChevronDown size={16} stroke={1.75} aria-hidden="true" />
    </button>
  );
}

/**
 * The standard report filter bar (RPT-01.2) — the four controls every Workpex report shows:
 * Sales Agent, Pipeline, By Date, Filter. This is the reusable *structure*; for the shell task
 * the controls render disabled (no options are fetched — that is report business logic, out of
 * scope). Later reports pass wired handlers so a change re-runs their scoped query and refreshes
 * the shell. Nothing here fetches or fakes report data.
 */
export function ReportFilterBar() {
  const controls: { key: string; label: string; icon: Icon }[] = [
    { key: "agent", label: "Sales Agent", icon: IconUser },
    { key: "pipeline", label: "Pipeline", icon: IconFilter },
    { key: "date", label: "By Date", icon: IconCalendar },
    { key: "filter", label: "Filter", icon: IconAdjustmentsHorizontal },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {controls.map((control) => (
        <ReportToolbarButton
          key={control.key}
          label={control.label}
          icon={control.icon}
        />
      ))}
    </div>
  );
}
