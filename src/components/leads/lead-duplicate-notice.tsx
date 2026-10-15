"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Tooltip } from "@/components/ui/Tooltip";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  fetchLeadDuplicates,
  type LeadDuplicateLinks,
  type LeadListItem,
  type RelatedLead,
} from "@/services/leads-service";

/**
 * The small "Duplicate" tag beside a customer name (ADR-0092). The amber pair is the one the
 * import preview already uses for a duplicate row, so the two read as the same idea.
 * Renders nothing for a lead that was not received as a duplicate.
 */
export function LeadDuplicateBadge({
  lead,
  className,
}: {
  lead: Pick<LeadListItem, "isDuplicate">;
  className?: string;
}) {
  if (!lead.isDuplicate) return null;
  return (
    <Tooltip content="Received as a duplicate of an earlier lead">
      <span
        className={cn(
          "inline-flex h-4.5 shrink-0 items-center rounded-md bg-amber-100 px-1.5 text-xs font-medium text-amber-800",
          className,
        )}
      >
        Duplicate
      </span>
    </Tooltip>
  );
}

/** One related lead: a link to its page, its status, and enough to tell it from the others. */
function RelatedLeadRow({ lead }: { lead: RelatedLead }) {
  const { colorsFor } = useStages();
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Link
        href={`/leads/${lead.id}`}
        className="focus-ring rounded-sm font-medium text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-brand-strong"
      >
        {lead.name}
      </Link>
      <span
        className={cn(
          "inline-flex h-4.5 items-center rounded-md px-2 text-xs font-medium",
          colorsFor(lead.status).badge,
        )}
      >
        {lead.status}
      </span>
      <span className="text-ink-muted">
        {lead.primaryPhone} · {formatDateTime(lead.createdAt)}
      </span>
    </li>
  );
}

/**
 * A lead's place in its duplicate group (ADR-0092): the earlier lead it was received as a
 * duplicate of, and the leads that were received as duplicates of it, each linking to its page.
 *
 * What it shows is whatever the server returns for this caller — a related lead outside their
 * access (or archived) is never named, only acknowledged, so a restricted lead's name, phone
 * and status cannot reach the screen. Renders nothing for a lead with no duplicate relationship,
 * and nothing while loading or if the read fails: it is information on top of the lead, never
 * something the page waits for.
 */
export function LeadDuplicateNotice({
  lead,
  className,
}: {
  lead: LeadListItem;
  className?: string;
}) {
  // Tagged with the lead it answers, so a slow read for the previous lead never paints on the next.
  const key = `${lead.id}:${lead.isDuplicate}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    links: LeadDuplicateLinks;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadDuplicates(lead.id, controller.signal)
      .then((links) => setLoaded({ key, links }))
      .catch(() => {
        /* informational only: the lead is fully usable without it */
      });
    return () => controller.abort();
  }, [key, lead.id]);

  const links = loaded?.key === key ? loaded.links : null;
  if (!links) return null;

  const { original, duplicates, hasHidden } = links;
  const isDuplicate = lead.isDuplicate;
  if (!isDuplicate && duplicates.length === 0 && !hasHidden) return null;

  return (
    <Alert
      tone={isDuplicate ? "warning" : "info"}
      title={isDuplicate ? "Duplicate lead" : "Has duplicates"}
      className={className}
      aria-label="Related leads"
    >
      <div className="flex flex-col gap-3">
        {isDuplicate && (
          <div>
            <p>Received as a duplicate of an earlier lead:</p>
            {original ? (
              <ul className="mt-1.5 flex flex-col gap-1.5">
                <RelatedLeadRow lead={original} />
              </ul>
            ) : (
              <p className="mt-1 text-ink-subtle">
                That lead is archived or outside your access.
              </p>
            )}
          </div>
        )}

        {duplicates.length > 0 && (
          <div>
            <p>
              {duplicates.length === 1
                ? "1 later lead was received as a duplicate of this one:"
                : `${duplicates.length} later leads were received as duplicates of this one:`}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {duplicates.map((related) => (
                <RelatedLeadRow key={related.id} lead={related} />
              ))}
            </ul>
          </div>
        )}

        {hasHidden && (
          <p className="text-ink-subtle">
            Other related leads are archived or outside your access.
          </p>
        )}
      </div>
    </Alert>
  );
}
