"use client";

import {
  IconArrowsExchange,
  IconBrandWhatsapp,
  IconEdit,
  IconMail,
  IconTrash,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { formatDateTime, initialsOf } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import type { LeadListItem } from "@/services/leads-service";

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
    <Card as="section" aria-label="Basic Info" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Basic Info</h2>
        <div className="flex items-center gap-1.5">
          <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
            <IconButton
              size="xl"
              variant="outline"
              aria-label="WhatsApp"
              disabled={!waUrl}
              onClick={actions.onWhatsapp}
            >
              <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Email">
            <IconButton
              size="xl"
              variant="outline"
              aria-label="Email"
              onClick={actions.onEmail}
            >
              <IconMail size={18} stroke={1.75} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Convert isn’t available yet">
            <IconButton
              size="xl"
              variant="outline"
              aria-label="Convert"
              disabled
            >
              <IconArrowsExchange size={18} stroke={1.75} aria-hidden="true" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Delete">
            <IconButton
              size="xl"
              variant="outline"
              aria-label="Delete"
              onClick={actions.onDelete}
              tone="danger"
            >
              <IconTrash size={18} stroke={1.75} aria-hidden="true" />
            </IconButton>
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
            <IconButton
              size="xl"
              variant="outline"
              aria-label="Edit Lead"
              onClick={actions.onEdit}
            >
              <IconEdit size={16} stroke={1.75} aria-hidden="true" />
            </IconButton>
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
    </Card>
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
