import {
  IconAffiliate,
  IconCalendarEvent,
  IconCategory,
  IconForms,
  IconLanguage,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPhoneCall,
  IconUsers,
  IconWorld,
  type Icon,
} from "@tabler/icons-react";
import { formatAED, formatDate } from "@/lib/format";
import type { LeadListItem } from "@/services/leads-service";

/** The Manage Fields view key — its own, so it never collides with a table's layout. */
export const LEAD_DETAIL_FIELDS_VIEW_KEY = "lead-detail-fields";

/**
 * One selectable field in the Basic Info panel. `value` returns the display string, or
 * null for "no value" — the panel renders the shared em dash for those, exactly as it
 * does for the fields that were always there.
 */
export type LeadDetailField = {
  key: string;
  label: string;
  icon?: Icon;
  /** The assignee row renders avatars, so it is drawn by the panel, not by a string. */
  kind?: "assigned";
  value?: (lead: LeadListItem) => string | null;
};

/**
 * The identifier fields: always shown, and locked in Manage Fields so they cannot be
 * switched off — a lead with no name or number on screen is not a useful panel.
 */
export const LOCKED_FIELD_KEYS = ["name", "primaryPhone"] as const;

/**
 * Every field the Basic Info panel can show, in its default order. Only fields the
 * lead payload actually carries are listed: an option that could never fill in would
 * be an empty row the user cannot explain.
 */
export const LEAD_DETAIL_FIELDS: readonly LeadDetailField[] = [
  {
    key: "name",
    label: "Customer Name",
    icon: IconForms,
    value: (lead) => lead.name,
  },
  {
    key: "primaryPhone",
    label: "Primary Phone",
    icon: IconPhone,
    value: (lead) => lead.primaryPhone,
  },
  {
    key: "source",
    label: "Source",
    icon: IconAffiliate,
    value: (lead) => lead.source,
  },
  { key: "assigned", label: "Assigned", kind: "assigned" },
  {
    key: "forecastedAmount",
    label: "Forecasted Amount",
    value: (lead) => formatAED(lead.forecastedAmount),
  },
  {
    key: "firstName",
    label: "First Name",
    icon: IconForms,
    value: (lead) => lead.firstName,
  },
  {
    key: "secondaryPhone",
    label: "Secondary Phone",
    icon: IconPhone,
    value: (lead) => lead.secondaryPhone,
  },
  {
    key: "email",
    label: "Email",
    icon: IconMail,
    value: (lead) => lead.email,
  },
  {
    key: "actualAmount",
    label: "Actual Amount",
    value: (lead) => formatAED(lead.actualAmount),
  },
  {
    key: "language",
    label: "Language",
    icon: IconLanguage,
    value: (lead) => lead.language,
  },
  {
    key: "category",
    label: "Category",
    icon: IconCategory,
    value: (lead) => lead.category,
  },
  {
    key: "country",
    label: "Country",
    icon: IconWorld,
    value: (lead) => lead.country,
  },
  {
    key: "city",
    label: "City",
    icon: IconMapPin,
    value: (lead) => lead.city,
  },
  {
    key: "state",
    label: "State",
    icon: IconMapPin,
    value: (lead) => lead.state,
  },
  {
    key: "street",
    label: "Street",
    icon: IconMapPin,
    value: (lead) => lead.street,
  },
  {
    key: "callStatus",
    label: "Call Status",
    icon: IconPhoneCall,
    value: (lead) => lead.callStatus,
  },
  {
    key: "callAttempts",
    label: "Call Attempts",
    icon: IconPhoneCall,
    value: (lead) => String(lead.callAttempts),
  },
  {
    key: "whatsappAttempts",
    label: "WhatsApp Attempts",
    icon: IconUsers,
    value: (lead) => String(lead.whatsappAttempts),
  },
  {
    key: "bookingDate",
    label: "Booking Date",
    icon: IconCalendarEvent,
    value: (lead) => (lead.bookingDate ? formatDate(lead.bookingDate) : null),
  },
];

/** What the panel shows before the user has chosen — the reference's checked set. */
const DEFAULT_VISIBLE = new Set([
  "name",
  "primaryPhone",
  "source",
  "assigned",
  "forecastedAmount",
]);

export const DEFAULT_HIDDEN_FIELD_KEYS = LEAD_DETAIL_FIELDS.filter(
  (field) => !DEFAULT_VISIBLE.has(field.key),
).map((field) => field.key);

/** A lead's custom columns become selectable fields too, keyed as the API keys them. */
export function customFieldEntries(
  fields: readonly { key: string; name: string }[],
): LeadDetailField[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.name,
    value: (lead: LeadListItem) => lead.customFields[field.key] ?? null,
  }));
}
