"use client";

import {
  IconArrowsExchange,
  IconBrandWhatsapp,
  IconEdit,
  IconMail,
  IconTrash,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Chip } from "@/components/ui/Chip";
import { Tooltip } from "@/components/ui/Tooltip";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { cn } from "@/lib/cn";
import { whatsappUrl } from "@/lib/whatsapp";
import type { LeadListItem } from "@/services/leads-service";

/** Initials for the avatar placeholder; duplicated pending FND-04.1's shared utils. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Workpex shows "Created 19-08-2026, 02:15 PM"; keep the same client-only format. */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dd}-${mm}-${yyyy}, ${time}`;
}

/** The bordered square icon buttons in the Basic Info action row (Workpex's header). */
const ACTION_CLASS =
  "flex size-9 items-center justify-center rounded-control border border-hairline text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-ink-muted";

export type LeadBasicInfoActions = {
  onWhatsapp: () => void;
  onEmail: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * The Lead Detail page's left Basic Info panel (traced from the supplied Workpex
 * screenshots). Every value is the real scoped lead — avatar, name, status badge,
 * pipeline, phone, source, assignees, tags and created date.
 *
 * Reuses the list's existing flows for the actions with a real implementation —
 * WhatsApp, Email, Edit (the shared New Lead form in edit mode), Delete. "Convert"
 * is shown to match Workpex but disabled with a tooltip: no lead-conversion flow
 * exists in the backlog yet, so it is not fabricated. The Lead Pipeline selector,
 * "More Info" expander, "Last Updated" and the tag "+" add are Workpex controls with
 * no backing flow/field today, so they are read-only / omitted here (see ADR-0037).
 */
export function LeadDetailBasicInfo({
  lead,
  actions,
}: {
  lead: LeadListItem;
  actions: LeadBasicInfoActions;
}) {
  const waUrl = whatsappUrl(lead.primaryPhone);

  return (
    <section
      aria-label="Basic Info"
      className="rounded-surface border border-hairline bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Basic Info</h2>
        <div className="flex items-center gap-1.5">
          <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
            <button
              type="button"
              aria-label="WhatsApp"
              disabled={!waUrl}
              onClick={actions.onWhatsapp}
              className={ACTION_CLASS}
            >
              <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Email">
            <button
              type="button"
              aria-label="Email"
              onClick={actions.onEmail}
              className={ACTION_CLASS}
            >
              <IconMail size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Convert isn’t available yet">
            <button
              type="button"
              aria-label="Convert"
              disabled
              className={ACTION_CLASS}
            >
              <IconArrowsExchange size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              type="button"
              aria-label="Delete"
              onClick={actions.onDelete}
              className={cn(ACTION_CLASS, "hover:text-danger")}
            >
              <IconTrash size={18} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Avatar name={lead.name} initials={initialsOf(lead.name)} size="lg" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="truncate font-medium text-ink">{lead.name}</span>
          <div className="flex items-center gap-2">
            <LeadStatusBadge lead={lead} />
            <span className="text-xs text-ink-muted">{lead.pipeline}</span>
          </div>
        </div>
      </div>

      <dl className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <dt className="text-xs text-ink-muted">Lead Name</dt>
            <dd className="mt-1 truncate text-sm text-ink">{lead.name}</dd>
          </div>
          <Tooltip content="Edit Lead">
            <button
              type="button"
              aria-label="Edit Lead"
              onClick={actions.onEdit}
              className={ACTION_CLASS}
            >
              <IconEdit size={16} stroke={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>

        <Field label="Primary Phone" value={lead.primaryPhone} />
        <Field label="Source" value={lead.source} />

        <div>
          <dt className="text-xs text-ink-muted">Assigned Users</dt>
          <dd className="mt-1">
            {lead.assignedAgents.length === 0 ? (
              <span className="text-sm text-ink-subtle">Unassigned</span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {lead.assignedAgents.map((agent) => (
                  <span key={agent.id} className="flex items-center gap-1.5">
                    <Avatar
                      name={agent.name}
                      initials={initialsOf(agent.name)}
                      size="sm"
                    />
                    <span className="text-sm text-ink">{agent.name}</span>
                  </span>
                ))}
              </span>
            )}
          </dd>
        </div>

        {lead.tags.length > 0 && (
          <div>
            <dt className="text-xs text-ink-muted">Tags</dt>
            <dd className="mt-1.5 flex flex-wrap gap-1.5">
              {lead.tags.map((tag) => (
                <Chip key={tag.id} tone="brand">
                  {tag.name}
                </Chip>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-5 border-t border-hairline pt-4 text-xs text-ink-muted">
        Created {formatDateTime(lead.createdAt)}
      </p>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm text-ink">
        {value ? value : <span className="text-ink-subtle">—</span>}
      </dd>
    </div>
  );
}
