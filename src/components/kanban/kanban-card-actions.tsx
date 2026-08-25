"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { LeadEmailDrawer } from "@/components/leads/lead-email-drawer";
import { LeadNoteDrawer } from "@/components/leads/lead-note-drawer";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import { CONVERTED_STATUS } from "@/components/leads/lead-row-actions";
import { ApiError } from "@/lib/api-client";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  fetchLeadForEdit,
  type LeadEditData,
  type LeadListItem,
} from "@/services/leads-service";
import {
  archiveLead,
  deleteLead,
  pinLead,
  setLeadStatus,
  unpinLead,
} from "@/services/leads-row-actions-service";
import { ChangePipelineModal } from "./change-pipeline-modal";

/**
 * The Kanban card ⋮ menu's action handlers (KAN-03.1 card actions). Email, Add-Note,
 * Convert-to-WON, personal Pin, Edit and hard Delete reuse the Leads-list row actions
 * (LEAD-10.x) wholesale — the same scoped APIs and the same drawers/dialogs, so no
 * business logic is duplicated; only the presentation differs (a card menu vs the
 * list's icon row). WhatsApp is the direct `wa.me` deep-link the card requires
 * ("triggers outreach without opening the record", KAN-03.1) — not the list's composer.
 *
 * Change Pipeline and Archive are real, backed by the smallest clean endpoints that
 * follow the existing architecture:
 *  - Change Pipeline (`POST /leads/:id/pipeline`): moves the lead to another pipeline
 *    and lands it on that pipeline's first stage (`pipeline` is a real Lead column);
 *    a pipeline with no stages is refused, surfaced as a toast (`ChangePipelineModal`).
 *  - Archive (`POST /leads/:id/archive`): a soft archive setting `deletedAt` — the
 *    state the "Archived leads" filter reads — so the lead leaves the active board but
 *    is recoverable (`unarchive`), distinct from the hard Delete that removes the row.
 *
 * A mutation that changes the card set (Convert / Edit / Delete / Archive / Change
 * Pipeline) calls `onBoardChanged` so the board reloads through its existing
 * `reloadKey` — the same path New Lead uses. Pin is optimistic-local (a personal pin
 * has no column effect, so the board is not reloaded); the icon reads via `isPinned`.
 */

type Handler = (lead: LeadListItem) => void;

export type KanbanCardActionsValue = {
  onWhatsapp: Handler;
  onEmail: Handler;
  onAddNote: Handler;
  onChangePipeline: Handler;
  onConvert: Handler;
  onArchive: Handler;
  onEdit: Handler;
  onDelete: Handler;
  /** Toggle the caller's personal pin; resolves once persisted, rejects on failure. */
  onPin: (lead: LeadListItem) => Promise<void>;
  /** The caller's effective pin for a lead — an optimistic override over the row's value. */
  isPinned: (lead: LeadListItem) => boolean;
  /** The lead whose Edit record is being fetched — drives the pencil's spinner. */
  pendingEditId: string | null;
};

const KanbanCardActionsContext = createContext<KanbanCardActionsValue | null>(
  null,
);

export function useKanbanCardActions(): KanbanCardActionsValue {
  const ctx = useContext(KanbanCardActionsContext);
  if (!ctx) {
    throw new Error(
      "useKanbanCardActions must be used within a KanbanCardActionsProvider",
    );
  }
  return ctx;
}

export function KanbanCardActionsProvider({
  onBoardChanged,
  children,
}: {
  onBoardChanged: () => void;
  children: ReactNode;
}) {
  const { toast } = useToast();

  const [emailTarget, setEmailTarget] = useState<LeadListItem | null>(null);
  const [noteTarget, setNoteTarget] = useState<LeadListItem | null>(null);
  const [pipelineTarget, setPipelineTarget] = useState<LeadListItem | null>(null);
  const [convertTarget, setConvertTarget] = useState<LeadListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadListItem | null>(null);
  const [editLead, setEditLead] = useState<LeadEditData | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const convertingRef = useRef(false);
  const deletingRef = useRef(false);

  // Optimistic pin overrides (id -> pinned) so the icon flips immediately; the board
  // is never reloaded for a pin, because a personal pin has no column effect.
  const [pinOverride, setPinOverride] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );
  const setOverride = (id: string, value: boolean) =>
    setPinOverride((prev) => new Map(prev).set(id, value));

  const isPinned = (lead: LeadListItem) =>
    pinOverride.get(lead.id) ?? lead.isPinned;

  const onPin = async (lead: LeadListItem) => {
    const next = !isPinned(lead);
    setOverride(lead.id, next);
    try {
      await (next ? pinLead(lead.id) : unpinLead(lead.id));
      toast({
        title: `${lead.name} ${next ? "pinned" : "unpinned"}`,
        tone: "success",
      });
    } catch (error) {
      setOverride(lead.id, !next);
      toast({
        title: next ? "Couldn’t pin lead" : "Couldn’t unpin lead",
        tone: "danger",
      });
      throw error;
    }
  };

  // Edit fetches the full editable record first (a pencil spinner runs meanwhile),
  // then opens the shared New Lead form in edit mode. A 404 means the lead was
  // removed out from under the board — reported, and the board reloaded.
  const openEdit = async (lead: LeadListItem) => {
    setPendingEditId(lead.id);
    try {
      const data = await fetchLeadForEdit(lead.id);
      setEditLead(data);
    } catch (error) {
      const gone = error instanceof ApiError && error.status === 404;
      if (gone) onBoardChanged();
      toast({
        title: gone ? "This lead no longer exists" : "Couldn’t open the lead",
        tone: "danger",
      });
    } finally {
      setPendingEditId(null);
    }
  };

  // WhatsApp: the card requires direct outreach "without opening the record"
  // (KAN-03.1), so this is the plain wa.me deep-link — not the list's composer.
  const openWhatsapp = (lead: LeadListItem) => {
    const url = whatsappUrl(lead.primaryPhone);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  // Archive: a soft archive (sets deletedAt) — reversible, distinct from the hard
  // Delete. The board reloads so the archived card leaves the active view. No confirm:
  // it is recoverable from the "Archived leads" filter.
  const handleArchive = async (lead: LeadListItem) => {
    try {
      await archiveLead(lead.id);
      toast({ title: `${lead.name} archived`, tone: "success" });
      onBoardChanged();
    } catch {
      toast({ title: "Couldn’t archive lead", tone: "danger" });
    }
  };

  // Convert (ADR-0048): the existing set-status API to WON, behind a confirm dialog.
  // A ref makes a double-click fire exactly one mutation; the board reloads so the
  // card moves to (or leaves) the WON column.
  const handleConvert = async () => {
    const lead = convertTarget;
    if (!lead || convertingRef.current) return;
    convertingRef.current = true;
    setConvertBusy(true);
    try {
      await setLeadStatus(lead.id, CONVERTED_STATUS);
      setConvertTarget(null);
      toast({ title: `${lead.name} converted`, tone: "success" });
      onBoardChanged();
    } catch {
      toast({
        title: "Unable to convert lead",
        description: "Please try again.",
        tone: "danger",
      });
    } finally {
      convertingRef.current = false;
      setConvertBusy(false);
    }
  };

  // Delete (hard delete, LEAD-10.1) behind a confirm; the board reloads so the card
  // disappears. One-shot guarded like Convert.
  const handleDelete = async () => {
    const lead = deleteTarget;
    if (!lead || deletingRef.current) return;
    deletingRef.current = true;
    setDeleteBusy(true);
    try {
      await deleteLead(lead.id);
      setDeleteTarget(null);
      toast({ title: `${lead.name} deleted`, tone: "success" });
      onBoardChanged();
    } catch {
      toast({ title: "Couldn’t delete lead", tone: "danger" });
    } finally {
      deletingRef.current = false;
      setDeleteBusy(false);
    }
  };

  // A fresh object each render (identities are stable enough — the provider only
  // re-renders on its own action state, never on drawer keystrokes, which live in
  // the drawers). Cards consume it through context, so they re-render only then.
  const value: KanbanCardActionsValue = {
    onWhatsapp: openWhatsapp,
    onEmail: (lead) => setEmailTarget(lead),
    onAddNote: (lead) => setNoteTarget(lead),
    onChangePipeline: (lead) => setPipelineTarget(lead),
    onConvert: (lead) => setConvertTarget(lead),
    onArchive: (lead) => void handleArchive(lead),
    onEdit: (lead) => void openEdit(lead),
    onDelete: (lead) => setDeleteTarget(lead),
    onPin,
    isPinned,
    pendingEditId,
  };

  return (
    <KanbanCardActionsContext value={value}>
      {children}

      {/* Reused composers — the SAME drawers the Leads list mounts (LEAD-10.2). */}
      {emailTarget && (
        <LeadEmailDrawer
          open
          lead={emailTarget}
          onClose={() => setEmailTarget(null)}
          onSent={() => {
            setEmailTarget(null);
            toast({ title: "Email sent", tone: "success" });
          }}
        />
      )}
      {noteTarget && (
        <LeadNoteDrawer
          open
          lead={noteTarget}
          onClose={() => setNoteTarget(null)}
          onSaved={() => {
            setNoteTarget(null);
            toast({ title: "Note added", tone: "success" });
          }}
        />
      )}
      {editLead && (
        <LeadFormDrawer
          open
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(updated) => {
            setEditLead(null);
            toast({ title: `${updated.name} updated`, tone: "success" });
            onBoardChanged();
          }}
        />
      )}
      {pipelineTarget && (
        <ChangePipelineModal
          lead={pipelineTarget}
          onClose={() => setPipelineTarget(null)}
          onChanged={() => {
            setPipelineTarget(null);
            onBoardChanged();
          }}
        />
      )}

      <ConfirmDialog
        open={convertTarget !== null}
        onCancel={() => setConvertTarget(null)}
        onConfirm={() => void handleConvert()}
        title="Convert lead?"
        description="Are you sure you want to convert this lead?"
        confirmLabel="Convert"
        tone="brand"
        busy={convertBusy}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete lead"
        description={
          deleteTarget
            ? `Permanently delete “${deleteTarget.name}”? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        busy={deleteBusy}
      />
    </KanbanCardActionsContext>
  );
}
