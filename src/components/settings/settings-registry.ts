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

export interface SettingsCategory {
  key: string;
  title: string;
  description: string;
  icon: Icon;
  accent: SettingsAccent;
  /** Item labels shown as navigation rows. The "N Settings" badge derives from this list. */
  items: string[];
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
      "General Settings",
      "Category",
      "Sales Pipeline",
      "Lead Source",
      "Tags",
      "Duplicate Leads",
    ],
  },
  {
    key: "organization",
    title: "Organization Setup",
    description:
      "Configure company details, teams, hubs, and organization-level system settings.",
    icon: IconBuilding,
    accent: "green",
    items: ["General Settings", "Company Details", "Host Mapping"],
  },
  {
    key: "users-access",
    title: "Users & Access",
    description:
      "Control team members, roles, permissions, and access rules across platform.",
    icon: IconUserShield,
    accent: "rose",
    items: ["Team Members", "Roles & Permissions"],
  },
  {
    key: "communication",
    title: "Communication",
    description:
      "Manage templates, notifications, and alert settings for system communication.",
    icon: IconMessages,
    accent: "teal",
    items: ["Templates", "Emarath Alerts"],
  },
  {
    key: "assignment",
    title: "Assignment",
    description:
      "Define assignment logic and rules to distribute leads and tasks automatically.",
    icon: IconSitemap,
    accent: "violet",
    items: ["General Settings", "Assignment Rules"],
  },
  {
    key: "call-tracking",
    title: "Call Tracking",
    description:
      "Configure call tracking options, statuses, and monitoring preferences easily.",
    icon: IconPhoneCall,
    accent: "pink",
    items: ["General Settings", "Call Status"],
  },
  {
    key: "activity-reminders",
    title: "Activity and Reminders",
    description:
      "Set up activities, follow-up types, and reminder rules for daily operations.",
    icon: IconBellRinging,
    accent: "violet",
    items: ["General Settings", "Follow Up Types"],
  },
  {
    key: "gps-tracking",
    title: "GPS Tracking",
    description:
      "Manage location tracking, check-ins, and field visit form configurations.",
    icon: IconMapPin,
    accent: "red",
    items: ["General Settings", "Location Check-in Form"],
  },
  {
    key: "data-schema",
    title: "Data & Schema Management",
    description:
      "Customize fields, forms, and data imports to structure system information.",
    icon: IconDatabase,
    accent: "fuchsia",
    items: ["Custom Field", "Form Customization"],
  },
  {
    key: "application-controls",
    title: "Application Controls",
    description:
      "Configure application-wide settings, dashboards, and demo account options.",
    icon: IconSettings,
    accent: "green",
    items: ["Application General Settings", "Dashboard Settings"],
  },
];
