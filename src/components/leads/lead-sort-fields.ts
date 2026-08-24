import type { Icon } from "@tabler/icons-react";
import {
  IconAffiliate,
  IconBuilding,
  IconCalendar,
  IconCalendarEvent,
  IconCategory,
  IconCoin,
  IconCreditCard,
  IconCurrencyDirham,
  IconHash,
  IconId,
  IconLanguage,
  IconMapPin,
  IconMessage,
  IconMessageReport,
  IconPackage,
  IconPhone,
  IconPhoneCall,
  IconProgressCheck,
  IconRoad,
  IconUser,
  IconUserCheck,
  IconWorld,
} from "@tabler/icons-react";

/**
 * The Leads "Sort" menu fields, in the exact order and labels Workpex lists them
 * (`leads-sort-dropdown-open.png`). Each maps to a real `Lead` column the list
 * API can order by — the backend `LEAD_SORT_COLUMNS` whitelist — so the menu never
 * offers a control that silently sorts by the wrong field.
 *
 * `sortable: false` marks a Workpex field the backend cannot order by yet: COMPLAINTS
 * and Assigned Date are to-many relations (`Lead.complaints` / `Lead.assignments`),
 * and Prisma cannot `orderBy` a relation field. They are shown, greyed and inert with
 * a reason, rather than dropped (parity) or faked (they would sort by nothing).
 *
 * `key` is the API sort key for sortable rows; the inert rows carry an empty key that
 * is never sent.
 */
export type LeadSortFieldDef = {
  key: string;
  label: string;
  icon: Icon;
  sortable: boolean;
  /** Why an inert field cannot be sorted — its tooltip. */
  hint?: string;
};

const RELATION_HINT = "Sorting by this field isn’t available yet.";

export const LEAD_SORT_FIELDS: readonly LeadSortFieldDef[] = [
  { key: "name", label: "Customer Name", icon: IconUser, sortable: true },
  {
    key: "primaryPhone",
    label: "Primary Phone",
    icon: IconPhone,
    sortable: true,
  },
  { key: "source", label: "Source", icon: IconAffiliate, sortable: true },
  {
    key: "status",
    label: "Lead Status",
    icon: IconProgressCheck,
    sortable: true,
  },
  {
    key: "createdAt",
    label: "Created Date",
    icon: IconCalendar,
    sortable: true,
  },
  { key: "country", label: "Country", icon: IconWorld, sortable: true },
  {
    key: "pipeline",
    label: "Lead Pipeline",
    icon: IconAffiliate,
    sortable: true,
  },
  { key: "firstName", label: "First Name", icon: IconUser, sortable: true },
  {
    key: "secondaryPhone",
    label: "Secondary Phone",
    icon: IconPhone,
    sortable: true,
  },
  {
    key: "",
    label: "COMPLAINTS",
    icon: IconMessageReport,
    sortable: false,
    hint: RELATION_HINT,
  },
  { key: "language", label: "Language", icon: IconLanguage, sortable: true },
  {
    key: "",
    label: "Assigned Date",
    icon: IconUserCheck,
    sortable: false,
    hint: RELATION_HINT,
  },
  { key: "product", label: "Product", icon: IconPackage, sortable: true },
  { key: "productQty", label: "QTY", icon: IconHash, sortable: true },
  { key: "product2", label: "Product 2", icon: IconPackage, sortable: true },
  {
    key: "product2Qty",
    label: "QTY OF PRODUCT 2",
    icon: IconHash,
    sortable: true,
  },
  {
    key: "callStatus",
    label: "Call Status",
    icon: IconPhoneCall,
    sortable: true,
  },
  {
    key: "callAttempts",
    label: "NO.OF CALL ATTEMTS",
    icon: IconPhoneCall,
    sortable: true,
  },
  {
    key: "whatsappAttempts",
    label: "NO.OF MSG ATTEMPTS",
    icon: IconMessage,
    sortable: true,
  },
  { key: "state", label: "State", icon: IconMapPin, sortable: true },
  { key: "street", label: "Street", icon: IconRoad, sortable: true },
  { key: "city", label: "CITY", icon: IconBuilding, sortable: true },
  {
    key: "nationalCode",
    label: "National Code",
    icon: IconId,
    sortable: true,
  },
  {
    key: "bookingDate",
    label: "BOOKING DATE",
    icon: IconCalendarEvent,
    sortable: true,
  },
  { key: "category", label: "Category", icon: IconCategory, sortable: true },
  {
    key: "actualAmount",
    label: "Actual Amount",
    icon: IconCurrencyDirham,
    sortable: true,
  },
  // Workpex lists "Lead Value" separately from "Actual Amount"; the schema's only
  // other money column is `forecastedAmount` (the list's "Forecasted Amount"), so
  // that is what this orders by. Flagged for PO confirmation.
  {
    key: "forecastedAmount",
    label: "Lead Value",
    icon: IconCoin,
    sortable: true,
  },
  {
    key: "paymentMethod",
    label: "Payment Method",
    icon: IconCreditCard,
    sortable: true,
  },
];
