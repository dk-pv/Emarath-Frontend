"use client";

import { useState } from "react";
import { DetailSection } from "@/components/ui/DetailSection";
import { Drawer } from "@/components/ui/Drawer";
import { TabStrip } from "@/components/ui/Tabs";
import { useAuth } from "@/components/auth/auth-context";
import { CustomerJourney } from "@/components/leads/customer-journey";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LogisticsOrderActions } from "@/components/logistics/logistics-order-actions";
import { LogisticsDeliveryDate } from "@/components/logistics/logistics-delivery-date";
import { LogisticsStatusBadge } from "@/components/logistics/logistics-status-badge";
import { can } from "@/constants/permissions";
import { formatAED, formatDateTime } from "@/lib/format";
import { orderNumberLabel, renderableActions } from "@/lib/logistics-orders";
import type { LogisticsOrder } from "@/services/logistics-service";

const TABS = [
  { id: "details", label: "Details" },
  { id: "journey", label: "Journey" },
] as const;

const when = (iso: string | null) => (iso ? formatDateTime(iso) : null);

/**
 * One order: what it is, who it is for, where and when it goes, and — in the Journey tab —
 * everything recorded about it, through the same audit timeline the Lead Detail uses. The number
 * and the status stay in the panel's header while the details scroll.
 *
 * Its actions are the backend's `allowedActions` for this caller (`LogisticsOrderActions`): QC's
 * decisions, the Sales Manager's resubmit, the shipment steps and the Logistics Manager's two
 * corrections. A caller offered none gets no footer at all, so the read-only panel is exactly
 * what it was.
 *
 * The shipment, cancellation and return sections appear once the order has reached them, so
 * the panel grows with the order rather than showing empty stages it may never reach.
 */
export function LogisticsOrderDrawer({
  order,
  onClose,
  onOrderChange,
}: {
  order: LogisticsOrder;
  onClose: () => void;
  /** The order as the server now has it, after an action or a refresh. */
  onOrderChange: (order: LogisticsOrder) => void;
}) {
  const [tab, setTab] = useState<string>("details");
  // An action dialog sits above the drawer in a portal; while one is open, a press inside it —
  // or its Escape — belongs to the dialog and must not close the drawer underneath.
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const { user } = useAuth();
  // The lead is sales data: the Logistics roles cannot open it (ADR-0084), so for them the
  // name stays plain text rather than a link to a page that would refuse them.
  const canOpenLead = can(user?.role, "useSalesModules");
  const title = `Order ${orderNumberLabel(order.orderNumber)}`;
  const actions = renderableActions(order.allowedActions);

  const quantity = (qty: string | null) => (qty ? ` × ${qty}` : "");

  return (
    <Drawer
      open
      onClose={() => {
        if (!actionDialogOpen) onClose();
      }}
      title={title}
      width="max-w-xl"
      footer={
        actions.length > 0 ? (
          <LogisticsOrderActions
            order={order}
            actions={actions}
            onOrderChange={onOrderChange}
            onDialogChange={setActionDialogOpen}
          />
        ) : undefined
      }
      header={
        <header className="border-b border-hairline p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <LogisticsStatusBadge status={order.status} />
          </div>
          <TabStrip
            className="mt-3"
            tabs={TABS}
            value={tab}
            onValueChange={setTab}
          />
        </header>
      }
    >
      {tab === "journey" ? (
        <CustomerJourney leadId={order.leadId} />
      ) : (
        // The header already holds the number and the status, so the groups start with what
        // was sold; each later group appears once the order has reached it.
        <div className="flex flex-col gap-4">
          <DetailSection
            title="Order summary"
            fields={[
              {
                label: "Product",
                value: order.product
                  ? `${order.product}${quantity(order.productQty)}`
                  : null,
              },
              {
                label: "Product 2",
                value: order.product2
                  ? `${order.product2}${quantity(order.product2Qty)}`
                  : null,
              },
              {
                label: "Order Value",
                value: order.orderValue ? formatAED(order.orderValue) : null,
              },
              { label: "Payment Method", value: order.paymentMethod },
              { label: "Created", value: when(order.convertedAt) },
              { label: "Last Updated", value: when(order.statusChangedAt) },
            ]}
          />

          <DetailSection
            title="Customer"
            fields={[
              {
                label: "Customer Name",
                value: canOpenLead ? (
                  <CustomerNameLink
                    leadId={order.leadId}
                    name={order.customerName}
                  />
                ) : (
                  order.customerName
                ),
              },
              { label: "Primary Phone", value: order.primaryPhone },
              { label: "Secondary Phone", value: order.secondaryPhone },
              { label: "Email", value: order.email },
            ]}
          />

          <DetailSection
            title="Delivery"
            fields={[
              {
                label: "Delivery Date",
                value: (
                  <LogisticsDeliveryDate
                    date={order.deliveryDate}
                    bucket={order.deliveryBucket}
                  />
                ),
              },
              { label: "Street", value: order.street },
              { label: "City", value: order.city },
              { label: "State", value: order.state },
              { label: "Country", value: order.country },
              { label: "National Code", value: order.nationalCode },
            ]}
          >
            <p className="text-xs text-ink-muted">
              The customer and delivery details are the order’s own copy, taken
              when the lead was won.
            </p>
          </DetailSection>

          {order.qcDecidedAt && (
            <DetailSection
              title="QC review"
              fields={[
                { label: "Decided", value: when(order.qcDecidedAt) },
                { label: "QC Remarks", value: order.qcRemarks },
              ]}
            />
          )}

          {order.dispatchedAt && (
            <DetailSection
              title="Tracking & courier"
              fields={[
                { label: "AWB Number", value: order.awbNumber },
                { label: "Courier", value: order.courier },
                { label: "Dispatched", value: when(order.dispatchedAt) },
                { label: "Delivered", value: when(order.deliveredAt) },
              ]}
            />
          )}

          {order.cancelledAt && (
            <DetailSection
              title="Cancellation"
              fields={[
                { label: "Cancelled", value: when(order.cancelledAt) },
                { label: "Reason", value: order.cancelReason },
              ]}
            />
          )}

          {order.rtoAt && (
            <DetailSection
              title="Return to Origin"
              fields={[
                { label: "Returned", value: when(order.rtoAt) },
                { label: "Reason", value: order.rtoReason },
              ]}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
