import type { Icon } from "@tabler/icons-react";
import {
  IconApi,
  IconBrandFacebook,
  IconBrandGoogle,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconChecks,
  IconMessageChatbot,
  IconMessageCircle,
  IconMessageDots,
  IconMessages,
  IconPhone,
  IconPhoneCall,
  IconPlug,
  IconReceipt2,
  IconSchool,
  IconSend,
  IconWorldWww,
} from "@tabler/icons-react";

/**
 * Presentation for the integration library (INT-02.1).
 *
 * The integrations themselves now come from `GET /api/integrations` (INT-01.1) — this
 * module holds only what the API deliberately does not carry: the glyph to draw and the
 * tile colour to draw it on. It used to be the data source as well; that array is gone.
 */

/**
 * A hue key → literal Tailwind tile classes: a saturated solid fill with a white glyph,
 * matching Workpex's solid brand tiles (blue Facebook, green WhatsApp, grey Web Form, …).
 * Literal strings so Tailwind emits them (CLAUDE.md §7 — no inline hex; the
 * default-palette shades are theme values, not raw hex).
 */
export type IntegrationAccent =
  "blue" | "green" | "gray" | "slate" | "orange" | "sky" | "fuchsia";

export const INTEGRATION_ACCENTS: Record<IntegrationAccent, string> = {
  blue: "bg-blue-600 text-white",
  green: "bg-green-500 text-white",
  gray: "bg-gray-400 text-white",
  slate: "bg-slate-600 text-white",
  orange: "bg-orange-500 text-white",
  sky: "bg-sky-500 text-white",
  fuchsia: "bg-fuchsia-500 text-white",
};

/**
 * The API's `logo` field holds an icon key, not an asset path: the product ships no
 * per-provider logo art, so each card falls back to a Tabler glyph (ADR-0054 §4,
 * CLAUDE.md §16 — no invented art, no emoji). When real logos land, `logo` becomes a
 * path and this map is deleted.
 *
 * An unknown key draws the generic plug rather than crashing, so an integration seeded
 * after this build still renders.
 */
export const INTEGRATION_ICONS: Record<string, Icon> = {
  IconApi,
  IconBrandFacebook,
  IconBrandGoogle,
  IconBrandWhatsapp,
  IconBuildingStore,
  IconChecks,
  IconMessageChatbot,
  IconMessageCircle,
  IconMessageDots,
  IconMessages,
  IconPhone,
  IconPhoneCall,
  IconReceipt2,
  IconSchool,
  IconSend,
  IconWorldWww,
};

/** Tile colour per integration, keyed by the API's stable `key`. */
const ACCENTS: Record<string, IntegrationAccent> = {
  facebook: "blue",
  "web-form": "gray",
  whatsapp: "green",
  happilee: "blue",
  wabis: "green",
  "double-tick": "green",
  "google-ads": "blue",
  wati: "green",
  "hal-api": "slate",
  bonvoice: "sky",
  "3cx": "slate",
  zoho: "orange",
  "college-dunia": "blue",
  "urban-chat": "green",
  voxbay: "slate",
  "facebook-conversion-api": "blue",
  "india-mart": "blue",
  telinfy: "fuchsia",
};

/** Drawn when the API sends a logo key this build does not know. */
export const FALLBACK_ICON = IconPlug;

export function integrationAccent(key: string): IntegrationAccent {
  return ACCENTS[key] ?? "slate";
}
