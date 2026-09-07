import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type {
  LeadCustomField,
  LeadCustomFieldType,
} from "@/services/leads-custom-fields-service";

/**
 * Settings → Data & Schema Management.
 *
 * The definition store is the one LEAD-05.1 already shipped (`/api/lead-custom-fields`);
 * this adds the settings screen's paged, searched, type-filtered read and the edit,
 * option and form routes it needs (ADR-0072). The shared `LeadCustomField` type stays in
 * `leads-custom-fields-service`, because the Leads list and the lead form read it too.
 */

/** The six types the reference's Field Type dropdown offers, in its order. */
export const CUSTOM_FIELD_TYPE_OPTIONS = [
  { value: "TEXT", label: "Text" },
  { value: "TEXTBOX", label: "Text Box" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "DATETIME", label: "Date Time" },
  { value: "DROP_DOWN", label: "Drop Down" },
] as const satisfies readonly { value: LeadCustomFieldType; label: string }[];

export const CUSTOM_FIELD_TYPE_LABELS: Record<LeadCustomFieldType, string> =
  Object.fromEntries(
    CUSTOM_FIELD_TYPE_OPTIONS.map((type) => [type.value, type.label]),
  ) as Record<LeadCustomFieldType, string>;

export const CUSTOM_FIELD_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_CUSTOM_FIELD_PAGE_SIZE = 10;
export const MAX_FIELD_LABEL = 180;

export interface CustomFieldPage {
  rows: LeadCustomField[];
  total: number;
}

export interface SaveCustomFieldInput {
  name: string;
  type: LeadCustomFieldType;
  isActive: boolean;
  /** Sent only for DROP_DOWN; the API refuses options on any other type. */
  options?: { label: string; position: number }[];
}

const FIELDS = "/lead-custom-fields";

export function fetchCustomFieldPage(
  query: {
    search?: string;
    type?: LeadCustomFieldType | null;
    page: number;
    size: number;
  },
  signal?: AbortSignal,
): Promise<CustomFieldPage> {
  return apiGet<CustomFieldPage>(
    `${FIELDS}/page`,
    new URLSearchParams({
      ...(query.search ? { search: query.search } : {}),
      ...(query.type ? { type: query.type } : {}),
      page: String(query.page),
      size: String(query.size),
    }),
    signal,
  );
}

export function createCustomField(
  input: SaveCustomFieldInput,
): Promise<LeadCustomField> {
  return apiPost<LeadCustomField>(FIELDS, input);
}

export function updateCustomField(
  id: string,
  input: SaveCustomFieldInput,
): Promise<LeadCustomField> {
  return apiPatch<LeadCustomField>(`${FIELDS}/${id}`, input);
}

export function deleteCustomField(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`${FIELDS}/${id}`);
}

/* ------------------------------------------------------------------ Form Customization */

export const FORM_MODULE_OPTIONS = [{ value: "LEAD", label: "Lead" }] as const;
export type FormModule = (typeof FORM_MODULE_OPTIONS)[number]["value"];

export const FORM_PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_FORM_PAGE_SIZE = 10;
export const MAX_FORM_NAME = 160;

export const MAX_SECTION_NAME = 120;

export interface LeadFormField {
  fieldKey: string;
  label: string;
  position: number;
  isVisible: boolean;
  /** A required system field: it is on every form and cannot be hidden. */
  isRequired: boolean;
  source: "SYSTEM" | "CUSTOM";
  /** Null for the form's ungrouped top block. */
  sectionName: string | null;
}

export interface LeadFormSection {
  name: string;
  position: number;
}

export interface LeadForm {
  id: string;
  name: string;
  module: FormModule;
  isActive: boolean;
  isDefault: boolean;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  fields: LeadFormField[];
  sections: LeadFormSection[];
}

export interface LeadFormPage {
  rows: LeadForm[];
  total: number;
}

export interface AvailableFormField {
  fieldKey: string;
  label: string;
  isRequired: boolean;
  source: "SYSTEM" | "CUSTOM";
  /** The custom field's own type, or the control the Lead drawer renders. */
  type: string;
  /** A Drop Down custom field's configured options, in order. Empty otherwise. */
  options: string[];
}

/** How the information icon and the Preview name each control. */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text",
  TEXTBOX: "Text Box",
  NUMBER: "Number",
  DATE: "Date",
  DATETIME: "Date Time",
  DROP_DOWN: "Drop Down",
  PHONE: "Phone",
  SELECT: "Dropdown",
  MULTI_SELECT: "Multi-select",
};

export interface SaveLeadFormInput {
  name: string;
  module: FormModule;
  isActive: boolean;
  isDefault: boolean;
  fields: {
    fieldKey: string;
    position: number;
    isVisible: boolean;
    sectionName: string | null;
  }[];
  sections: LeadFormSection[];
}

const FORMS = "/lead-forms";

/** One form's complete configuration, for the builder's edit route. */
export function fetchLeadForm(
  id: string,
  signal?: AbortSignal,
): Promise<LeadForm> {
  return apiGet<LeadForm>(`${FORMS}/${id}`, undefined, signal);
}

export function fetchLeadForms(
  query: { search?: string; page: number; size: number },
  signal?: AbortSignal,
): Promise<LeadFormPage> {
  return apiGet<LeadFormPage>(
    FORMS,
    new URLSearchParams({
      ...(query.search ? { search: query.search } : {}),
      page: String(query.page),
      size: String(query.size),
    }),
    signal,
  );
}

/** Every field a form may arrange: the Lead record's own, plus the active custom ones. */
export function fetchAvailableFormFields(
  signal?: AbortSignal,
): Promise<AvailableFormField[]> {
  return apiGet<AvailableFormField[]>(`${FORMS}/fields`, undefined, signal);
}

/** The arrangement the New Lead drawer renders — readable by any signed-in user. */
export function fetchDefaultLeadForm(
  signal?: AbortSignal,
): Promise<LeadForm | null> {
  return apiGet<LeadForm | null>(`${FORMS}/default`, undefined, signal);
}

export function createLeadForm(input: SaveLeadFormInput): Promise<LeadForm> {
  return apiPost<LeadForm>(FORMS, input);
}

export function updateLeadForm(
  id: string,
  input: SaveLeadFormInput,
): Promise<LeadForm> {
  return apiPatch<LeadForm>(`${FORMS}/${id}`, input);
}

export function deleteLeadForm(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`${FORMS}/${id}`);
}
