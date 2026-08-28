"use client";

import { useState } from "react";
import { FormError } from "@/components/ui/FormError";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api-client";
import { EMAIL_PATTERN } from "@/lib/validation";
import { sendLeadEmail } from "@/services/leads-row-actions-service";
import type { LeadListItem } from "@/services/leads-service";

type LeadEmailDrawerProps = {
  open: boolean;
  /** The lead the email is for — its email prefills To (empty when it has none). */
  lead: LeadListItem;
  onClose: () => void;
  /** Called after a successful send so the parent can toast and close. */
  onSent: () => void;
};

// A pragmatic address check — the backend re-validates every recipient (@IsEmail),
// so this is UX, not the trust boundary.
const parseEmails = (raw: string): string[] =>
  raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
const invalidEmails = (list: string[]): string[] =>
  list.filter((value) => !EMAIL_PATTERN.test(value));

/**
 * The Lead Email composer (LEAD-10.2, ADR-0032). Opens on the row's Email icon and
 * sends through the backend mail transport on Send — it never opens a mail client or
 * uses mailto. No template: the user composes manually (the client hasn't approved
 * email templates). To prefills with the lead's email when it has one, and is fully
 * editable; a lead with no email opens an empty, still-usable composer.
 *
 * Recipients are comma/space-separated. Send is inert until To holds at least one
 * valid address and no field holds an invalid one; a failed send keeps the drawer
 * open with the server's reason so the user can retry.
 */
export function LeadEmailDrawer({
  open,
  lead,
  onClose,
  onSent,
}: LeadEmailDrawerProps) {
  const [to, setTo] = useState(lead.email ?? "");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    to?: string;
    cc?: string;
    bcc?: string;
  }>({});

  const toList = parseEmails(to);
  const ccList = parseEmails(cc);
  const bccList = parseEmails(bcc);

  const canSend =
    !submitting &&
    toList.length > 0 &&
    invalidEmails(toList).length === 0 &&
    invalidEmails(ccList).length === 0 &&
    invalidEmails(bccList).length === 0;

  async function submit() {
    setApiError(null);
    const next: { to?: string; cc?: string; bcc?: string } = {};
    if (toList.length === 0) next.to = "At least one recipient is required";
    else if (invalidEmails(toList).length)
      next.to = `Invalid email: ${invalidEmails(toList).join(", ")}`;
    if (invalidEmails(ccList).length)
      next.cc = `Invalid email: ${invalidEmails(ccList).join(", ")}`;
    if (invalidEmails(bccList).length)
      next.bcc = `Invalid email: ${invalidEmails(bccList).join(", ")}`;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await sendLeadEmail(lead.id, {
        to: toList,
        cc: ccList.length ? ccList : undefined,
        bcc: bccList.length ? bccList : undefined,
        subject: subject.trim() || undefined,
        message: message || undefined,
      });
      onSent();
    } catch (error) {
      // Keep the drawer open on failure so the user can retry; surface the server's
      // reason when it gave one.
      setApiError(
        error instanceof ApiError
          ? error.messages.join(" · ") || error.message
          : "Couldn’t send the email. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Send Email"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSend}>
            {submitting ? "Sending…" : "Send"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {apiError && <FormError>{apiError}</FormError>}

        <FormField label="To" required error={errors.to}>
          {(control) => (
            <Input
              {...control}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
            />
          )}
        </FormField>

        <FormField label="Cc" error={errors.cc}>
          {(control) => (
            <Input
              {...control}
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Cc"
            />
          )}
        </FormField>

        <FormField label="Bcc" error={errors.bcc}>
          {(control) => (
            <Input
              {...control}
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="Bcc"
            />
          )}
        </FormField>

        <FormField label="Subject">
          {(control) => (
            <Input
              {...control}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          )}
        </FormField>

        <FormField label="Message">
          {(control) => (
            <Textarea
              {...control}
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message…"
            />
          )}
        </FormField>
      </div>
    </Drawer>
  );
}
