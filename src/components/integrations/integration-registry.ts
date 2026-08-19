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
  IconReceipt2,
  IconSchool,
  IconSend,
  IconWorldWww,
} from "@tabler/icons-react";

/** Provider/category tag shown on each card and offered as the library filter. */
export type IntegrationCategory = "Meta" | "Google" | "Zoho" | "Third-party";

/**
 * A hue key → literal Tailwind tile classes: a saturated solid fill with a white glyph, matching
 * Workpex's solid brand tiles (blue Facebook, green WhatsApp, grey Web Form, …). Literal strings
 * so Tailwind emits them (CLAUDE.md §7 — no inline hex; the default-palette shades are theme
 * values, not raw hex).
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
 * One integration in the library. Fields mirror the INT-01.1 registry schema (name, logo,
 * description, provider/category tag, enabled status, optional detail link) so this local seed
 * set is a drop-in for the backend registry once it exists — swapping the constant below for a
 * fetch needs no shape change.
 *
 * `icon` stands in for INT-01.1's `logo`: the app ships no per-provider logo assets, so each
 * card uses a fallback glyph from the existing Tabler set (CLAUDE.md §16 — no invented art, no
 * emoji). Replace with real logos by widening this field when the assets land.
 */
export interface IntegrationDefinition {
  id: string;
  name: string;
  description: string;
  icon: Icon;
  accent: IntegrationAccent;
  category: IntegrationCategory;
  /** Seed enablement only — the header count derives from live toggle state, not this flag. */
  enabled: boolean;
  /** INT-01.1 "optional detail link". A "View" affordance renders only when present. */
  detailUrl?: string;
}

/**
 * The reference integration set (INT-01.1 AC5), transcribed from
 * `ui-reference/integrations/`. Descriptions are verbatim except where Workpex named itself —
 * "Facebook Conversion API" and "Telinfy" are rebranded to Emarath (brand name is one of the
 * three things allowed to differ from Workpex, CLAUDE.md §1). Two integrations are seeded
 * enabled so the header reads a non-zero, reference-matching count; which two is not captured.
 */
export const INTEGRATIONS: readonly IntegrationDefinition[] = [
  {
    id: "facebook",
    name: "Facebook",
    description:
      "Connect Facebook to capture leads, manage campaigns, and sync audience data",
    icon: IconBrandFacebook,
    accent: "blue",
    category: "Meta",
    enabled: true,
  },
  {
    id: "web-form",
    name: "Web Form",
    description:
      "Use web forms to collect user data, track submissions, and sync leads easily",
    icon: IconWorldWww,
    accent: "gray",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "whatsapp",
    name: "Whatsapp",
    description:
      "Manage chats and create leads from customer interactions on WhatsApp",
    icon: IconBrandWhatsapp,
    accent: "green",
    category: "Meta",
    enabled: true,
  },
  {
    id: "happilee",
    name: "Happilee",
    description:
      "Capture messages from Happilee and convert them into leads in your system",
    icon: IconMessageChatbot,
    accent: "blue",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "wabis",
    name: "Wabis",
    description:
      "Handle messaging, automate responses, and track communication efficiently",
    icon: IconMessageCircle,
    accent: "green",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "double-tick",
    name: "Double Tick",
    description:
      "Track message delivery, monitor engagement, and improve communication flow",
    icon: IconChecks,
    accent: "green",
    category: "Third-party",
    enabled: false,
    detailUrl: "https://doubletick.io",
  },
  {
    id: "google-ads",
    name: "Google Ads",
    description:
      "Track campaigns, capture leads, and measure ad performance in one place",
    icon: IconBrandGoogle,
    accent: "blue",
    category: "Google",
    enabled: false,
  },
  {
    id: "wati",
    name: "Wati",
    description:
      "Manage WhatsApp communication, automate replies, and track interactions",
    icon: IconMessageDots,
    accent: "green",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "hal-api",
    name: "Hal API",
    description:
      "Connect services, automate workflows, and enable smooth data exchange",
    icon: IconApi,
    accent: "slate",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "bonvoice",
    name: "Bonvoice",
    description:
      "Manage calls, track interactions, and improve communication efficiency",
    icon: IconPhoneCall,
    accent: "sky",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "3cx",
    name: "3CX",
    description:
      "Integrate 3CX telephony for contact lookup, search, and call journaling",
    icon: IconPhone,
    accent: "slate",
    category: "Third-party",
    enabled: false,
    detailUrl: "https://www.3cx.com",
  },
  {
    id: "zoho",
    name: "Zoho",
    description:
      "Sync billing data, track invoices, and manage payments seamlessly",
    icon: IconReceipt2,
    accent: "orange",
    category: "Zoho",
    enabled: false,
  },
  {
    id: "college-dunia",
    name: "College Dunia",
    description:
      "Capture leads, manage student inquiries, and simplify admission flow",
    icon: IconSchool,
    accent: "blue",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "urban-chat",
    name: "Urban Chat",
    description:
      "Handle live chats, automate replies, and boost customer engagement",
    icon: IconMessages,
    accent: "green",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "voxbay",
    name: "Voxbay",
    description:
      "Track calls, monitor interactions, and improve communication efficiency",
    icon: IconPhoneCall,
    accent: "slate",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "facebook-conversion-api",
    name: "Facebook Conversion API",
    description:
      "This feature sends conversion events from Emarath to Facebook, allowing better ad tracking and optimization.",
    icon: IconBrandFacebook,
    accent: "blue",
    category: "Meta",
    enabled: false,
  },
  {
    id: "india-mart",
    name: "India Mart",
    description:
      "Sync IndiaMART leads directly into your CRM for faster lead management, automated inquiry capture, and streamlined follow-ups.",
    icon: IconBuildingStore,
    accent: "blue",
    category: "Third-party",
    enabled: false,
  },
  {
    id: "telinfy",
    name: "Telinfy",
    description:
      "Automatically sync leads from Telinfy to Emarath, avoiding manual data entry.",
    icon: IconSend,
    accent: "fuchsia",
    category: "Third-party",
    enabled: false,
  },
];

/** Distinct provider/category tags in first-seen order — drives the library filter (INT-02.3). */
export const INTEGRATION_CATEGORIES: readonly IntegrationCategory[] = [
  ...new Set(INTEGRATIONS.map((integration) => integration.category)),
];
