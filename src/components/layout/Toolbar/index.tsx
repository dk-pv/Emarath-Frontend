import { cn } from "@/lib/cn";

type ToolbarProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export function Toolbar({ left, right, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {left}
      </div>
      {/* `min-w-0` (not `shrink-0`) lets the right cluster be squeezed narrower than
          its single-line width, so its own `flex-wrap` actually engages and the controls
          wrap onto more rows instead of overflowing and being clipped off the right edge
          at narrower widths. `justify-end` keeps the cluster right-anchored (Workpex) in
          both the single-row and wrapped states. When there is room it sits at its natural
          width, right-aligned by the outer `justify-between`. */}
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {right}
      </div>
    </div>
  );
}
