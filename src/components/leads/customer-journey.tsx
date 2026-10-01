"use client";

import { Fragment, useEffect, useState } from "react";
import { IconArrowRight, IconHistory, IconLoader2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tag } from "@/components/ui/Tag";
import { LEAD_DETAIL_FIELDS } from "@/components/leads/lead-detail-fields";
import { dayLabel } from "@/components/leads/lead-timeline";
import {
  JOURNEY_PAGE_SIZE,
  appendPage,
  describeAuditEvent,
  groupByDay,
  type AuditEvent,
  type JourneyLabels,
} from "@/lib/audit-journey";
import { formatTime } from "@/lib/format";
import { fetchLeadAuditEvents } from "@/services/audit-service";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { Tone } from "@/types";

/**
 * The labels the Lead Detail panel already shows, so a field reads the same here as on the
 * page. `assigneeIds` is the log's name for the panel's Assigned row.
 */
const FIELD_LABELS: ReadonlyMap<string, string> = new Map([
  ...LEAD_DETAIL_FIELDS.map((field): [string, string] => [
    field.key,
    field.label,
  ]),
  ["assigneeIds", "Assigned"],
]);

/** The two record kinds that exist today get a tint; anything a later phase adds is neutral. */
const ENTITY_TONE: Partial<Record<string, Tone>> = {
  LEAD: "brand",
  LOGISTICS_ORDER: "info",
};

type Loaded = {
  key: string;
  events: AuditEvent[];
  total: number;
  page: number;
};

/**
 * A lead's customer journey (ADR-0083): every recorded change to the lead, to its Logistics
 * order and — once those phases exist — to its Accounts records, oldest first, grouped by day
 * on the same rail as the Timeline tab.
 *
 * Read-only by design: it renders exactly what `GET /audit/events` returns and holds no action.
 * The API decides what the caller may see (a Logistics user receives only its order's events),
 * so there is no second permission check here to drift from it.
 */
export function CustomerJourney({ leadId }: { leadId: string }) {
  // Tagged with the key it answers, as the Lead Detail page does: nothing is set synchronously
  // in an effect, and a slow earlier read can never repaint a newer one.
  const [refresh, setRefresh] = useState(0);
  const key = `${leadId}:${refresh}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [more, setMore] = useState<"idle" | "loading" | "failed">("idle");
  const [users, setUsers] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLeadAuditEvents(leadId, 1, JOURNEY_PAGE_SIZE, controller.signal)
      .then((page) => {
        if (!active) return;
        setLoaded({ key, events: [...page.rows], total: page.total, page: 1 });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailedKey(key);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [leadId, key]);

  // Names are a nicety, not a dependency: the lookup covers the sales roles only, and without it
  // every entry still renders — an unnamed actor shows none, its id kept in the entry's details.
  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then((agents) =>
        setUsers(new Map(agents.map((agent) => [agent.id, agent.name]))),
      )
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const current = loaded?.key === key ? loaded : null;

  const loadMore = () => {
    if (!current || more === "loading") return;
    const next = current.page + 1;
    setMore("loading");
    fetchLeadAuditEvents(leadId, next, JOURNEY_PAGE_SIZE)
      .then((page) => {
        setLoaded((prev) =>
          prev?.key === key
            ? {
                key,
                events: appendPage(prev.events, page.rows),
                total: page.total,
                page: next,
              }
            : prev,
        );
        setMore("idle");
      })
      .catch(() => setMore("failed"));
  };

  if (failedKey === key) {
    return (
      <ErrorState
        title="Couldn’t load the journey"
        description="Something went wrong. Check your connection and try again."
        onRetry={() => {
          setFailedKey(null);
          setMore("idle");
          setRefresh((token) => token + 1);
        }}
      />
    );
  }

  if (!current) {
    return (
      <div className="flex items-center justify-center py-10 text-ink-muted">
        <IconLoader2 size={20} className="animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (current.events.length === 0) {
    return (
      <EmptyState
        icon={IconHistory}
        title="Nothing yet"
        description="No changes have been recorded for this lead so far."
      />
    );
  }

  const labels: JourneyLabels = { fields: FIELD_LABELS, users };
  const today = new Date();

  return (
    <div className="flex flex-col gap-5">
      <ol
        aria-label="Customer journey"
        className="relative flex flex-col gap-6 border-l-2 border-brand/70 pl-6"
      >
        {groupByDay(current.events).map((group) => {
          const at = new Date(group.at);
          return (
            <li key={group.key} className="relative">
              {/* Centred on the 2px rail, level with the day line — as on the Timeline tab. */}
              <span
                className="absolute top-[5px] -left-8 size-3.5 rounded-full bg-brand ring-4 ring-brand/30"
                aria-hidden="true"
              />
              <p className="text-base font-semibold text-ink">
                {Number.isNaN(at.getTime()) ? group.at : dayLabel(at, today)}
              </p>
              <ol className="mt-3 flex flex-col gap-4">
                {group.events.map((event) => (
                  <JourneyItem key={event.id} event={event} labels={labels} />
                ))}
              </ol>
            </li>
          );
        })}
      </ol>

      {current.events.length < current.total && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-ink-muted">
            Showing {current.events.length} of {current.total}
          </p>
          {more === "failed" && (
            <p role="alert" className="text-sm text-ink-muted">
              Couldn’t load more events.
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            isLoading={more === "loading"}
            onClick={loadMore}
          >
            {more === "failed" ? "Try again" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * One event: what happened to which record, when and by whom, then the fields it changed and
 * any detail it carries. The raw record sits behind Details, so nothing the log holds is lost to
 * the readable summary above it.
 */
function JourneyItem({
  event,
  labels,
}: {
  event: AuditEvent;
  labels: JourneyLabels;
}) {
  const entry = describeAuditEvent(event, labels);

  return (
    <li className="border-b border-hairline pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone={ENTITY_TONE[event.entityType] ?? "neutral"}>
          {entry.entity}
        </Tag>
        <span className="text-sm font-semibold text-ink">{entry.title}</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {formatTime(event.createdAt)}
        {entry.actor && (
          <>
            {" · by "}
            <span className="font-medium text-ink">{entry.actor}</span>
          </>
        )}
        {event.source && ` · ${event.source}`}
      </p>

      {/* One grid for the changes and the notes, so every value starts on the same line. */}
      {(entry.rows.length > 0 || entry.notes.length > 0) && (
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
          {entry.rows.map((row, index) => (
            <Fragment key={`row-${index}`}>
              <dt className="text-ink-muted">{row.label}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-x-1.5 break-words text-ink">
                {row.before !== undefined && row.after !== undefined ? (
                  <>
                    <span className="text-ink-muted">{row.before}</span>
                    <IconArrowRight
                      size={14}
                      stroke={1.75}
                      className="shrink-0 text-ink-subtle"
                      aria-hidden="true"
                    />
                    <span className="sr-only">changed to</span>
                    <span>{row.after}</span>
                  </>
                ) : (
                  (row.after ?? row.before)
                )}
              </dd>
            </Fragment>
          ))}
          {entry.notes.map((note, index) => (
            <Fragment key={`note-${index}`}>
              <dt className="text-ink-muted">{note.label}</dt>
              <dd className="break-words whitespace-pre-wrap text-ink">
                {note.value}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}

      <div className="mt-1">
        <CollapsibleSection title="Details" defaultOpen={false}>
          <pre className="max-h-60 overflow-auto rounded-control bg-canvas p-2 text-xs break-words whitespace-pre-wrap text-ink">
            {JSON.stringify(
              {
                entityId: event.entityId,
                actorId: event.actorId,
                before: event.before,
                after: event.after,
                metadata: event.metadata,
              },
              null,
              2,
            )}
          </pre>
        </CollapsibleSection>
      </div>
    </li>
  );
}
