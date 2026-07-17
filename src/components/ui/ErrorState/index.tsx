"use client";

import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

const RETRY_CLASS =
  "mt-2 inline-flex h-control-sm items-center gap-2 rounded-control bg-brand px-4 text-sm font-medium text-white transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong focus-ring";

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry: () => void;
} & Omit<React.ComponentPropsWithoutRef<"div">, "title" | "children">;

export function ErrorState({
  title,
  description,
  onRetry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex size-full flex-col items-center justify-center gap-2 p-6 text-center",
        className,
      )}
      {...props}
    >
      <IconAlertTriangle
        aria-hidden="true"
        stroke={1.5}
        className="size-8 text-danger"
      />
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="max-w-prose text-sm text-ink-muted">{description}</p>
      <button type="button" onClick={onRetry} className={RETRY_CLASS}>
        <IconRefresh aria-hidden="true" stroke={2} className="size-4" />
        Try again
      </button>
    </div>
  );
}
