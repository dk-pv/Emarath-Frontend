import { cn } from "@/lib/cn";

type SidebarSectionProps = {
  label: string;
  children: React.ReactNode;
  collapsed: boolean;
};

/**
 * The label's visibility mirrors SidebarRowLabel: below `lg` the sidebar is always in its
 * collapsed rail form, so the label stays hidden there whatever `collapsed` says.
 *
 * `aria-label` on the group keeps the section named for screen readers in both states,
 * since the visible label is the thing that disappears when collapsed.
 */
export function SidebarSection({
  label,
  children,
  collapsed,
}: SidebarSectionProps) {
  return (
    <div role="group" aria-label={label}>
      <p
        className={cn(
          "px-nav-inset pt-4 pb-2 text-xs font-medium tracking-wide text-white/60 uppercase",
          collapsed ? "hidden" : "hidden lg:block",
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}
