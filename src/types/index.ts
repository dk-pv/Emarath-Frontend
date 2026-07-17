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
};

/**
 * A user's column arrangement for one module (FND-03.1 AC4).
 *
 * `hidden` rather than `visible`: a column shipped after the user last saved must default
 * to shown. Storing the visible set would silently swallow it.
 */
export type ColumnPrefs = {
  /** Column keys in display order. Keys absent here fall back to declaration order. */
  order: string[];
  hidden: string[];
};

/**
 * What a list endpoint receives (FND-03.1 AC1/AC2).
 *
 * Paging and sorting are the server's job — Leads holds 15,000+ rows, so the browser must
 * never receive the full set. Every list module drives its table through this shape.
 */
export type ListQuery = {
  /** 1-based, matching what the pager displays. */
  page: number;
  size: number;
  sort?: SortState;
  search?: string;
  filters?: readonly FilterCondition[];
};

/** One page plus the total, so the pager can size itself without a second request. */
export type ListResult<TRow> = {
  rows: readonly TRow[];
  total: number;
};

/** Resolves a query to a page. The API client implements this; tests supply their own. */
export type ListSource<TRow> = (
  query: ListQuery,
) => Promise<ListResult<TRow>> | ListResult<TRow>;

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
