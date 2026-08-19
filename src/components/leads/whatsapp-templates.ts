/**
 * Placeholder WhatsApp message templates (UI-only, ADR-0013 / INT-05 pending).
 *
 * Emarath has no WhatsApp template store yet: approved templates come from the BSP
 * (DoubleTick/Meta) via the Integrations module — INT-05.1–05.4 — which is not built.
 * Until then this small in-file list drives the "Send Whatsapp Message" composer so
 * the Workpex flow is reproducible end-to-end; `{{name}}` is filled from the selected
 * lead at preview time. When INT-05.x lands, swap this for the provider's real
 * template feed — the drawer only depends on `{ id, name, body }`, so nothing else
 * changes. Deliberately NOT wired to any backend (no invented outreach architecture).
 */
export interface WhatsappTemplate {
  id: string;
  name: string;
  /** Message body; `{{name}}` is substituted with the lead's name per send. */
  body: string;
}

export const WHATSAPP_TEMPLATES: readonly WhatsappTemplate[] = [
  { id: "testing", name: "testing", body: "testing, hi {{name}}" },
  {
    id: "greeting",
    name: "Greeting",
    body: "Hi {{name}}, thank you for reaching out to Emarath. How can we help you today?",
  },
  {
    id: "follow-up",
    name: "Follow Up",
    body: "Hi {{name}}, just following up on your enquiry. Are you still interested?",
  },
];

/** Fills a template body with the lead's data. Only `{{name}}` is supported for now. */
export function renderTemplate(body: string, vars: { name: string }): string {
  return body.replace(/\{\{\s*name\s*\}\}/g, vars.name);
}
