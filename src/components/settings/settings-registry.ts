import type { Icon } from "@tabler/icons-react";
import {
  IconAffiliate,
  IconBellRinging,
  IconBuilding,
  IconDatabase,
  IconMapPin,
  IconMessages,
  IconPhoneCall,
  IconSettings,
  IconSitemap,
  IconUserShield,
} from "@tabler/icons-react";

/**
 * A hue key → literal pastel tile classes (soft tint fill + saturated glyph), matching the
 * Workpex Settings tiles. Literal strings so Tailwind emits them (CLAUDE.md §7 — default-palette
 * shades are theme values, not raw hex).
 */
export type SettingsAccent =
  "orange" | "green" | "rose" | "teal" | "violet" | "pink" | "red" | "fuchsia";

export const SETTINGS_ACCENTS: Record<SettingsAccent, string> = {
  orange: "bg-orange-100 text-orange-500",
  green: "bg-green-100 text-green-600",
  rose: "bg-rose-100 text-rose-500",
  teal: "bg-teal-100 text-teal-600",
  violet: "bg-violet-100 text-violet-600",
  pink: "bg-pink-100 text-pink-500",
  red: "bg-red-100 text-red-500",
  fuchsia: "bg-fuchsia-100 text-fuchsia-500",
};

/**
 * One row inside a category card, and one leaf in the settings sidebar.
 *
 * `href` is present only where a real screen exists. Everything else is still
 * navigation-only, so a row without one renders as plain text rather than a link that
 * would 404 — the hub has always listed the whole Workpex information architecture.
 */
export interface SettingsItem {
  label: string;
  href?: string;
}

export interface SettingsCategory {
  key: string;
  title: string;
  description: string;
  icon: Icon;
  accent: SettingsAccent;
  /** Item rows. The "N Settings" badge derives from this list. */
  items: readonly SettingsItem[];
}

/**
 * The Settings hub catalogue, transcribed from `ui-reference/settings/`. NAVIGATION ONLY: this
 * lists the Workpex Settings information architecture as a landing hub — no item is wired to a
 * management screen or a backend. A full Settings management screen is OUT OF SCOPE per the
 * backlog (FND-04.2): the underlying lists are seeded or managed inside their own modules.
 *
 * Kept for visual parity with Workpex; where an item maps to a real Emarath module it can link
 * there once those screens exist. "Workpex Alerts" is rebranded to "Emarath Alerts" (brand name
 * is one of the three things allowed to differ from Workpex, CLAUDE.md §1).
 */
export const SETTINGS_CATEGORIES: readonly SettingsCategory[] = [
  {
    key: "sales-crm",
    title: "Sales & CRM Configuration",
    description:
      "Manage lead workflows, sales pipelines, sources, and CRM rules across the system.",
    icon: IconAffiliate,
    accent: "orange",
    items: [
      {
        label: "General Settings",
        href: "/settings/sales-crm/general-settings",
      },
      { label: "Category", href: "/settings/sales-crm/category" },
      { label: "Sales Pipeline", href: "/settings/sales-crm/sales-pipeline" },
      { label: "Lead Source", href: "/settings/sales-crm/lead-source" },
      { label: "Tags", href: "/settings/sales-crm/tags" },
      // The reference rail reads "Duplicate Settings"; the hub tile transcription had
      // "Duplicate Leads". The rail screenshot is the later, legible one.
      {
        label: "Duplicate Settings",
        href: "/settings/sales-crm/duplicate-settings",
      },
    ],
  },
  {
    key: "organization",
    title: "Organization Setup",
    description:
      "Configure company details, teams, hubs, and organization-level system settings.",
    icon: IconBuilding,
    accent: "green",
    items: [
      { label: "General Settings" },
      { label: "Company Details" },
      { label: "Host Mapping" },
    ],
  },
  {
    key: "users-access",
    title: "Users & Access",
    description:
      "Control team members, roles, permissions, and access rules across platform.",
    icon: IconUserShield,
    accent: "rose",
    items: [
      { label: "Team Members", href: "/settings/users-access/team-members" },
      {
        label: "Roles & Permissions",
        href: "/settings/users-access/roles-permissions",
      },
    ],
  },
  {
    key: "communication",
    title: "Communication",
    description:
      "Manage templates, notifications, and alert settings for system communication.",
    icon: IconMessages,
    accent: "teal",
    items: [{ label: "Templates" }, { label: "Emarath Alerts" }],
  },
  {
    key: "assignment",
    title: "Assignment",
    description:
      "Define assignment logic and rules to distribute leads and tasks automatically.",
    icon: IconSitemap,
    accent: "violet",
    items: [{ label: "General Settings" }, { label: "Assignment Rules" }],
  },
  {
    key: "call-tracking",
    title: "Call Tracking",
    description:
      "Configure call tracking options, statuses, and monitoring preferences easily.",
    icon: IconPhoneCall,
    accent: "pink",
    items: [{ label: "General Settings" }, { label: "Call Status" }],
  },
  {
    key: "activity-reminders",
    title: "Activity and Reminders",
    description:
      "Set up activities, follow-up types, and reminder rules for daily operations.",
    icon: IconBellRinging,
    accent: "violet",
    items: [{ label: "General Settings" }, { label: "Follow Up Types" }],
  },
  {
    key: "gps-tracking",
    title: "GPS Tracking",
    description:
      "Manage location tracking, check-ins, and field visit form configurations.",
    icon: IconMapPin,
    accent: "red",
    items: [{ label: "General Settings" }, { label: "Location Check-in Form" }],
  },
  {
    key: "data-schema",
    title: "Data & Schema Management",
    description:
      "Customize fields, forms, and data imports to structure system information.",
    icon: IconDatabase,
    accent: "fuchsia",
    items: [{ label: "Custom Field" }, { label: "Form Customization" }],
  },
  {
    key: "application-controls",
    title: "Application Controls",
    description:
      "Configure application-wide settings, dashboards, and demo account options.",
    icon: IconSettings,
    accent: "green",
    items: [
      { label: "Application General Settings" },
      { label: "Dashboard Settings" },
    ],
  },
];
