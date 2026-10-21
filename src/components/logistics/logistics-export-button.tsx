"use client";

import { useState } from "react";
import { IconFileExport, IconLoader2 } from "@tabler/icons-react";
import { useAuth } from "@/components/auth/auth-context";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/constants/permissions";
import { apiReason } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import type { LogisticsFilters } from "@/lib/logistics-orders";
import { downloadLogisticsExport } from "@/services/logistics-service";

type LogisticsExportButtonProps = {
  /** The screen's filters and settled search: the file narrows to the same orders. */
  filters: LogisticsFilters;
  /** How many QC-verified orders those filters reach, once the counts have loaded. */
  qcVerified: number | undefined;
};

/**
 * The Logistics toolbar's export for the delivery partner (3PL-01): the QC-verified orders under
 * the screen's filters, as a CSV. Shown only to the roles that dispatch (the server refuses anyone
 * else); inert while a download runs, and when the counts say no QC-verified order matches, so a
 * click never saves a file with a header and nothing else.
 */
export function LogisticsExportButton({
  filters,
  qcVerified,
}: LogisticsExportButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!can(user?.role, "exportLogistics")) return null;

  const none = qcVerified === 0;
  const run = async () => {
    setBusy(true);
    try {
      await downloadLogisticsExport(filters);
    } catch (error) {
      toast({
        title: "Couldn’t export orders",
        description: apiReason(error),
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || none}
      aria-busy={busy}
      title={
        none
          ? "No QC Verified orders match these filters"
          : "Download the QC Verified orders matching these filters as a CSV for the delivery partner"
      }
      className={cn(
        TOOLBAR_BUTTON_CLASS,
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
    >
      {busy ? (
        <IconLoader2
          size={16}
          stroke={1.75}
          className="animate-spin"
          aria-hidden="true"
        />
      ) : (
        <IconFileExport size={16} stroke={1.75} aria-hidden="true" />
      )}
      {busy ? "Exporting…" : "Export for 3PL"}
    </button>
  );
}
