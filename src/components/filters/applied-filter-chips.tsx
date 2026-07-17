"use client";

import { Chip } from "@/components/ui/Chip";
import { describeCondition } from "@/hooks/use-filters";
import type { FilterCondition, FilterField } from "@/types";

type AppliedFilterChipsProps = {
  conditions: readonly FilterCondition[];
  search: string;
  fieldOf: (key: string) => FilterField | undefined;
  onRemove: (key: string) => void;
  onClearSearch: () => void;
};

/** Each applied condition is removable on its own; search is shown as its own chip. */
export function AppliedFilterChips({
  conditions,
  search,
  fieldOf,
  onRemove,
  onClearSearch,
}: AppliedFilterChipsProps) {
  if (!conditions.length && !search.trim()) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {search.trim() && <Chip onRemove={onClearSearch}>Search: {search}</Chip>}
      {conditions.map((condition) => (
        <Chip key={condition.key} onRemove={() => onRemove(condition.key)}>
          {describeCondition(condition, fieldOf(condition.key))}
        </Chip>
      ))}
    </div>
  );
}
