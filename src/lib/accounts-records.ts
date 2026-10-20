/**
 * The Accounts pipeline (ADR-0096): its payment statuses, the request the list makes to
 * `GET /accounts/records`, and the screen's address.
 *
 * Import-free, so its self-check (`accounts-records.check.ts`) compiles with plain tsc.
 */

/**
 * The client's Accounts statuses (specification §6), in its order. A delivered order arrives at
 * INITIAL (§4 step 11). Which moves between them are allowed is the backend's — provisional
 * pending the client — and each record carries the moves its caller may make (`allowedMoves`).
 */
export const PAYMENT_STATUSES = [
  "INITIAL",
  "PAYMENT_PENDING",
  "PAYMENT_RECEIVED",
  "PAYMENT_FAILED",
  "PARTIALLY_PAID",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** The specification's own names (§6). */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  INITIAL: "Initial",
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_RECEIVED: "Payment Received",
  PAYMENT_FAILED: "Payment Failed",
  PARTIALLY_PAID: "Partially Paid",
};

/** A status's label, or the raw value for one this build does not know yet — never blank. */
export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABEL[status as PaymentStatus] ?? status;
}

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

/** A correction may take a record to any other status (Q14) — never to the one it has. */
export function correctionTargets(from: string): PaymentStatus[] {
  return PAYMENT_STATUSES.filter((status) => status !== from);
}

export const ACCOUNTS_RECORDS_PATH = "/accounts/records";
export const ACCOUNTS_SUMMARY_PATH = `${ACCOUNTS_RECORDS_PATH}/summary`;
export const ACCOUNTS_FILTER_OPTIONS_PATH = `${ACCOUNTS_RECORDS_PATH}/filter-options`;

/** The columns the list can be ordered by — the backend's whitelist, nothing else. */
export const ACCOUNTS_SORT_KEYS = [
  "deliveredAt",
  "orderNumber",
  "customerName",
  "status",
  "statusChangedAt",
] as const;

export type AccountsSortKey = (typeof ACCOUNTS_SORT_KEYS)[number];

/** The list's order before anyone sorts it: the most recently delivered first, as the API. */
export const DEFAULT_ACCOUNTS_SORT: {
  key: AccountsSortKey;
  direction: "asc" | "desc";
} = { key: "deliveredAt", direction: "desc" };

export function isAccountsSortKey(value: string): value is AccountsSortKey {
  return (ACCOUNTS_SORT_KEYS as readonly string[]).includes(value);
}

/** The backend's limits: a payment method's and a courier's column, a move's note, a reason. */
export const PAYMENT_METHOD_MAX_LENGTH = 64;
export const COURIER_MAX_LENGTH = 64;
export const REMARKS_MAX_LENGTH = 2000;
export const CORRECTION_REASON_MAX_LENGTH = 500;
export const MAX_FILTER_VALUES = 100;

/** What narrows the list — sent by the list and, the status aside, by its counts. */
export type AccountsFilters = {
  status?: readonly PaymentStatus[];
  paymentMethod?: readonly string[];
  courier?: readonly string[];
  search?: string;
};

export type AccountsRecordsQuery = AccountsFilters & {
  page: number;
  size: number;
  sort: AccountsSortKey;
  direction: "asc" | "desc";
};

/** The filters as query parameters, repeating a key per value; empty ones are left out. */
export function accountsFilterParams(
  filters: AccountsFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["status", "paymentMethod", "courier"] as const) {
    for (const value of filters[key] ?? []) params.append(key, value);
  }
  const search = filters.search?.trim();
  if (search) params.set("search", search);
  return params;
}

export function accountsRecordsParams(
  query: AccountsRecordsQuery,
): URLSearchParams {
  const params = accountsFilterParams(query);
  params.set("page", String(query.page));
  params.set("size", String(query.size));
  params.set("sort", query.sort);
  params.set("direction", query.direction);
  return params;
}

/** How many records hold each status under the filters (the status filter aside), and in all. */
export type AccountsSummary = {
  counts: Record<PaymentStatus, number>;
  total: number;
};

export type AccountsFilterOptions = {
  paymentMethods: string[];
  couriers: string[];
};

/** The screen's state, as its address holds it. */
export type AccountsUrlState = {
  status: PaymentStatus[];
  paymentMethod: string[];
  courier: string[];
  q: string;
  page: number;
  size: number;
  sort: AccountsSortKey;
  direction: "asc" | "desc";
  /** The open record's id. */
  record: string | null;
};

export type AccountsUrlLimits = {
  pageSizes: readonly number[];
  defaultSize: number;
  searchMax: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Blank, over-long and repeated values dropped, at most the API's count. */
function filterValues(values: readonly string[], maxLength: number): string[] {
  const kept = values
    .map((value) => value.trim())
    .filter((value) => value && value.length <= maxLength);
  return [...new Set(kept)].slice(0, MAX_FILTER_VALUES);
}

/**
 * Reads the screen's state from the address. Anything unknown or malformed falls back to its
 * default rather than reaching the API as a request it would refuse.
 */
export function parseAccountsUrl(
  params: URLSearchParams,
  limits: AccountsUrlLimits,
): AccountsUrlState {
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  const sort = params.get("sort") ?? "";
  const direction = params.get("direction");
  const record = params.get("record") ?? "";
  const statuses = params.getAll("status");
  return {
    // In the pipeline's order whatever the address's, so one choice is always one address.
    status: PAYMENT_STATUSES.filter((status) => statuses.includes(status)),
    paymentMethod: filterValues(
      params.getAll("paymentMethod"),
      PAYMENT_METHOD_MAX_LENGTH,
    ),
    courier: filterValues(params.getAll("courier"), COURIER_MAX_LENGTH),
    q: (params.get("q") ?? "").trim().slice(0, limits.searchMax),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    size: limits.pageSizes.includes(size) ? size : limits.defaultSize,
    sort: isAccountsSortKey(sort) ? sort : DEFAULT_ACCOUNTS_SORT.key,
    direction:
      direction === "asc" || direction === "desc"
        ? direction
        : DEFAULT_ACCOUNTS_SORT.direction,
    record: UUID.test(record) ? record : null,
  };
}

/** The address for a state: only what differs from the defaults, so a plain visit stays plain. */
export function accountsUrlParams(
  state: AccountsUrlState,
  defaultSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of ["status", "paymentMethod", "courier"] as const) {
    for (const value of state[key]) params.append(key, value);
  }
  const q = state.q.trim();
  if (q) params.set("q", q);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.size !== defaultSize) params.set("size", String(state.size));
  if (
    state.sort !== DEFAULT_ACCOUNTS_SORT.key ||
    state.direction !== DEFAULT_ACCOUNTS_SORT.direction
  ) {
    params.set("sort", state.sort);
    params.set("direction", state.direction);
  }
  if (state.record) params.set("record", state.record);
  return params;
}

/**
 * What the screen says when records can't be loaded. A refusal is not a dropped connection: a
 * 403 means the role has no access, a 400 means the address carried filters the API refused.
 */
export function recordsLoadError(status: number | undefined): string {
  if (status === 403) {
    return "Your role doesn’t have access to Accounts.";
  }
  if (status === 400) {
    return "The filters in this page’s address aren’t valid. Try again to clear them.";
  }
  return "Something went wrong while loading the records. Check your connection and try again.";
}

/** The correction's reason is required (Q14); blank or spaces are not a reason. */
export function correctionReasonError(text: string): string | undefined {
  return text.trim() ? undefined : "Enter the reason for the correction.";
}

/**
 * Whether a refused change means the record (or the caller's rights) moved on since the panel
 * loaded — read it again — rather than a mistake in the form, which stays open to be fixed.
 */
export function refetchAfterRefusal(status: number | undefined): boolean {
  return status === 403 || status === 404 || status === 409;
}
