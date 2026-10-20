/**
 * Financial Dashboard v1 (client acceptance criterion 13): what each figure on the screen means,
 * the figures that cannot be shown yet and why, and the pure helpers the screen renders with.
 *
 * Every figure comes from `GET /reports/team-performance` — the same scoped rows Team Performance
 * shows — so the dashboard calculates nothing of its own beyond shares of counts. None of it is a
 * payment: an Accounts record holds a payment status, no amount, so money received, outstanding
 * or collected is listed as unavailable rather than estimated.
 */
import {
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  type LogisticsStatus,
} from "./logistics-orders";
import type {
  OrderStatusFigures,
  TeamPerformanceDateField,
  TeamPerformanceFigures,
} from "./team-performance";

/** The dates the window can apply to: Team Performance's two, plus the order's creation. */
export const FINANCIAL_DATE_FIELDS: readonly {
  value: TeamPerformanceDateField;
  label: string;
}[] = [
  { value: "created", label: "Lead Created Date" },
  { value: "statusChanged", label: "Lead Status Changed Date" },
  { value: "orderCreated", label: "Order Created Date" },
];

/** The outcomes the specification compares (§9, "Delivered vs cancelled vs RTO"). */
export const OUTCOME_STATUSES = [
  "DELIVERED",
  "CANCELLED",
  "RTO",
] as const satisfies readonly LogisticsStatus[];

export type FinancialMetric =
  | "wonLeads"
  | "wonValue"
  | "orders"
  | "orderValue"
  | "delivered"
  | "cancelled"
  | "rto";

/** Each figure's name and what it counts — the cards' ⓘ and the Definitions list say this. */
export const FINANCIAL_METRICS: Record<
  FinancialMetric,
  { label: string; definition: string }
> = {
  wonLeads: {
    label: "Won Leads",
    definition: "Leads in these filters whose stage is WON now.",
  },
  wonValue: {
    label: "Won Lead Value",
    definition:
      "The sum of the won leads' Actual Amount, as the sales team entered it. A sales value — not money received.",
  },
  orders: {
    label: "Orders",
    definition:
      "Logistics orders of the leads in these filters, whatever their status now. A lead has at most one order.",
  },
  orderValue: {
    label: "Order Value",
    definition:
      "The sum of those orders' Order Value: the lead's Actual Amount when it was won, or the Logistics Manager's correction. The value of what was ordered — not money received.",
  },
  delivered: {
    label: "Delivered",
    definition:
      "Orders whose status is Delivered now, and their order value. Delivered is not paid: payment amounts are not recorded yet.",
  },
  cancelled: {
    label: "Cancelled",
    definition: "Orders whose status is Cancelled now, and their order value.",
  },
  rto: {
    label: "RTO",
    definition: "Orders whose status is RTO now, and their order value.",
  },
};

export const OUTCOME_METRIC: Record<
  (typeof OUTCOME_STATUSES)[number],
  FinancialMetric
> = { DELIVERED: "delivered", CANCELLED: "cancelled", RTO: "rto" };

/** A figure the specification asks for that the data cannot support yet, and what it waits for. */
export interface UnavailableMetric {
  label: string;
  needs: string;
}

export const UNAVAILABLE_METRICS: readonly UnavailableMetric[] = [
  {
    label: "Payment received",
    needs:
      "Accounts v1b — an Accounts record holds a payment status only, with no amount, and partial payments and remittance rules are not decided.",
  },
  {
    label: "Payment pending",
    needs:
      "Accounts v1b amounts — what is still due on an order cannot be read from a status.",
  },
  {
    label: "Outstanding amount",
    needs:
      "Accounts v1b — the amounts received, partial payments and remittance rules.",
  },
  {
    label: "Collection %",
    needs:
      "Accounts v1b amounts, and the client's definition of what it is a share of.",
  },
  {
    label: "Logistics and shipping cost",
    needs: "Cost data — no courier or shipping cost is recorded on an order.",
  },
  {
    label: "Product cost",
    needs: "Cost data — no product cost is recorded.",
  },
  {
    label: "Estimated profitability",
    needs:
      "Revenue − product cost − logistics cost − other costs (specification §9): the costs above, other costs, and which revenue figure the client counts.",
  },
];

/** One status's figures from a row — zeros when the row does not carry it. */
export function statusFigures(
  figures: Pick<TeamPerformanceFigures, "orderStatus">,
  status: LogisticsStatus,
): OrderStatusFigures {
  return (
    figures.orderStatus.find((row) => row.status === status) ?? {
      status,
      orders: 0,
      value: "0",
      unvalued: 0,
    }
  );
}

/** `count` as a percentage of `orders`, to two places; 0 when there are no orders. */
export function shareOfOrders(count: number, orders: number): number {
  return orders > 0 ? Math.round((count / orders) * 10000) / 100 : 0;
}

export interface StatusRow extends OrderStatusFigures {
  label: string;
  /** Of the row's orders, a percentage to two places. */
  share: number;
}

/** The Orders by status table: every status in pipeline order, with its share of the orders. */
export function statusRows(figures: TeamPerformanceFigures): StatusRow[] {
  return LOGISTICS_STATUSES.map((status) => {
    const row = statusFigures(figures, status);
    return {
      ...row,
      label: LOGISTICS_STATUS_LABEL[status],
      share: shareOfOrders(row.orders, figures.orders),
    };
  });
}

/** Orders with no Order Value recorded, in every status. */
export function unvaluedOrders(
  figures: Pick<TeamPerformanceFigures, "orderStatus">,
): number {
  return figures.orderStatus.reduce((sum, row) => sum + row.unvalued, 0);
}
