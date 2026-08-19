"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { whatsappUrl } from "@/lib/whatsapp";
import {
  WHATSAPP_TEMPLATES,
  renderTemplate,
} from "@/components/leads/whatsapp-templates";
import type { LeadListItem } from "@/services/leads-service";
import type { SelectOption } from "@/types";

type LeadWhatsappDrawerProps = {
  open: boolean;
  /** The lead the message is for — its phone prefills the field, its name the preview. */
  lead: LeadListItem;
  onClose: () => void;
  /** Hands the composed message + final number to the caller's existing WhatsApp path. */
  onSend: (payload: { phone: string; message: string }) => void;
};

/**
 * The Workpex "Send Whatsapp Message" composer (LEAD-10.2, from the verified
 * Workpex screenshots). Inserted BEFORE the existing `wa.me` deep-link: clicking
 * the row's WhatsApp icon opens this drawer instead of navigating, and only the
 * Send button hands off to WhatsApp (the caller keeps the deep-link behaviour).
 *
 * The lead's phone prefills the shared `PhoneInput` (country-code selector + number);
 * a template is chosen from `MultiSelect` (constrained to one — the removable chip
 * Workpex shows). Templates are UI-only placeholders until the Integrations module
 * (INT-05.x) supplies a real BSP template feed — see `whatsapp-templates.ts`.
 */
export function LeadWhatsappDrawer({
  open,
  lead,
  onClose,
  onSend,
}: LeadWhatsappDrawerProps) {
  const [phone, setPhone] = useState(lead.primaryPhone);
  // One template at a time: MultiSelect gives the checkbox+chip look Workpex uses,
  // and slicing to the last pick keeps it single-select with a removable chip.
  const [templateIds, setTemplateIds] = useState<string[]>([]);

  const options = useMemo<SelectOption[]>(
    () => WHATSAPP_TEMPLATES.map((t) => ({ label: t.name, value: t.id })),
    [],
  );

  const template = WHATSAPP_TEMPLATES.find((t) => t.id === templateIds[0]);
  const message = template
    ? renderTemplate(template.body, { name: lead.name })
    : "";

  // Send is inert until a template is chosen and the number is dialable — matching
  // Workpex's disabled Send before a template is selected.
  const canSend = Boolean(template) && whatsappUrl(phone) !== null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Send Whatsapp Message"
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => canSend && onSend({ phone, message })}
            disabled={!canSend}
          >
            Send
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">Send To</h3>
          <p className="text-sm text-ink-muted">
            Enter the recipient&apos;s WhatsApp number to send a message. Make
            sure to include the country code for successful delivery.
          </p>
          <PhoneInput value={phone} onChange={setPhone} />
        </section>

        <section className="flex flex-col gap-3 rounded-surface border border-hairline p-4">
          <MultiSelect
            options={options}
            value={templateIds}
            onChange={(next) => setTemplateIds(next.slice(-1))}
            placeholder="Choose Template"
          />

          {message ? (
            <p className="whitespace-pre-wrap text-sm text-ink">{message}</p>
          ) : (
            <p className="py-10 text-center text-sm text-ink-subtle">
              No template selected.
              <br />
              Choose template from the list
            </p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
