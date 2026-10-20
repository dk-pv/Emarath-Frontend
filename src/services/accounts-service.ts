import { apiGet, apiPost } from "@/lib/api-client";
import {
  ACCOUNTS_FILTER_OPTIONS_PATH,
  ACCOUNTS_RECORDS_PATH,
  ACCOUNTS_SUMMARY_PATH,
  accountsFilterParams,
  accountsRecordsParams,
  type AccountsFilterOptions,
  type AccountsFilters,
  type AccountsRecordsQuery,
  type AccountsSummary,
  type PaymentStatus,
} from "@/lib/accounts-records";
import type { ListResult } from "@/types";

/**
 * One Accounts record as the API returns it (ADR-0096): the payment status of one delivered
 * order, with that order as Accounts needs to see it. Money is a decimal string, never a float.
 */
export type AccountsRecord = {
  id: string;
  status: PaymentStatus;
  statusChangedAt: string;
  /** When the order was delivered and entered Accounts. */
  createdAt: string;
  order: {
    id: string;
    orderNumber: number;
    leadId: string;
    customerName: string;
    primaryPhone: string;
    country: string | null;
    city: string | null;
    product: string | null;
    orderValue: string | null;
    paymentMethod: string | null;
    awbNumber: string | null;
    courier: string | null;
    deliveredAt: string | null;
    /** `YYYY-MM-DD` — a calendar day, never put through a `Date`. */
    deliveryDate: string | null;
  };
  /**
   * The statuses this caller may move the record to now, and whether it may correct it — decided
   * by the backend. The UI renders them; it never works permissions out itself.
   */
  allowedMoves: readonly string[];
  canCorrect: boolean;
};

/** One page of records. Scoped server-side to Accounts and the admin. */
export function fetchAccountsRecords(
  query: AccountsRecordsQuery,
  signal?: AbortSignal,
): Promise<ListResult<AccountsRecord>> {
  return apiGet<ListResult<AccountsRecord>>(
    ACCOUNTS_RECORDS_PATH,
    accountsRecordsParams(query),
    signal,
  );
}

/** The count per status under the filters other than status, and their total. */
export function fetchAccountsSummary(
  filters: AccountsFilters,
  signal?: AbortSignal,
): Promise<AccountsSummary> {
  return apiGet<AccountsSummary>(
    ACCOUNTS_SUMMARY_PATH,
    accountsFilterParams({ ...filters, status: [] }),
    signal,
  );
}

/** The payment methods and couriers of the records' orders — what the filter offers. */
export function fetchAccountsFilterOptions(
  signal?: AbortSignal,
): Promise<AccountsFilterOptions> {
  return apiGet<AccountsFilterOptions>(
    ACCOUNTS_FILTER_OPTIONS_PATH,
    undefined,
    signal,
  );
}

export function fetchAccountsRecord(
  id: string,
  signal?: AbortSignal,
): Promise<AccountsRecord> {
  return apiGet<AccountsRecord>(
    `${ACCOUNTS_RECORDS_PATH}/${id}`,
    undefined,
    signal,
  );
}

/**
 * A payment-status move from `expectedStatus` — the status the caller saw — so a record someone
 * else changed meanwhile is refused (409) rather than overwritten. Returns the record as it now
 * stands, with its new `allowedMoves`.
 */
export function movePaymentStatus(
  id: string,
  body: { status: PaymentStatus; expectedStatus: string; remarks?: string },
): Promise<AccountsRecord> {
  return apiPost<AccountsRecord>(`${ACCOUNTS_RECORDS_PATH}/${id}/status`, body);
}

/** A correction (Q14): any other status, backwards included, with a mandatory reason. */
export function correctPaymentStatus(
  id: string,
  body: { status: PaymentStatus; expectedStatus: string; reason: string },
): Promise<AccountsRecord> {
  return apiPost<AccountsRecord>(
    `${ACCOUNTS_RECORDS_PATH}/${id}/correction`,
    body,
  );
}
