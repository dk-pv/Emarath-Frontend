"use client";

import { useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api-client";
import { addLeadNote } from "@/services/leads-row-actions-service";
import type { LeadListItem } from "@/services/leads-service";

type LeadNoteDrawerProps = {
  open: boolean;
  /** The lead the note is attached to. */
  lead: LeadListItem;
  onClose: () => void;
  /** Called after the note persists so the parent can toast and close. */
  onSaved: () => void;
};

/**
 * The Workpex "Add Note" composer (LEAD-10.2, ADR-0035), traced from the verified
 * Workpex screenshots (`leads-add-note-row-action.png`, `leads-add-note-drawer-open.png`):
 * a right-side drawer with one bordered textarea (placeholder "Add Note") and a
 * Cancel / Submit footer. Opens on the row's Add Note icon.
 *
 * Reuses the shared Drawer (X off the left edge, "Add Note" title header,
 * right-aligned footer) — no new modal system, no template or extra fields. The
 * note persists on the backend on Submit; only a successful save closes the drawer.
 * A failed save keeps it open with the server's reason so the text is not lost.
 * Workpex captures only creation, so there is deliberately no notes-history list.
 */
export function LeadNoteDrawer({
  open,
  lead,
  onClose,
  onSaved,
}: LeadNoteDrawerProps) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Inert until there is non-whitespace text, and while a save is in flight — the
  // disabled state doubles as the duplicate-submit guard.
  const canSubmit = !submitting && body.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setApiError(null);
    setSubmitting(true);
    try {
      await addLeadNote(lead.id, body.trim());
      onSaved();
    } catch (error) {
      // Keep the drawer open on failure so the note isn't lost; surface the
      // server's reason when it gave one.
      setApiError(
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Couldn’t save the note. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add Note"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {apiError && <FormError>{apiError}</FormError>}

        <Textarea
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add Note"
          aria-label="Add Note"
        />
      </div>
    </Drawer>
  );
}
