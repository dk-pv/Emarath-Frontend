import { cn } from "@/lib/cn";

export type SeparatorOrientation = "horizontal" | "vertical";

const ORIENTATION_CLASS: Record<SeparatorOrientation, string> = {
  horizontal: "h-px w-full",
  vertical: "h-full w-px",
};

export type SeparatorProps = React.ComponentProps<"div"> & {
  orientation?: SeparatorOrientation;
};

export function Separator({
  className,
  orientation = "horizontal",
  ref,
  ...props
}: SeparatorProps) {
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-hairline",
        ORIENTATION_CLASS[orientation],
        className,
      )}
      {...props}
    />
  );
}
