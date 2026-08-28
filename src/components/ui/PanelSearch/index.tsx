import { IconSearch } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

const INPUT_CLASS =
  "focus-ring h-control-sm w-full rounded-control border border-hairline bg-surface pr-2 pl-8 text-sm text-ink";

export type PanelSearchProps = Omit<
  React.ComponentProps<"input">,
  "type" | "size"
> & {
  /** Names the box for assistive tech, e.g. "Search tags". */
  "aria-label": string;
};

/**
 * The search box inside a dropdown panel — MultiSelect, SearchableSelect, PhoneInput and
 * the Tags picker all filter their options through this one control.
 */
export function PanelSearch({ className, ref, ...props }: PanelSearchProps) {
  return (
    <span className="relative block">
      <IconSearch
        aria-hidden="true"
        stroke={1.75}
        className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={ref}
        placeholder="Search"
        className={cn(INPUT_CLASS, className)}
        {...props}
      />
    </span>
  );
}
