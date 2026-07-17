import { cn } from "@/lib/cn";

type DashboardGridProps = {
  children: React.ReactNode;
  className?: string;
};

/** `min-w-0` on the tracks lets a grid child scroll internally rather than widen the grid. */
export function DashboardGrid({ children, className }: DashboardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6 xl:grid-cols-3 [&>*]:min-w-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
