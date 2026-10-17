"use client";

import Link from "next/link";
import { IconTruck } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-context";
import { LogisticsStatusBadge } from "@/components/logistics/logistics-status-badge";
import { can } from "@/constants/permissions";
import { cn } from "@/lib/cn";
import {
  DELIVERY_BUCKET_LABEL,
  formatDateOnly,
  logisticsOrderHref,
  orderNumberLabel,
  type LeadLogisticsOrder,
} from "@/lib/logistics-orders";

/**
 * The Logistics order a lead converted into (ADR-0085): its number, where it stands and its
 * delivery date (ADR-0094), linked to the order's panel on the Logistics screen for a role that
 * can open it — where Sales sets the date. Read from the lead response's own `logisticsOrder` —
 * it makes no request — and shared by the Lead Detail page and the Leads quick-view drawer, so
 * both say the same thing.
 */
export function LogisticsOrderLink({
  order,
  className,
}: {
  order: LeadLogisticsOrder;
  className?: string;
}) {
  const { user } = useAuth();
  const label = (
    <>
      <IconTruck size={16} stroke={1.75} aria-hidden="true" />
      Logistics order {orderNumberLabel(order.orderNumber)}
    </>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      {can(user?.role, "useLogistics") ? (
        <Link
          href={logisticsOrderHref(order.id)}
          className="focus-ring flex items-center gap-1.5 rounded-control font-medium text-brand-strong hover:underline"
        >
          {label}
        </Link>
      ) : (
        <span className="flex items-center gap-1.5 font-medium text-ink">
          {label}
        </span>
      )}
      <LogisticsStatusBadge status={order.status} />
      <span className="text-ink-muted">
        {order.deliveryDate ? (
          <>
            Delivery Date:{" "}
            <span className="font-medium text-ink">
              {formatDateOnly(order.deliveryDate)}
            </span>
          </>
        ) : (
          DELIVERY_BUCKET_LABEL.none
        )}
      </span>
    </div>
  );
}
