"use client";

import { Fragment, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { TabStrip } from "@/components/ui/Tabs";
import { useAuth } from "@/components/auth/auth-context";
import { CustomerJourney } from "@/components/leads/customer-journey";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LogisticsOrderActions } from "@/components/logistics/logistics-order-actions";
import { LogisticsStatusBadge } from "@/components/logistics/logistics-status-badge";
import { can } from "@/constants/permissions";
import { formatAED, formatDateTime } from "@/lib/format";
import { orderNumberLabel, renderableActions } from "@/lib/logistics-orders";
import type { LogisticsOrder } from "@/services/logistics-service";

const TABS = [
  { id: "details", label: "Details" },
  { id: "journey", label: "Journey" },
] as const;

type Field = { label: string; value: React.ReactNode };

const when = (iso: string | null) => (iso ? formatDateTime(iso) : null);

/** A titled group of label/value rows; an empty value shows the tables' muted em dash. */
function Section({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {/* A fixed label column, so values start on one line down the whole panel. */}
      <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {fields.map((field) => (
          <Fragment key={field.label}>
            <dt className="text-ink-muted">{field.label}</dt>
            <dd className="break-words text-ink">
              {field.value ?? <span className="text-ink-subtle">—</span>}
            </dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

/**
 * One order: what it is, who it is for, and — in the Journey tab — everything recorded about
 * it, through the same audit timeline the Lead Detail uses.
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
        <div className="flex flex-col gap-6">
          <Section
            title="Order"
            fields={[
              {
                label: "Order Number",
                value: orderNumberLabel(order.orderNumber),
              },
              {
                label: "Status",
                value: <LogisticsStatusBadge status={order.status} />,
              },
              { label: "Created", value: when(order.convertedAt) },
              { label: "Last Updated", value: when(order.statusChangedAt) },
            ]}
          />

          <div className="flex flex-col gap-1">
            <Section
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
                { label: "Street", value: order.street },
                { label: "City", value: order.city },
                { label: "State", value: order.state },
                { label: "Country", value: order.country },
                { label: "National Code", value: order.nationalCode },
              ]}
            />
            <p className="text-xs text-ink-muted">
              The order’s own copy, taken when the lead was won.
            </p>
          </div>

          <Section
            title="Products"
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
            ]}
          />

          {order.qcDecidedAt && (
            <Section
              title="QC"
              fields={[
                { label: "Decided", value: when(order.qcDecidedAt) },
                { label: "QC Remarks", value: order.qcRemarks },
              ]}
            />
          )}

          {order.dispatchedAt && (
            <Section
              title="Shipment"
              fields={[
                { label: "AWB Number", value: order.awbNumber },
                { label: "Courier", value: order.courier },
                { label: "Dispatched", value: when(order.dispatchedAt) },
                { label: "Delivered", value: when(order.deliveredAt) },
              ]}
            />
          )}

          {order.cancelledAt && (
            <Section
              title="Cancellation"
              fields={[
                { label: "Cancelled", value: when(order.cancelledAt) },
                { label: "Reason", value: order.cancelReason },
              ]}
            />
          )}

          {order.rtoAt && (
            <Section
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
