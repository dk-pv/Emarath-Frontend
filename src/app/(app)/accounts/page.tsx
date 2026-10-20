import { Suspense } from "react";
import { AccountsView } from "@/components/accounts/accounts-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/accounts");

/**
 * The Accounts screen (ADR-0096). Its tabs, filters and open record live in the URL, so it reads
 * them under Suspense.
 */
export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsView />
    </Suspense>
  );
}
