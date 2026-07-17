export type Size = "sm" | "md" | "lg";

export type Tone =
  "brand" | "neutral" | "success" | "warning" | "danger" | "info";

export type SortDirection = "asc" | "desc";

export type SortState<TKey extends string = string> = {
  key: TKey;
  direction: SortDirection;
};

export type SelectOption<TValue extends string = string> = {
  label: string;
  value: TValue;
  disabled?: boolean;
};

export type TableColumn<TRow> = {
  key: string;
  header: string;
  /** Enables the sorting affordance in the table header. */
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: TRow) => React.ReactNode;
  /** Value used when the table sorts this column client-side. */
  sortValue?: (row: TRow) => string | number;
};

/** A filterable field a module contributes to the shared filter panel (FND-03.2 AC5). */
export type FilterField = {
  key: string;
  label: string;
} & (
  | { type: "text" }
  | { type: "select"; options: readonly SelectOption[] }
  | { type: "multi"; options: readonly SelectOption[] }
  | { type: "date" }
  | { type: "number" }
);

/** One applied condition. `value` is normalised per field type. */
export type FilterCondition = {
  key: string;
  value: string | string[] | number | null;
};

export type FilterState = {
  search: string;
  conditions: FilterCondition[];
};

/** Dashboard summary card, mirroring the Workpex KPI carousel. */
export type SummaryCard = {
  id: string;
  label: string;
  value: string;
  caption: string;
  tone: Tone;
};

/** Leaderboard row, mirroring the Workpex Sales Team Activity Board. */
export type LeaderboardRow = {
  id: string;
  agent: string;
  leads: number;
  calls: number;
  convertedAmount: number;
  conversionRate: number;
};
