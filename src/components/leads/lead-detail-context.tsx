"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LeadListItem } from "@/services/leads-service";

/**
 * Lets the Leads table's Customer-Name cell open the Lead Detail drawer in place
 * (decision: drawer on the Leads list). Where this context is absent — the
 * Activities list — the name cell falls back to navigating to the Lead Detail
 * page (ACT-09.1), so that behaviour is unchanged.
 */
type LeadDetailContextValue = { onOpen: (lead: LeadListItem) => void };

const LeadDetailContext = createContext<LeadDetailContextValue | null>(null);

export function LeadDetailProvider({
  value,
  children,
}: {
  value: LeadDetailContextValue;
  children: ReactNode;
}) {
  return <LeadDetailContext value={value}>{children}</LeadDetailContext>;
}

export function useLeadDetail(): LeadDetailContextValue | null {
  return useContext(LeadDetailContext);
}
