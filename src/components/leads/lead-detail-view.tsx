"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowLeft, IconLoader2, IconUserOff } from "@tabler/icons-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
import { LeadDetailBasicInfo } from "@/components/leads/lead-detail-basic-info";
import { LeadDetailFollowUps } from "@/components/leads/lead-detail-followups";
import {
  LeadDetailAddButton,
  LeadDetailSection,
  type LeadDetailRow,
} from "@/components/leads/lead-detail-section";
import { LeadAddFileDrawer } from "@/components/leads/lead-add-file-drawer";
import { LeadEmailDrawer } from "@/components/leads/lead-email-drawer";
import { LeadFollowUpFormDrawer } from "@/components/leads/lead-followup-form-drawer";
import { LeadManageColumnsDrawer } from "@/components/leads/lead-manage-columns-drawer";
import { LeadTimelineDrawer } from "@/components/leads/lead-timeline-drawer";
import {
  DEFAULT_HIDDEN_FIELD_KEYS,
  LEAD_DETAIL_FIELDS,
  LEAD_DETAIL_FIELDS_VIEW_KEY,
  LOCKED_FIELD_KEYS,
  customFieldEntries,
  type LeadDetailField,
} from "@/components/leads/lead-detail-fields";
import { fetchLeadCustomFields } from "@/services/leads-custom-fields-service";
import {
  fetchColumnLayout,
  reconcileLayout,
  saveColumnLayout,
  type ColumnLayout,
} from "@/services/view-preferences-service";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadNoteDrawer } from "@/components/leads/lead-note-drawer";
import { LeadWhatsappDrawer } from "@/components/leads/lead-whatsapp-drawer";
import { CONVERTED_STATUS } from "@/components/leads/lead-row-actions";
import { ApiError } from "@/lib/api-client";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  fetchLead,
  fetchLeadActivities,
  fetchLeadForEdit,
  fetchLeadTimeline,
  type LeadActivity,
  type LeadEditData,
  type LeadListItem,
  type LeadTimelineEvent,
} from "@/services/leads-service";
import {
  changeLeadPipeline,
  deleteLead,
  setLeadStatus,
} from "@/services/leads-row-actions-service";
import { addLeadTag, removeLeadTag } from "@/services/leads-tags-service";
import { formatDateTime, initialsOf } from "@/lib/format";

/** Workpex's shared empty copy, identical under every Details section. */
const EMPTY = "Records will appear here once they are added.";

const ATTACHMENT_COLUMNS = [
  { key: "name", header: "File Name" },
  { key: "size", header: "Size" },
  { key: "createdBy", header: "Created By" },
  { key: "actions", header: "Actions" },
];
const NOTE_COLUMNS = [
  { key: "content", header: "Content" },
  { key: "updatedBy", header: "Updated By" },
  { key: "createdBy", header: "Created By" },
  { key: "actions", header: "Actions" },
];
const EMAIL_COLUMNS = [
  { key: "sentAt", header: "Sent Date & Time" },
  { key: "subject", header: "Email Subject" },
  { key: "sentBy", header: "Sent By" },
  { key: "status", header: "Status" },
  { key: "content", header: "Content" },
];
const WHATSAPP_COLUMNS = [
  { key: "sentAt", header: "Sent Date & Time" },
  { key: "content", header: "Content" },
  { key: "sentBy", header: "Sent By" },
  { key: "source", header: "Sent Source" },
  { key: "status", header: "Status" },
];
const CALL_COLUMNS = [
  { key: "startedAt", header: "Call Date & Time" },
  { key: "type", header: "Call Type" },
  { key: "status", header: "Call Status" },
  { key: "assignedTo", header: "Assigned To" },
  { key: "note", header: "Note" },
  { key: "media", header: "Media" },
  { key: "actions", header: "Actions" },
];

/**
 * The Lead Detail page (`/leads/{id}`) — the full-page destination reached from the
 * Leads list Customer-Name hover arrow and the Activities Customer-Name link. Traced
 * from the four supplied Workpex screenshots and built from real data only (approved
 * scope): the left Basic Info panel and the Notes list use the scoped lead and its
 * timeline; every other Details section (File Attachments, Follow-up/History, Email /
 * WhatsApp / Call logs) rests on the honest Workpex empty state because no per-lead
 * backend feed exists for it yet — none are fabricated (see ADR-0037).
 *
 * Reuses the list's existing flows for the header actions — WhatsApp, Email, Edit
 * (the shared New Lead form in edit mode), Delete, Add Note — with no duplicate
 * implementations. Notes come from the same `GET /leads/:id/timeline` the drawer uses.
 */
/**
 * Report origins (`/leads/{id}?from=…`) whose reference hides the Tags section, and those
 * whose reference shows the "+" tag picker under Forecasted Amount. Every other entry point
 * keeps the panel exactly as it was.
 */
const HIDE_TAGS_ORIGINS = new Set(["today-leads", "leads-by-source"]);
const TAG_PICKER_ORIGINS = new Set([
  "today-leads",
  "leads-by-status",
  "leads-by-source",
  "converted-leads",
  "lost-leads",
  "lead-aging",
  "lead-first-response",
  "overdue-follow-ups",
  "todays-follow-ups",
  "upcoming-follow-ups",
]);

export function LeadDetailView({
  id,
  from = null,
}: {
  id: string;
  /** Which list opened this lead; Today Leads asks for the Tags section to be omitted. */
  from?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();

  // The lead and the timeline are each tagged with the key they answer and only
  // count when that key is current — no state is set synchronously in an effect, and
  // a slow earlier fetch can never repaint a newer one (the LeadDetailDrawer pattern).
  const [reloadToken, setReloadToken] = useState(0);
  const [loaded, setLoaded] = useState<{
    id: string;
    lead: LeadListItem;
  } | null>(null);
  const [failed, setFailed] = useState<{
    id: string;
    kind: "not-found" | "error";
  } | null>(null);

  const [followUpsRefresh, setFollowUpsRefresh] = useState(0);
  const followUpsKey = `${id}:${followUpsRefresh}`;
  const [followUpsLoaded, setFollowUpsLoaded] = useState<{
    key: string;
    activities: LeadActivity[];
  } | null>(null);
  const [followUpsFailedKey, setFollowUpsFailedKey] = useState<string | null>(
    null,
  );
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [addFileOpen, setAddFileOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [customFields, setCustomFields] = useState<
    { key: string; name: string }[]
  >([]);
  const [fieldLayout, setFieldLayout] = useState<ColumnLayout | null>(null);

  const [notesRefresh, setNotesRefresh] = useState(0);
  const notesKey = `${id}:${notesRefresh}`;
  const [notesLoaded, setNotesLoaded] = useState<{
    key: string;
    events: LeadTimelineEvent[];
  } | null>(null);
  const [notesFailedKey, setNotesFailedKey] = useState<string | null>(null);

  // Action targets — the same drawers the list mounts, reused here per-open.
  const [waOpen, setWaOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [editData, setEditData] = useState<LeadEditData | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLead(id, controller.signal)
      .then((lead) => {
        if (active) setLoaded({ id, lead });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
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

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLeadTimeline(id, controller.signal)
      .then((events) => {
        if (active) setNotesLoaded({ key: notesKey, events });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setNotesFailedKey(notesKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, notesKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLeadActivities(id, controller.signal)
      .then((activities) => {
        if (active) setFollowUpsLoaded({ key: followUpsKey, activities });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFollowUpsFailedKey(followUpsKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, followUpsKey]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      fetchLeadCustomFields(controller.signal).catch(() => []),
      fetchColumnLayout(LEAD_DETAIL_FIELDS_VIEW_KEY, controller.signal).catch(
        () => null,
      ),
    ]).then(([fields, saved]) => {
      if (!active) return;
      setCustomFields(fields.map((f) => ({ key: f.key, name: f.name })));
      const keys = [
        ...LEAD_DETAIL_FIELDS.map((f) => f.key),
        ...fields.map((f) => f.key),
      ];
      // No saved layout yet → the panel's documented default set, not "everything".
      setFieldLayout(
        saved
          ? reconcileLayout(saved, keys)
          : {
              order: keys,
              hidden: [
                ...DEFAULT_HIDDEN_FIELD_KEYS,
                ...fields.map((f) => f.key),
              ],
            },
      );
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  /** Every selectable field: the standard set plus this org's custom columns. */
  const allFields: LeadDetailField[] = useMemo(
    () => [...LEAD_DETAIL_FIELDS, ...customFieldEntries(customFields)],
    [customFields],
  );

  /** What Basic Info renders: the saved order, minus the hidden ones. */
  const visibleFields = useMemo(() => {
    if (!fieldLayout) {
      const hidden = new Set<string>(DEFAULT_HIDDEN_FIELD_KEYS);
      return allFields.filter((field) => !hidden.has(field.key));
    }
    const hidden = new Set(fieldLayout.hidden);
    const byKey = new Map(allFields.map((field) => [field.key, field]));
    return fieldLayout.order
      .filter((key) => !hidden.has(key))
      .map((key) => byKey.get(key))
      .filter((field): field is LeadDetailField => field !== undefined);
  }, [fieldLayout, allFields]);

  const lead = loaded?.id === id ? loaded.lead : null;
  const failure = failed?.id === id ? failed.kind : null;
  const isLoading = !lead && !failure;

  const followUps =
    followUpsLoaded?.key === followUpsKey ? followUpsLoaded.activities : null;
  const followUpsErrored = followUpsFailedKey === followUpsKey;

  const notesEvents = notesLoaded?.key === notesKey ? notesLoaded.events : null;
  const notesErrored = notesFailedKey === notesKey;
  const notes =
    notesEvents?.filter(
      (event): event is Extract<LeadTimelineEvent, { type: "note" }> =>
        event.type === "note",
    ) ?? [];

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
          <IconLoader2
            size={22}
            className="animate-spin"
            aria-label="Loading"
          />
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

  const noteRows: LeadDetailRow[] = notes.map((note) => ({
    id: note.id,
    cells: [
      <span key="c" className="break-words whitespace-pre-wrap">
        {note.body}
      </span>,
      <span key="u" className="text-ink-subtle">
        —
      </span>,
      <span key="b" className="flex items-center gap-2">
        <Avatar
          name={note.authorName}
          initials={initialsOf(note.authorName)}
          size="sm"
        />
        <span className="flex flex-col">
          <span className="text-ink">{note.authorName}</span>
          <span className="text-xs text-ink-muted">
            {formatDateTime(note.at)}
          </span>
        </span>
      </span>,
      <span key="a" className="text-ink-subtle">
        —
      </span>,
    ],
  }));

  const openEdit = async () => {
    setEditPending(true);
    try {
      const data = await fetchLeadForEdit(lead.id);
      setEditData(data);
    } catch (error) {
      const gone = error instanceof ApiError && error.status === 404;
      toast({
        title: gone ? "This lead no longer exists" : "Couldn’t open the lead",
        tone: "danger",
      });
    } finally {
      setEditPending(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteOpen(false);
    setDeleting(true);
    try {
      await deleteLead(lead.id);
      toast({ title: `${lead.name} deleted`, tone: "success" });
      router.push("/leads");
    } catch {
      setDeleting(false);
      toast({ title: "Couldn’t delete lead", tone: "danger" });
    }
  };

  /** Convert = set the lead's status to WON (ADR-0048), the Leads list' own flow. */
  const confirmConvert = async () => {
    setConvertOpen(false);
    setConverting(true);
    try {
      const updated = await setLeadStatus(lead.id, CONVERTED_STATUS);
      setLoaded({ id, lead: { ...updated, isPinned: lead.isPinned } });
      toast({ title: `${lead.name} converted`, tone: "success" });
    } catch (error) {
      toast({
        title: "Couldn’t convert lead",
        description: error instanceof ApiError ? error.message : undefined,
        tone: "danger",
      });
    } finally {
      setConverting(false);
    }
  };

  /** Moving board lands the lead on the target pipeline's first stage (server rule). */
  const selectPipeline = async (pipeline: string) => {
    try {
      const updated = await changeLeadPipeline(lead.id, pipeline);
      setLoaded({ id, lead: { ...updated, isPinned: lead.isPinned } });
      toast({ title: `Moved to ${pipeline}`, tone: "success" });
    } catch (error) {
      toast({
        title: "Couldn’t change pipeline",
        description: error instanceof ApiError ? error.message : undefined,
        tone: "danger",
      });
    }
  };

  /**
   * Attaching a file to a lead needs a per-lead attachment endpoint, which the backend
   * does not have yet: `Lead` has no document relation and there is no
   * `POST /leads/:id/documents`. Rather than upload into the global Documents module —
   * where the file would not appear in this lead's File Attachments — the drawer reports
   * the gap and keeps what the user entered.
   */
  const attachFile = () => {
    throw new Error(
      "Lead file attachments need a backend endpoint that doesn’t exist yet.",
    );
  };

  /** Applies one catalogue tag to the lead (LEAD-12.1), refreshing the panel in place. */
  const addTag = async (tagId: string) => {
    setAddingTag(true);
    try {
      const updated = await addLeadTag(lead.id, tagId);
      setLoaded({ id, lead: { ...updated, isPinned: lead.isPinned } });
      toast({ title: "Tag added", tone: "success" });
    } catch (error) {
      toast({
        title: "Couldn’t add the tag",
        description: error instanceof ApiError ? error.message : undefined,
        tone: "danger",
      });
    } finally {
      setAddingTag(false);
    }
  };

  /** Removes one applied tag (LEAD-12.1), refreshing the panel in place. */
  const removeTag = async (tagId: string) => {
    setAddingTag(true);
    try {
      const updated = await removeLeadTag(lead.id, tagId);
      setLoaded({ id, lead: { ...updated, isPinned: lead.isPinned } });
      toast({ title: "Tag removed", tone: "success" });
    } catch (error) {
      toast({
        title: "Couldn’t remove the tag",
        description: error instanceof ApiError ? error.message : undefined,
        tone: "danger",
      });
    } finally {
      setAddingTag(false);
    }
  };

  const sendWhatsapp = ({
    phone,
    message,
  }: {
    phone: string;
    message: string;
  }) => {
    const base = whatsappUrl(phone);
    if (base) {
      window.open(
        `${base}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setWaOpen(false);
  };

  return (
    // At lg+ the page is exactly the content area's height, so `main` never scrolls and
    // Basic Info stays put — only the Details region below scrolls. Below lg the columns
    // stack and the page scrolls normally, unchanged.
    <PageContainer className="lg:h-full lg:min-h-0">
      <div className="flex shrink-0 items-center gap-2">
        {back}
        <h1 className="truncate text-lg font-semibold text-ink">{lead.name}</h1>
        {editPending && (
          <IconLoader2
            size={18}
            className="animate-spin text-ink-muted"
            aria-label="Opening editor"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <LeadDetailBasicInfo
          // Stretches to the row as before; scrolls inside itself only when the panel is
          // taller than the viewport, so its footer is always reachable.
          className="scrollbar-slim lg:min-h-0 lg:overflow-y-auto"
          lead={lead}
          converting={converting}
          timelineOpen={timelineOpen}
          fields={visibleFields}
          showTags={!HIDE_TAGS_ORIGINS.has(from ?? "")}
          addingTag={addingTag}
          actions={{
            onWhatsapp: () => setWaOpen(true),
            onEmail: () => setEmailOpen(true),
            onEdit: () => void openEdit(),
            onDelete: () => setDeleteOpen(true),
            onTimeline: () => setTimelineOpen(true),
            onManageFields: () => setManageFieldsOpen(true),
            // The reference shows the tag control on the Today Leads page; other
            // entry points keep the panel exactly as it was.
            onAddTag: TAG_PICKER_ORIGINS.has(from ?? "")
              ? (tagId: string) => void addTag(tagId)
              : undefined,
            onRemoveTag: TAG_PICKER_ORIGINS.has(from ?? "")
              ? (tagId: string) => void removeTag(tagId)
              : undefined,
            onConvert: () => setConvertOpen(true),
            onSelectPipeline: (pipeline) => void selectPipeline(pipeline),
          }}
        />

        <div className="flex min-w-0 flex-col lg:min-h-0">
          {/* The reference frames the right column with a folder-style tab sitting on
              top of the panel, rather than a plain heading above it. */}
          <div className="flex shrink-0">
            <h2 className="rounded-t-surface border border-b-0 border-hairline bg-canvas px-6 py-2.5 text-sm font-semibold text-ink">
              Details
            </h2>
          </div>
          <div className="scrollbar-slim flex flex-col gap-4 rounded-surface rounded-tl-none border border-hairline bg-surface p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <LeadDetailSection
              title="File Attachments"
              columns={ATTACHMENT_COLUMNS}
              rows={[]}
              emptyDescription={EMPTY}
              pageSize={3}
              action={
                <LeadDetailAddButton
                  label="Add File"
                  onClick={() => setAddFileOpen(true)}
                />
              }
            />

            <LeadDetailSection
              title="Notes"
              columns={NOTE_COLUMNS}
              rows={noteRows}
              emptyDescription={EMPTY}
              pageSize={3}
              loading={notesEvents === null && !notesErrored}
              errored={notesErrored}
              onRetry={() => {
                setNotesFailedKey(null);
                setNotesRefresh((token) => token + 1);
              }}
              action={
                <LeadDetailAddButton
                  label="Add Note"
                  onClick={() => setNoteOpen(true)}
                />
              }
            />

            <LeadDetailFollowUps
              activities={followUps ?? []}
              loading={followUps === null && !followUpsErrored}
              errored={followUpsErrored}
              onRetry={() => {
                setFollowUpsFailedKey(null);
                setFollowUpsRefresh((token) => token + 1);
              }}
              onAdd={() => setFollowUpOpen(true)}
            />

            <LeadDetailSection
              title="Email Log"
              columns={EMAIL_COLUMNS}
              rows={[]}
              emptyDescription={EMPTY}
              pageSize={3}
            />

            <LeadDetailSection
              title="Whatsapp Log"
              columns={WHATSAPP_COLUMNS}
              rows={[]}
              emptyDescription={EMPTY}
              pageSize={3}
            />

            <LeadDetailSection
              title="Call Log"
              columns={CALL_COLUMNS}
              rows={[]}
              emptyDescription={EMPTY}
              pageSize={3}
            />
          </div>
        </div>
      </div>

      {waOpen && (
        <LeadWhatsappDrawer
          open
          lead={lead}
          onClose={() => setWaOpen(false)}
          onSend={sendWhatsapp}
        />
      )}

      {emailOpen && (
        <LeadEmailDrawer
          open
          lead={lead}
          onClose={() => setEmailOpen(false)}
          onSent={() => {
            setEmailOpen(false);
            toast({ title: "Email sent", tone: "success" });
          }}
        />
      )}

      {noteOpen && (
        <LeadNoteDrawer
          open
          lead={lead}
          onClose={() => setNoteOpen(false)}
          onSaved={() => {
            setNoteOpen(false);
            setNotesRefresh((token) => token + 1);
            toast({ title: "Note added", tone: "success" });
          }}
        />
      )}

      {manageFieldsOpen && fieldLayout && (
        <LeadManageColumnsDrawer
          open
          title="Manage Fields"
          searchPlaceholder="Search here..."
          showReset={false}
          lockedKeys={LOCKED_FIELD_KEYS}
          columns={allFields.map((field) => ({
            key: field.key,
            label: field.label,
          }))}
          order={fieldLayout.order}
          hidden={fieldLayout.hidden}
          onClose={() => setManageFieldsOpen(false)}
          onApply={(order, hidden) => {
            const next = { order, hidden };
            setFieldLayout(next);
            saveColumnLayout(LEAD_DETAIL_FIELDS_VIEW_KEY, next).catch(() => {
              toast({ title: "Couldn’t save your fields", tone: "danger" });
            });
          }}
        />
      )}

      {timelineOpen && (
        <LeadTimelineDrawer
          open
          leadName={lead.name}
          events={notesEvents}
          errored={notesErrored}
          onRetry={() => {
            setNotesFailedKey(null);
            setNotesRefresh((token) => token + 1);
          }}
          onClose={() => setTimelineOpen(false)}
        />
      )}

      {addFileOpen && (
        <LeadAddFileDrawer
          open
          onClose={() => setAddFileOpen(false)}
          onSubmit={attachFile}
        />
      )}

      {/* Add New Follow-up (ACT-03.2) — the same drawer the Leads list opens, so the
          form, its validation and the create call are shared, not duplicated. */}
      {followUpOpen && (
        <LeadFollowUpFormDrawer
          lead={lead}
          onClose={() => setFollowUpOpen(false)}
          onCreated={() => {
            setFollowUpOpen(false);
            setFollowUpsRefresh((token) => token + 1);
            toast({ title: "Follow-up added successfully", tone: "success" });
          }}
        />
      )}

      {editData && (
        <LeadFormDrawer
          open
          lead={editData}
          onClose={() => setEditData(null)}
          onSaved={(updated) => {
            setLoaded({ id, lead: { ...updated, isPinned: lead.isPinned } });
            setEditData(null);
            toast({ title: `${updated.name} updated`, tone: "success" });
          }}
        />
      )}

      <ConfirmDialog
        open={convertOpen}
        onCancel={() => setConvertOpen(false)}
        onConfirm={() => void confirmConvert()}
        title="Convert lead"
        description={`Mark “${lead.name}” as converted? This sets the lead's status to ${CONVERTED_STATUS}.`}
        confirmLabel="Convert"
        busy={converting}
      />

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="Delete lead"
        description={`Permanently delete “${lead.name}”? This can't be undone.`}
        confirmLabel="Delete"
        tone="danger"
      />

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10">
          <IconLoader2
            size={26}
            className="animate-spin text-ink-muted"
            aria-label="Deleting"
          />
        </div>
      )}
    </PageContainer>
  );
}
