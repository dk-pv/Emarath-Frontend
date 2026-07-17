"use client";

import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

type FilterBarProps = {
  children: React.ReactNode;
  onClear?: () => void;
  className?: string;
};

export function FilterBar({ children, onClear, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-surface border border-hairline bg-surface p-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {children}
      </div>

      {onClear ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="shrink-0 gap-1 text-ink-muted"
        >
          <IconX size={16} stroke={2} />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
