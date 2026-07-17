import { cn } from "@/lib/cn";

type SkeletonProps = Omit<React.ComponentPropsWithoutRef<"div">, "children">;

/** Placeholder geometry only — hidden from assistive tech, which hears the live region instead. */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-control bg-hairline", className)}
      {...props}
    />
  );
}
