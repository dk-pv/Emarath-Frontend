/**
 * Window events the catalogue write clients fire after a successful change, so every
 * reader that cached the old catalogue refreshes in place: the app-level and board
 * stage providers, the Leads status badges and dropdowns, the pipeline switcher.
 * Without them a stage renamed on the board kept its old name on the Leads list until a
 * full page reload, because client-side navigation never remounts the layout.
 */
export const STAGES_CHANGED = "emarath:stages-changed";
export const PIPELINES_CHANGED = "emarath:pipelines-changed";

export function announce(event: string): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
}
