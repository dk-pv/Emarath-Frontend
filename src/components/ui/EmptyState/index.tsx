import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: Icon;
  action?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<"div">, "title" | "children">;

export function EmptyState({
  title,
  description,
  icon: IconComponent,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex size-full flex-col items-center justify-center gap-2 p-6 text-center",
        className,
      )}
      {...props}
    >
      {IconComponent && (
        <IconComponent
          aria-hidden="true"
          stroke={1.5}
          className="size-8 text-ink-subtle"
        />
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-prose text-sm text-ink-muted">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
