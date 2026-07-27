"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconLoader2, IconUserOff } from "@tabler/icons-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { ApiError } from "@/lib/api-client";
import { fetchLead, type LeadListItem } from "@/services/leads-service";

/** Initials for the avatar placeholder; duplicated from the Leads columns (FND-04.1 folds these). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Workpex shows "Created 03-05-2026, 11:51 PM"; keep the same client-only format. */
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

/**
 * The Lead Detail page (Lead-Detail-Blueprint §4a) — minimum shell: a back header
 * and the Basic Info card. Fetches one scoped lead; a 404 (out of scope, missing
 * or deleted) renders the graceful not-found state (ACT-09.1 AC5), any other
 * failure the error state. The Details column and the Basic Info actions
 * (WhatsApp / Email / Convert / Edit) are later, phased work and absent here.
 */
export function LeadDetailView({ id }: { id: string }) {
  const router = useRouter();
  // Results are tagged with the id they answer and only count when that tag is
  // the current id (the `useActivitiesList` rule) — so no state is set
  // synchronously in the effect, and a slow earlier lead can't repaint a newer.
  const [loaded, setLoaded] = useState<{ id: string; lead: LeadListItem } | null>(
    null,
  );
  const [failed, setFailed] = useState<{
    id: string;
    kind: "not-found" | "error";
  } | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLead(id, controller.signal)
      .then((lead) => {
        if (active) setLoaded({ id, lead });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        const kind =
          error instanceof ApiError && error.status === 404
            ? "not-found"
            : "error";
        setFailed({ id, kind });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, reloadToken]);

  const lead = loaded?.id === id ? loaded.lead : null;
  const failure = failed?.id === id ? failed.kind : null;
  const isLoading = !lead && !failure;

  const back = (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Back"
      className="focus-ring flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink"
    >
      <IconArrowLeft size={20} stroke={1.75} aria-hidden="true" />
    </button>
  );

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center gap-2">{back}</div>
        <div className="flex min-h-40 items-center justify-center text-ink-muted">
          <IconLoader2 size={22} className="animate-spin" aria-label="Loading" />
        </div>
      </PageContainer>
    );
  }

  if (failure === "not-found") {
    return (
      <PageContainer>
        <div className="flex items-center gap-2">{back}</div>
        <EmptyState
          icon={IconUserOff}
          title="Lead not found"
          description="This lead doesn't exist, has been deleted, or isn't in your access."
        />
      </PageContainer>
    );
  }

  if (failure === "error" || !lead) {
    return (
      <PageContainer>
        <div className="flex items-center gap-2">{back}</div>
        <ErrorState
          title="Couldn’t load lead"
          description="Something went wrong while loading this lead. Check your connection and try again."
          onRetry={() => {
            setFailed(null);
            setReloadToken((token) => token + 1);
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center gap-2">
        {back}
        <h1 className="truncate text-lg font-semibold text-ink">{lead.name}</h1>
      </div>

      <section
        aria-label="Basic Info"
        className="max-w-md rounded-surface border border-hairline bg-surface p-5"
      >
        <h2 className="mb-4 text-sm font-semibold text-ink">Basic Info</h2>

        <div className="flex items-center gap-3">
          <Avatar name={lead.name} initials={initialsOf(lead.name)} size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate font-medium text-ink">{lead.name}</span>
            <div className="flex items-center gap-2">
              <LeadStatusBadge lead={lead} />
              <span className="text-xs text-ink-muted">{lead.pipeline}</span>
            </div>
          </div>
        </div>

        <dl className="mt-5 flex flex-col gap-4 border-t border-hairline pt-5">
          <Field label="Lead Name" value={lead.name} />
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
        </dl>

        <p className="mt-5 border-t border-hairline pt-4 text-xs text-ink-muted">
          Created {formatDateTime(lead.createdAt)}
        </p>
      </section>
    </PageContainer>
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
