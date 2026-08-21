"use client";

import { useEffect, useState } from "react";
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
import { LeadEmailDrawer } from "@/components/leads/lead-email-drawer";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { LeadNoteDrawer } from "@/components/leads/lead-note-drawer";
import { LeadWhatsappDrawer } from "@/components/leads/lead-whatsapp-drawer";
import { ApiError } from "@/lib/api-client";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  fetchLead,
  fetchLeadForEdit,
  fetchLeadTimeline,
  type LeadEditData,
  type LeadListItem,
  type LeadTimelineEvent,
} from "@/services/leads-service";
import { deleteLead } from "@/services/leads-row-actions-service";

/** Initials for the avatar placeholder; duplicated pending FND-04.1's shared utils. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Workpex date format, e.g. "20-08-2026, 11:39 AM". Client-only, so no SSR skew. */
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
export function LeadDetailView({ id }: { id: string }) {
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

  const lead = loaded?.id === id ? loaded.lead : null;
  const failure = failed?.id === id ? failed.kind : null;
  const isLoading = !lead && !failure;

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
    <PageContainer>
      <div className="flex items-center gap-2">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <LeadDetailBasicInfo
          lead={lead}
          actions={{
            onWhatsapp: () => setWaOpen(true),
            onEmail: () => setEmailOpen(true),
            onEdit: () => void openEdit(),
            onDelete: () => setDeleteOpen(true),
          }}
        />

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-ink">Details</h2>

          <LeadDetailSection
            title="File Attachments"
            columns={ATTACHMENT_COLUMNS}
            rows={[]}
            emptyDescription={EMPTY}
            action={
              <LeadDetailAddButton
                label="Add attachment"
                disabled
                tooltip="File uploads aren’t available yet"
              />
            }
          />

          <LeadDetailSection
            title="Notes"
            columns={NOTE_COLUMNS}
            rows={noteRows}
            emptyDescription={EMPTY}
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

          <LeadDetailFollowUps />

          <LeadDetailSection
            title="Email Log"
            columns={EMAIL_COLUMNS}
            rows={[]}
            emptyDescription={EMPTY}
          />

          <LeadDetailSection
            title="Whatsapp Log"
            columns={WHATSAPP_COLUMNS}
            rows={[]}
            emptyDescription={EMPTY}
          />

          <LeadDetailSection
            title="Call Log"
            columns={CALL_COLUMNS}
            rows={[]}
            emptyDescription={EMPTY}
          />
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
